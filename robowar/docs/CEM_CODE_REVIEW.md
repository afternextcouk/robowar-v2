# CEM_CODE_REVIEW.md — ROBOWAR V2 Full Code Review

**Reviewer:** CEM (Code Reviewer & Security Specialist) — Claude Sonnet 4.6
**Date:** 2026-02-24
**Scope:** `engine/` (all .ts), `engine/src/` (all .ts), `backend/src/` (all .ts)
**Ticket:** YPY-43

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2     |
| HIGH     | 9     |
| MED      | 12    |
| LOW      | 8     |
| **Total**| **31**|

---

## 1. ENGINE REVIEW

### 1.1 LCG Correctness

#### [HIGH] ENGINE-01 — Module-Level LCG Singleton (Global Mutable State)
- **File:** `engine/lcg.ts`
- **Line:** 12 (`let _state: number = 0;`)
- **Description:** The root-level `lcg.ts` uses a module-level singleton `_state`. If the Node.js process runs two battles concurrently (which the BullMQ `battleWorker` at concurrency=4 will do), both simulations share the same RNG state. Battle B will consume LCG outputs intended for Battle A, making both non-deterministic and corrupting replays.
- **Contrast:** `engine/src/core/lcg.ts` correctly uses a class-instance `LCG` — each battle gets its own `new LCG(seed)`. The root-level `lcg.ts` singleton pattern is incorrect for concurrent use.
- **Fix:** Replace all usage of `engine/lcg.ts` with `engine/src/core/lcg.ts`. Delete the singleton version. The class-based approach is already better designed.

#### [MED] ENGINE-02 — Redundant `% M` in LCG next()
- **File:** `engine/src/core/lcg.ts`
- **Line:** 22 (`this.state = ((A * this.state + C) >>> 0) % M;`)
- **Description:** The `>>> 0` operator already restricts the value to an unsigned 32-bit integer (0–4294967295 = 2^32 - 1), so `% M` where `M = 4294967296 = 2^32` is mathematically redundant. Not a bug, but misleading and potentially confusing for maintainers who may modify M.
- **Fix:** Remove `% M` or add a comment: `// % M is redundant since >>> 0 already produces [0, 2^32-1]`

#### [LOW] ENGINE-03 — LCG Arithmetic Precision Note
- **File:** `engine/lcg.ts` and `engine/src/core/lcg.ts`
- **Line:** LCG `next()` function
- **Description:** `A * _state` where `A=1664525`, `_state` up to `2^32-1=4294967295` produces a maximum product of ≈7.15×10^15. JavaScript's safe integer range is 2^53 ≈ 9.0×10^15, so no precision loss occurs. Worth documenting explicitly so future developers know the arithmetic is safe.
- **Fix:** Add comment: `// A * _state max ≈ 7.15e15 < Number.MAX_SAFE_INTEGER (9.0e15) — safe`

---

### 1.2 Dual Engine Architecture (CRITICAL)

#### [CRITICAL] ENGINE-04 — Two Incompatible Battle Engine Implementations Coexist
- **File:** `engine/combatEngine.ts` vs `engine/src/simulation/BattleEngine.ts`
- **Description:** There are **two completely separate battle engines** in the repo that are mutually incompatible. They differ in:
  - **Algorithm system:** `combatEngine.ts` uses `AlgorithmRule[]` with an enum-based `Condition`; `BattleEngine.ts` uses `RuleTree` with a nested `ConditionNode` tree. These are incompatible structures.
  - **Element advantage:** `combatEngine.ts` uses a simple 1:1 chain (each element beats exactly 1 other), `BattleEngine.ts` uses a 6×6 matrix where each element beats 2 and loses to 2.
  - **Status effects:** `combatEngine.ts` uses a `StatusEffect` string enum; `BattleEngine.ts` uses a rich `StatusEffect` interface with `remainingTicks`, `modifier`, `tickDamage`.
  - **Rule priority sorting:** `combatEngine.ts` sorts **descending** (`b.priority - a.priority`); `BattleEngine.ts` sorts **ascending** (`a.priority - b.priority`). Identical algorithm rule sets will produce different behavior.
