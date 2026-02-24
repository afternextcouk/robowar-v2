# CEM_INTEGRATION_NOTES.md — ROBOWAR V2 Integration Notes

**Author:** CEM (Code Reviewer & Security Specialist) — Claude Sonnet 4.6
**Date:** 2026-02-24
**Ticket:** YPY-43

---

## Overview

This document maps how the Engine, Backend, and Frontend components are intended to connect — and where the gaps currently exist. Most integration points are **not yet wired up** and require implementation work.

---

## 1. Engine ↔ Backend Integration

### 1.1 Canonical Engine Selection

⚠️ **BLOCKER:** Two engine implementations exist. The Backend must choose **one**:

| | `engine/` (root) | `engine/src/` (recommended) |
|-|------------------|------------------------------|
| LCG | Module singleton ❌ | Class instance ✅ |
| Algorithm schema | `AlgorithmRule[]` (enum) | `RuleTree` (tree-based) ✅ |
| Element matrix | Simple 1:1 chain | Full 6×6 matrix ✅ |
| Biome events | Not present | Implemented ✅ |
| Status effects | String enum | Rich interface ✅ |

**Recommendation: Use `engine/src/` exclusively.** Backend should import:
```typescript
import { runBattle } from "@robowar/engine/src/simulation/BattleEngine";
import { LCG, generateBattleSeed } from "@robowar/engine/src/core/lcg";
```

### 1.2 Seed Generation Flow (Server-Side)

```
Backend (jobs/worker.ts — battle-simulation worker)
  │
  ├─ Fetch battle record from DB (id, player1_id, player2_id, ...)
  ├─ Generate seed:
  │    const seed = generateBattleSeed(player1Id, player2Id, Date.now());
  │    // OR: use crypto.randomInt(0, 2^32) for true randomness
  │
  ├─ Store seed: UPDATE battles SET lcg_seed = $seed WHERE id = $battleId
  │
  └─ DO NOT expose seed to clients until battle is COMPLETED
```

The `generateBattleSeed()` in `engine/src/core/lcg.ts` is deterministic given the same inputs — this is useful for reproducible testing. For production, prefer `crypto.randomInt(0, 2**32)` to prevent seed prediction.

### 1.3 Battle Configuration Assembly

The `BattleConfig` object must be assembled server-side:

```typescript
// In BattleSimulationService.run(battleId):
const battle = await queryOne("SELECT * FROM battles WHERE id = $1", [battleId]);
const p1Robot = await queryOne("SELECT * FROM robots WHERE id = $1", [battle.robot1_id]);
const p2Robot = await queryOne("SELECT * FROM robots WHERE id = $1", [battle.robot2_id]);
const p1Algo  = await queryOne("SELECT rule_tree FROM algorithms WHERE id = $1", [battle.algo1_id]);
const p2Algo  = await queryOne("SELECT rule_tree FROM algorithms WHERE id = $1", [battle.algo2_id]);
const p1Pilot = battle.pilot1_id ? await queryOne("SELECT * FROM pilots WHERE id = $1", [battle.pilot1_id]) : null;
const p2Pilot = battle.pilot2_id ? await queryOne("SELECT * FROM pilots WHERE id = $1", [battle.pilot2_id]) : null;

const config: BattleConfig = {
  seed: battle.lcg_seed,
  biome: battle.biome ?? "GRASSLAND",
  maxTicks: 100,
  p1Robot: mapDbRobotToRobotConfig(p1Robot),
  p2Robot: mapDbRobotToRobotConfig(p2Robot),
  p1Pilot: p1Pilot ? mapDbPilotToConfig(p1Pilot) : null,
  p2Pilot: p2Pilot ? mapDbPilotToConfig(p2Pilot) : null,
  p1Rules: p1Algo.rule_tree,  // already stored as JSONB
  p2Rules: p2Algo.rule_tree,
};

const result = runBattle(config);
```

### 1.4 Result Storage

After `runBattle()` completes:

```typescript
await withTransaction(async (client) => {
  // Store battle result
  await client.query(`
    UPDATE battles
    SET status = 'COMPLETED',
        winner_id = $1,
        battle_log = $2,
        completed_at = NOW()
    WHERE id = $3
  `, [mapWinnerToUserId(result.winner, battle), JSON.stringify(result.ticks), battleId]);

  // Update ratings (ELO or similar)
  if (result.winner !== "DRAW") {
    await updateRatings(client, battle.player1_id, battle.player2_id, result.winner);
  }

  // Credit/deduct GMO wagers
  if (battle.gmo_wager > 0) {
    await settleWager(client, battle);
  }

  // Emit Socket.IO events
  emit.toBattle(battleId, "battle:complete", {
    winner: result.winner,
    finalP1Hp: result.finalP1Hp,
    finalP2Hp: result.finalP2Hp,
    totalTicks: result.totalTicks,
  });
});
```