- **Risk:** The backend worker uses neither — it's a TODO stub. But when integrated, the wrong engine will be chosen, and the frontend algorithm editor (which must target one engine's schema) will be broken for the other.
- **Fix:** Team must align on **one** canonical engine. Recommend `engine/src/` (class-based LCG, richer type system, biome events). Archive/delete `engine/combatEngine.ts` and `engine/algorithmInterpreter.ts` at root level. Document the decision in ADR.

---

### 1.3 Algorithm Interpreter Safety

#### [HIGH] ENGINE-05 — No Algorithm Complexity Limit
- **File:** `engine/src/simulation/BattleEngine.ts` (`resolveAction`) and `engine/algorithmInterpreter.ts` (`interpretAlgorithm`)
- **Description:** There is no limit on the number of rules in a `Rule[]` array or depth of `ConditionNode` trees. A malicious user could submit an algorithm with thousands of rules or deeply nested AND/OR trees that executes during battle simulation, causing CPU exhaustion (DoS). Since the backend worker runs all battles in-process, one expensive algorithm could stall the entire worker.
- **Fix:** Validate on save: max 50 rules, max `ConditionNode` tree depth of 10. Add a `MAX_EVAL_DEPTH` guard in `evaluateCondition()`.

#### [MED] ENGINE-06 — `ENEMY_ELEMENT` Condition Always Returns False
- **File:** `engine/src/simulation/BattleEngine.ts`
- **Line:** `case "ENEMY_ELEMENT": return false; // Handled by robot config lookup at higher level`
- **Description:** The `ENEMY_ELEMENT` condition is stubbed and always returns `false`. Users who create algorithm rules with `type: "ENEMY_ELEMENT"` will get silent failures — the rule will never trigger, but no error is thrown. This is a broken feature that users will not be aware of.
- **Fix:** Implement by comparing `enemy.robotId` against `config.p1Robot.id`/`config.p2Robot.id` to get the element. Or surface a validation error when the algorithm is saved/activated.

#### [MED] ENGINE-07 — Algorithm Rule Priority Direction Inconsistency
- **File:** `engine/src/simulation/BattleEngine.ts` line: `const sorted = [...rules].sort((a, b) => a.priority - b.priority);`
- **File:** `engine/algorithmInterpreter.ts` line: `const sorted = [...rules].sort((a, b) => b.priority - a.priority);`
- **Description:** `BattleEngine.ts` sorts ascending (priority 1 fires first); `algorithmInterpreter.ts` sorts descending (highest priority fires first). The same algorithm data will produce different action choices depending on which engine is active.
- **Fix:** Standardize to descending (highest priority = first evaluated). Update both files and document in API/algorithm schema.

---

### 1.4 Combat Engine Edge Cases

#### [MED] ENGINE-08 — COUNTER_STANCE Cross-Round State Bug
- **File:** `engine/combatEngine.ts`
- **Description:** `COUNTER_STANCE` reflection in `handleCounterStanceReflect` checks `target.lastAction === Action.COUNTER_STANCE`. `lastAction` is set to the current turn's action. In the combat loop, the first actor executes and `lastAction` updates. When the second actor then attacks, `handleCounterStanceReflect` fires against the first actor's newly-updated `lastAction`. This means COUNTER_STANCE only reflects if the robot chose it on the same round, not the previous round — the intended mechanic is unclear. More critically, there is no persistent "I am in counter stance until I do something else" state.
- **Fix:** Add a `isInCounterStance: boolean` field to `RobotBattleState`, set it when COUNTER_STANCE is chosen, clear it at start of the robot's next turn.