### 1.5 Missing: DB Schema ↔ Engine Type Mapper

**TODO — needs implementation:**
```typescript
// mapDbRobotToRobotConfig: DB robot row → RobotConfig
function mapDbRobotToRobotConfig(row: DbRobot): RobotConfig {
  return {
    id: row.id,
    element: row.element as ElementType,
    hp: row.base_hp,
    attack: row.base_attack,
    defense: row.base_defense,
    speed: row.base_speed,
    energy: row.energy_capacity,
    energyRegen: row.energy_regen,
    strongVs: row.strong_vs as ElementType[],  // stored as array in DB
    weakVs: row.weak_vs as ElementType[],
    biomeBonus: row.biome_bonus ?? {},           // stored as JSONB
  };
}
```

---

## 2. Frontend AlgorithmEditor ↔ Backend Algorithms API

### 2.1 Algorithm Schema

The frontend editor must produce a `RuleTree` matching this JSON schema (from `engine/src/core/types.ts`):

```json
{
  "version": 2,
  "rules": [
    {
      "priority": 1,
      "condition": {
        "type": "COMPARE",
        "left": "self.hp_pct",
        "op": "<",
        "right": 30
      },
      "action": {
        "type": "SKILL",
        "skillId": "heal_burst"
      }
    },
    {
      "priority": 2,
      "condition": { "type": "ALWAYS" },
      "action": { "type": "ATTACK" }
    }
  ]
}
```

### 2.2 Available Variables for COMPARE Conditions

| Variable | Type | Range |
|----------|------|-------|
| `self.hp` | number | 0–max |
| `self.hp_pct` | number | 0–100 |
| `self.energy` | number | 0–max |
| `self.energy_pct` | number | 0–100 |
| `self.attack` | number | >0 |
| `self.defense` | number | >0 |
| `self.speed` | number | >0 |
| `enemy.hp` | number | 0–max |
| `enemy.hp_pct` | number | 0–100 |
| `enemy.energy` | number | 0–max |

### 2.3 Available Condition Node Types

| Type | Fields | Notes |
|------|--------|-------|
| `ALWAYS` | — | Always true (default/fallback) |
| `COMPARE` | `left`, `op`, `right` | Variable vs number |
| `AND` | `children: ConditionNode[]` | All must be true |
| `OR` | `children: ConditionNode[]` | Any must be true |
| `NOT` | `child: ConditionNode` | Negation |
| `IN_BIOME` | `value: BiomeType` | Current biome check |
| `ENEMY_ELEMENT` | `value: ElementType` | ⚠️ NOT YET IMPLEMENTED in engine |
| `TURN_MOD` | `divisor`, `remainder` | tick % divisor === remainder |

### 2.4 Available Action Types

| Action Type | Required Fields | Notes |
|-------------|----------------|-------|
| `ATTACK` | `target: "ENEMY"` | Basic attack |
| `SKILL` | `skillId: string` | See skill registry |
| `DEFEND` | — | Defensive stance |
| `CHARGE_ENERGY` | — | +3 energy |
| `IDLE` | — | Skip turn |

### 2.5 Available Skills

| Skill ID | Element | Energy Cost | Effect |
|----------|---------|-------------|--------|
| `heal_burst` | Any | 5 | +20% max HP |
| `power_strike` | Any | 4 | 150% ATK |
| `overcharge_strike` | Any | 6 | 200% ATK + recoil |
| `iron_wall` | Any | 3 | +20 DEF for 3 ticks |
| `lightning_bolt` | VOLT | 5 | 130% ATK, ignore 30% DEF |
| `static_field` | VOLT | 4 | Paralysis (-10 SPD, 3 ticks) |
| `flame_burst` | PYRO | 5 | ATK dmg + Burn (3 ticks) |
| `blizzard` | CRYO | 6 | ATK dmg + Freeze (-15 SPD, 2 ticks) |
| `nano_repair` | NANO | 5 | +10% HP/tick for 3 ticks |
| `void_drain` | VOID | 3 | Steal 5 energy from enemy |
| `iron_crush` | IRON | 7 | 170% ATK, ignore DEF |

### 2.6 API Endpoints for Algorithm Editor

```
GET    /v2/algorithms          — List user's algorithms
POST   /v2/algorithms          — Create new algorithm (body: {name, description, rule_tree})
GET    /v2/algorithms/:id      — Get algorithm details
PUT    /v2/algorithms/:id      — Update algorithm (body: partial {name, description, rule_tree})
DELETE /v2/algorithms/:id      — Archive algorithm (soft delete)
POST   /v2/algorithms/:id/activate — Set as active algorithm (deactivates others)
```

**⚠️ Missing validation:** The backend does NOT currently validate `rule_tree` structure. The frontend should implement client-side validation and the backend MUST add server-side schema validation (see BACK-04 in CEM_CODE_REVIEW.md).

---

## 3. Socket.IO Event Flow — Complete PvP Battle

### 3.1 Endpoint
```
WebSocket: ws://host/v2/ws
Auth: { token: "<JWT access token>" }
```

### 3.2 Full Event Sequence

```
CLIENT A                    SERVER                       CLIENT B
   │                           │                               │
   │── queue:join ──────────►  │                               │
   │   { mode: "RANKED",       │                               │
   │     robot_id, algo_id }   │◄──────────── queue:join ──────│
   │                           │              { mode, robot... }│
   │                           │                               │
   │◄── queue:updated ─────────│──────────── queue:updated ───►│
   │  { status: "WAITING" }    │           { status: "WAITING" }│
   │                           │                               │
   │         [Matchmaking worker finds a match]                │
   │                           │                               │
   │◄── match:found ───────────│──────────── match:found ─────►│
   │  { battleId, opponent,    │           { battleId, opponent,│
   │    startsAt }             │             startsAt }         │
   │                           │                               │
   │── battle:join ──────────► │ ◄────────── battle:join ───── │
   │  { battle_id }            │             { battle_id }      │
   │                           │                               │
   │◄── battle:joined ─────────│──────────── battle:joined ───►│
   │                           │                               │
   │── battle:ready ──────────►│◄─────────── battle:ready ─────│
   │                           │                               │
   │◄── battle:player_ready ───│──────────── battle:player_ready►
   │  { user_id, username }    │           { user_id, username }│
   │                           │                               │
   │  [Battle starts — server runs simulation tick by tick]    │
   │                           │                               │
   │◄── battle:tick ───────────│──────────── battle:tick ──────►│
   │  { tick, p1, p2, biome,   │ (repeats for each tick)       │
   │    winner: null }         │                               │
   │                           │                               │
   │  [Final tick — winner determined]                         │
   │                           │                               │
   │◄── battle:complete ───────│──────────── battle:complete ──►│
   │  { winner, finalP1Hp,     │           { winner, finalP1Hp, │
   │    finalP2Hp, totalTicks, │             finalP2Hp, ... }   │
   │    statGifts, evolutions }│                               │
   │                           │                               │
   │── battle:leave ──────────►│◄─────────── battle:leave ──── │
```

### 3.3 Spectator Flow

```
SPECTATOR                   SERVER
    │                          │
    │── spectate:join ────────►│
    │  { battle_id }           │
    │                          │
    │◄── spectate:joined ───── │
    │                          │
    │◄── battle:tick ──────────│  (receives same tick events as players)
    │◄── battle:complete ──────│
    │                          │
    │── spectate:leave ───────►│
```

### 3.4 Emote Flow

```
CLIENT A                    SERVER                       CLIENT B
   │── battle:emote ─────────►│──────── battle:emote_received ─►│
   │  { battle_id, emote_id } │       { from_player, emote_id }  │
```

---

## 4. Missing Integration Points & TODOs

### P0 — Blockers (Must Fix Before Any Battle Can Run)

| # | TODO | File | Notes |
|---|------|------|-------|
| T01 | Implement `BattleSimulationService.run(battleId)` | `backend/src/jobs/worker.ts` | Core battle execution. Use `engine/src/simulation/BattleEngine.ts`. |
| T02 | Wire up DB→Engine type mappers | New file: `backend/src/services/battleMapper.ts` | Convert DB rows to `BattleConfig` |
| T03 | Emit `battle:tick` events from worker | `backend/src/jobs/worker.ts` | Use `emit.toBattle()` from `socket/index.ts` |
| T04 | Fix `/battles/live` route ordering | `backend/src/routes/battles.ts` | Move `GET /live` before `GET /:id` |