#### [LOW] ENGINE-09 — PassiveTrait Never Applied
- **File:** `engine/combatEngine.ts`
- **Description:** `RobotStats.passiveTrait` is defined in types with trait types like `ON_HIT_BURN_CHANCE`, `LIFESTEAL`, `COUNTER_ON_BLOCK`, but `executeAction` never reads `actor.stats.passiveTrait`. All passive traits are silently ignored.
- **Fix:** Implement passive trait processing in `executeAction` or add a `processPasiveTraits()` function called after each action.

#### [LOW] ENGINE-10 — `superUsedThisBattle` Flag Never Set
- **File:** `engine/combatEngine.ts`
- **Line:** `superUsedThisBattle: false` (in `initBattleState`)
- **Description:** `RobotBattleState.superUsedThisBattle` is initialized to `false` but is never set to `true` when a super attack is used. If any game logic depends on this field (e.g., preventing super use twice, analytics), it will always read `false`.
- **Fix:** Add `actor.superUsedThisBattle = true;` inside the `USE_SUPER_ATTACK_1`/`USE_SUPER_ATTACK_2` case in `executeAction`.

#### [MED] ENGINE-11 — Element Matrix Inconsistency Between Root and src/
- **File:** `engine/elementAdvantage.ts` vs `engine/src/elements/matrix.ts`
- **Description:** Two different element advantage systems:
  - Root `elementAdvantage.ts`: Simple circular chain (VOLT>CRYO>PYRO>NANO>VOID>IRON>VOLT). Each element beats exactly one and loses to one. Multipliers ±20%.
  - `src/elements/matrix.ts`: Full 6×6 matrix, each element beats 2 and loses to 2. Multipliers ±25%.
  - These are different game balance designs and cannot both be canon.
- **Fix:** Decide on one matrix, delete the other. Ensure the frontend matchup display is consistent.

#### [MED] ENGINE-12 — Status Effect `modifier` Fields Not Applied
- **File:** `engine/src/simulation/BattleEngine.ts` (`applyStatusTicks`)
- **Description:** Many status effects in `skills.ts` and `biomeEvents.ts` include a `modifier` field (e.g., `{ speed: -10 }`, `{ defense: -5 }`). `applyStatusTicks()` only processes `tickDamage` and `tickHeal`, never applies `modifier` to the fighter's stats. Paralysis, Sandstorm, Iron Wall, and all speed/defense modifier effects are silently applied but never affect combat.
- **Fix:** In `applyStatusTicks()`, iterate modifiers and apply to the fighter state. On expiry, reverse the modifiers.

---

## 2. BACKEND REVIEW

### 2.1 Authentication Security

#### [HIGH] BACK-01 — JWT Secret Falls Back to Known Weak Hardcoded Secret
- **File:** `backend/src/middleware/auth.ts` line 27, `backend/src/routes/auth.ts` line 10
- **Description:** `process.env.JWT_SECRET || "dev_secret"` and `process.env.JWT_REFRESH_SECRET || "dev_refresh"` — if these env vars are not set in production, **any attacker who knows the fallback strings can forge valid JWTs**. The fallback strings are visible in the source code. This completely bypasses authentication.
- **Fix:** Remove fallback values. On startup, throw a fatal error if `JWT_SECRET` is not set: `if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");`

#### [MED] BACK-02 — No Refresh Token Rotation or Revocation
- **File:** `backend/src/routes/auth.ts` (POST /refresh)
- **Description:** Refresh tokens are not rotated on use (same token remains valid for 7 days) and there is no revocation mechanism (no token store, no blacklist). A stolen refresh token grants persistent 7-day access. The `/auth/logout` endpoint only clears the cookie client-side — the token itself remains valid server-side.
- **Fix:** On each `/refresh` call, issue a new refresh token and invalidate the old one via a Redis blacklist or token version counter in the DB. On logout, invalidate the refresh token in storage.

#### [LOW] BACK-03 — MetaMask/Web3 Wallet Auth Not Implemented
- **Description:** `AGENTS.md` specifies Web3/MetaMask integration but there are no wallet auth endpoints (challenge/nonce issuance, signature verification). The `users` table has a `wallet_address` field but no `/auth/wallet-connect` route exists.
- **Recommendation:** Implement standard nonce-based wallet auth: `GET /auth/nonce?address=0x...` returns a random nonce stored in Redis (TTL 5min). `POST /auth/wallet-verify` verifies the EIP-191 signature against the nonce. Nonce must be single-use.