### P1 — High Priority

| # | TODO | File | Notes |
|---|------|------|-------|
| T05 | Add `rule_tree` Zod validation | `backend/src/routes/algorithms.ts` | Max 50 rules, max depth 10 |
| T06 | Add DB transaction to robot purchase | `backend/src/routes/robots.ts` | Use `withTransaction()` |
| T07 | Implement wallet auth (MetaMask nonce) | New: `backend/src/routes/auth.ts` | EIP-191 signature verification |
| T08 | Remove JWT secret fallbacks | `middleware/auth.ts`, `routes/auth.ts` | Fatal error if not set |
| T09 | Fix matchmaking userId spoofing | `backend/src/socket/matchmaking.ts` | Verify userId from socket auth token |
| T10 | Add atomic matchmaking with Redis Lua | `backend/src/socket/matchmaking.ts` | Prevent double-match race |

### P2 — Medium Priority

| # | TODO | File | Notes |
|---|------|------|-------|
| T11 | Implement `ENEMY_ELEMENT` condition | `engine/src/simulation/BattleEngine.ts` | Currently always returns false |
| T12 | Apply status effect `modifier` fields | `engine/src/simulation/BattleEngine.ts` | Speed/defense buffs not applied |
| T13 | Implement PassiveTrait processing | `engine/combatEngine.ts` or `BattleEngine.ts` | Currently ignored |
| T14 | Add refresh token rotation/revocation | `backend/src/routes/auth.ts` | Redis blacklist or DB version |
| T15 | Add Socket.IO rate limiting | All socket handlers | Token bucket per-socket |
| T16 | Add matchmaking queue TTL cleanup | `backend/src/socket/matchmaking.ts` | Remove stale entries |
| T17 | Unify to single DB client (pg or Prisma) | `jobs/energyRecharge.ts` vs rest | Mixed ORM pattern |
| T18 | Add startup env validation | `backend/src/index.ts` | Fail fast on missing secrets |

### P3 — Low Priority / Nice-to-Have

| # | TODO | File | Notes |
|---|------|------|-------|
| T19 | Implement `superUsedThisBattle` flag | `engine/combatEngine.ts` | Set to true on super use |
| T20 | Implement PassiveTrait system | `engine/combatEngine.ts` | Design required first |
| T21 | Admin audit logging | `backend/src/routes/admin.ts` | Log who banned/unbanned |
| T22 | Add pagination to admin user list | `backend/src/routes/admin.ts` | Currently LIMIT 100 hardcoded |
| T23 | Replace KEYS with SCAN in Redis | `backend/src/config/redis.ts` | Non-blocking pattern search |
| T24 | Archive root-level engine files | `engine/` root | Keep only `engine/src/` |
| T25 | Add username validation to PATCH /me | `backend/src/routes/users.ts` | Length, chars, uniqueness |

---

## 5. Engine Version Compatibility

The Frontend AlgorithmEditor must target **engine schema version 2** (`rule_tree.version: 2`). Backend must:
1. Store `rule_tree.version` in the algorithms table
2. Reject algorithms with unknown version numbers
3. Run migration scripts when upgrading engine version (convert old rule trees)

---

## 6. Battle Tick Streaming Strategy

Two options for streaming battle ticks to clients:

**Option A: Pre-computed (Recommended for V2)**
1. Worker computes all ticks upfront (`runBattle()` returns full `BattleResult`)
2. Worker stores complete `battle_log` in DB
3. Worker streams ticks to Socket.IO with configurable delay (e.g., 200ms per tick)
4. Replay available immediately after completion

**Option B: Real-time**
1. Engine yields one tick at a time (requires generator-based engine refactor)
2. Each tick emitted to Socket.IO immediately
3. Harder to replay, more complex implementation

**Current engine uses Option A** — `runBattle()` returns the full result synchronously. Worker should use `setInterval` or `for...of` with delay to stream ticks.

```typescript
// Example streaming in worker:
for (const tick of result.ticks) {
  emit.toBattle(battleId, "battle:tick", tick);
  await sleep(150); // 150ms per tick = ~15s for 100 ticks
}
emit.toBattle(battleId, "battle:complete", { winner: result.winner, ... });
```

---

*Document generated by CEM — Code Reviewer & Security Specialist*
*ROBOWAR V2 — YPY-43*