---

### 2.2 Input Validation

#### [HIGH] BACK-04 — Algorithm `rule_tree` Accepts Any JSON (No Schema Validation)
- **File:** `backend/src/routes/algorithms.ts` (POST / and PUT /:id)
- **Line:** `const { name, description, rule_tree } = req.body;`
- **Description:** The `rule_tree` is stored as JSON without any structural validation. There's no check for:
  - Maximum size (could be megabytes of JSON, bypassing the 1MB body limit if compressed)
  - Maximum rule count (could be thousands of rules)
  - Maximum condition tree depth (could be infinitely nested AND/OR trees)
  - Valid action/condition types
  - This allows DoS of the battle simulation engine and storage layer.
- **Fix:** Validate with a Zod schema matching the `RuleTree` interface. Enforce: max 50 rules, max depth 10 for ConditionNode, valid enum values for action.type, and max total JSON length of 50KB.

#### [MED] BACK-05 — Username Update Has No Validation
- **File:** `backend/src/routes/users.ts` (PATCH /me)
- **Line:** `const { username, avatar_url } = req.body;`
- **Description:** Username update accepts any string without validating: length (3–32 chars), character set (alphanumeric), uniqueness. A user can set their username to a 10,000-character string or duplicate another user's name.
- **Fix:** Add validation: `username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional()`. Add uniqueness check before UPDATE.

#### [MED] BACK-06 — Admin Ban Endpoint Has No Type Validation
- **File:** `backend/src/routes/admin.ts` (PATCH /users/:id/ban)
- **Description:** `const { banned, reason } = req.body;` — `banned` should be boolean but any value is accepted. Sending `banned: "yes"` or `banned: 1` could produce unexpected behavior in the DB. `reason` has no length limit.
- **Fix:** Validate: `banned: z.boolean()`, `reason: z.string().max(500).optional()`.

---

### 2.3 SQL Injection Prevention (Prisma/pg ORM)

#### [LOW] BACK-07 — Raw pg Queries Consistently Use Parameterized Placeholders
- **All routes using `query()` and `queryOne()`**
- **Assessment:** All raw SQL queries in the codebase use `$1, $2, ...` parameterized placeholders via the `pg` library. No string concatenation of user-controlled values into SQL strings was found. The `battles.ts` list endpoint builds conditions dynamically but column names are hardcoded — only values are passed as params. **No SQL injection vulnerabilities identified.**

#### [MED] BACK-08 — `cache.invalidatePattern` Uses KEYS Command
- **File:** `backend/src/config/redis.ts`
- **Line:** `const keys = await getRedis().keys(pattern);`
- **Description:** `KEYS` is a blocking O(n) command that scans all Redis keys. On large Redis instances, this can block the event loop for seconds. Should use `SCAN` with cursor for non-blocking key enumeration.
- **Fix:** Replace `keys()` with async iteration via `SCAN`.

---

## 3. WEB3 SECURITY

#### [HIGH] WEB3-01 — No Wallet Signature Verification Implemented
- **Description:** No MetaMask authentication routes exist. Without signature verification, wallet address in user profile cannot be trusted — any user can claim any wallet address. This is a prerequisite for any ELDR token functionality.
- **Fix:** Implement EIP-191 signed message verification using `ethers.js` `verifyMessage()`. Store nonce in Redis with 5-minute TTL. Nonce must be marked used immediately after successful verification (replay protection).

#### [HIGH] WEB3-02 — Robot Purchase Has No Database Transaction (Race Condition → Negative GMO)
- **File:** `backend/src/routes/robots.ts` (POST /:robotId/purchase)
- **Description:** The purchase flow executes 4 separate queries without a transaction:
  1. `SELECT gmo_cost FROM robots` 
  2. `SELECT gmo_balance FROM users` (check balance)
  3. `SELECT ... FROM user_robots` (check already owned)
  4. `INSERT INTO user_robots` + `UPDATE users SET gmo_balance = gmo_balance - $1`
  
  Under concurrent requests (e.g., two simultaneous purchase requests), the balance check at step 2 can pass for both requests before either deduction executes — resulting in double purchase and negative GMO balance.
- **Fix:** Wrap the entire purchase in `withTransaction()`. Use `UPDATE users SET gmo_balance = gmo_balance - $1 WHERE id = $2 AND gmo_balance >= $1 RETURNING *` to atomically deduct only if balance is sufficient. Check rowcount to detect race loss.

#### [MED] WEB3-03 — ELDR Balance Stored as String, Arithmetic Risks
- **File:** `backend/src/routes/economy.ts`, `backend/src/models/types.ts`
- **Description:** `eldr_balance` is stored in the DB and returned as a string (e.g., `"0.01"`) to avoid JavaScript BigInt issues. This is correct for storage, but no arithmetic library (e.g., `decimal.js` or `ethers.js` `parseUnits`) is used for balance calculations. If ELDR arithmetic is ever needed server-side, plain `parseFloat()` could introduce floating-point errors.
- **Fix:** Use `ethers.BigNumber` or `Decimal.js` for all ELDR balance arithmetic. Never use `Number()` or `parseFloat()` on token amounts.

#### [MED] WEB3-04 — Replay Attack Protection for Wallet Auth (Preemptive)
- **When Wallet Auth is implemented:**
  - Nonce must be stored in Redis with a TTL (5 minutes).
  - Nonce must be marked used **before** responding with a JWT (not after) to prevent TOCTOU attacks.
  - Nonce must be tied to the wallet address (`nonce:${address}` key) to prevent cross-address reuse.
  - Include timestamp in signed message to enforce freshness beyond nonce TTL.

---

## 4. PERFORMANCE

#### [CRITICAL] PERF-01 — Battle Simulation Worker Is a TODO Stub
- **File:** `backend/src/jobs/worker.ts`
- **Line:** `// TODO: Import and call BattleSimulationService`
- **Description:** The `battle-simulation` BullMQ worker, `matchmaking` worker, and `leaderboard-refresh` worker are all empty stubs. The core game mechanic (running battles) is completely unimplemented server-side. Battles cannot resolve.
- **Fix:** Implement `BattleSimulationService.run(battleId)` that: fetches battle from DB, loads robot configs and algorithms, instantiates `new LCG(seed)`, calls `runBattle(config)`, stores result in DB, emits Socket.IO events.

#### [HIGH] PERF-02 — Matchmaking Queue Redis Race Condition
- **File:** `backend/src/socket/matchmaking.ts` (`findMatch`)
- **Description:** The matchmaking loop is NOT atomic:
  1. `getQueue()` — reads all entries
  2. Finds opponent
  3. `removeFromQueue(entry.socketId)`
  4. `removeFromQueue(opponent.socketId)`
  
  Two sockets running simultaneous `findMatch` calls can both read the same queue state and both attempt to match the same pair of players, creating duplicate `match_found` events. 
- **Fix:** Use a Redis Lua script for atomic check-and-remove, or use `HSETNX` for a lock pattern. Alternatively, use Redis `BLPOP` on a list for a queue abstraction.

#### [HIGH] PERF-03 — Matchmaking Queue Has No TTL (Ghost Players)
- **File:** `backend/src/socket/matchmaking.ts`
- **Description:** The `robowar:matchmaking:queue` Redis hash has no expiry. If a player's socket disconnects unexpectedly (crash, network loss), the disconnect handler may not fire, leaving their entry in the queue indefinitely. Ghost players will block matchmaking slots and could be matched against real players who will never get a response.
- **Fix:** Store `joinedAt` timestamp in queue entries (already done). Add a periodic cleanup job that removes entries older than 60 seconds. Or set per-field TTL using a Redis sorted set (score = joinedAt timestamp) instead of a hash.

#### [MED] PERF-04 — `cache.set` Without TTL Can Cause Unbounded Redis Memory Growth
- **File:** `backend/src/config/redis.ts`
- **Line:** `await getRedis().set(key, str);` (no-TTL path)
- **Description:** The `cache.set` function supports optional TTL. Any call without TTL stores a key that never expires. If misused (e.g., caching per-battle data), Redis memory grows unboundedly.
- **Fix:** Make TTL required for `cache.set`. Establish TTL policy: users (300s), robots (3600s), battles (86400s), algorithms (600s).

#### [MED] PERF-05 — BullMQ Queue Connection Created Before Redis Ready
- **File:** `backend/src/jobs/queues.ts`
- **Description:** Queue instances are created at module import time via `connection: () => ({ connection: getRedis() })`. However, `getRedis()` throws if Redis is not yet initialized. If `queues.ts` is imported before `connectRedis()` is awaited (possible depending on module load order), queues fail silently.
- **Fix:** Lazy-initialize queues after `connectRedis()` completes. Or use an async factory pattern.

#### [MED] PERF-06 — No Rate Limiting on Socket.IO Events
- **File:** `backend/src/socket/handlers/battle.ts`, `queue.ts`, `spectate.ts`
- **Description:** Socket.IO event handlers have no rate limiting. A client can emit `battle:emote` or `battle:join` thousands of times per second, potentially overwhelming the server's event loop.
- **Fix:** Implement per-socket rate limiting middleware in Socket.IO (e.g., using `socket-io-rate-limiter` or a custom token bucket counter in Redis).

#### [LOW] PERF-07 — energyRecharge Uses Prisma (Mixed DB Clients)
- **File:** `backend/src/jobs/energyRecharge.ts`
- **Description:** The energy recharge worker uses `PrismaClient` while the rest of the backend uses raw `pg`. Two ORM clients means two connection pools, different config, different type systems. Maintenance inconsistency.
- **Fix:** Migrate energy recharge to use the shared `pg` pool from `db/index.ts`, or migrate all DB access to Prisma.

---

## 5. ROUTE / LOGIC BUGS

#### [HIGH] BACK-09 — `/battles/live` Route Is Unreachable
- **File:** `backend/src/routes/battles.ts`
- **Description:** Routes are registered in this order:
  ```typescript
  battlesRouter.get("/:id", ...)   // Line ~30 — registered FIRST
  battlesRouter.get("/live", ...)  // Line ~60 — registered AFTER
  ```
  Express matches routes in registration order. `GET /battles/live` will match `/:id` with `id = "live"`, return 404 (no battle with ID "live"), and `/live` is dead code.
- **Fix:** Move `GET /live` registration **before** `GET /:id`.

#### [LOW] BACK-10 — Admin Users List Has No Pagination
- **File:** `backend/src/routes/admin.ts`
- **Description:** `SELECT ... FROM users ORDER BY created_at DESC LIMIT 100` hardcodes LIMIT 100 with no offset. As user base grows, admins cannot paginate beyond page 1.
- **Fix:** Add `offset` query param and standard pagination response.

---

## 6. MISSING FEATURES (Functional Gaps)

| Feature | Status | Risk |
|---------|--------|------|
| MetaMask wallet auth | ❌ Not implemented | HIGH |
| Battle simulation service | ❌ TODO stub | CRITICAL |
| COUNTER_STANCE fully persistent state | ⚠️ Partial | MED |
| PassiveTrait processing | ❌ Not implemented | LOW |
| Status effect `modifier` application | ❌ Not implemented | MED |
| ENEMY_ELEMENT condition | ❌ Always false | MED |
| Refresh token rotation/revocation | ❌ Not implemented | MED |
| Socket.IO rate limiting | ❌ Not implemented | MED |

---

*Report generated by CEM — Code Reviewer & Security Specialist*
*ROBOWAR V2 — YPY-43*
