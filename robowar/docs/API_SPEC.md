# ROBOWAR V2 — API Specification

> **Base URL**: `https://api.robowar.io/v2`  
> **Auth**: Bearer JWT (access token, 15min TTL) + Refresh token (httpOnly cookie, 7d TTL)  
> **Format**: JSON  
> **Rate Limiting**: 100 req/min per IP (auth endpoints: 10 req/min)

---

## Authentication

### `POST /auth/register`
Register a new player account.

**Request:**
```json
{
  "username": "RoboPilot42",
  "email": "pilot@example.com",
  "password": "Min8chars!Uppercase1"
}
```
**Response `201`:**
```json
{
  "user": { "id": "uuid", "username": "RoboPilot42", "level": 1, "gmo_balance": 1000 },
  "access_token": "eyJ...",
  "expires_in": 900
}
```
Refresh token set as `httpOnly` cookie.

---

### `POST /auth/login`
**Request:** `{ "email": "...", "password": "..." }`  
**Response `200`:** Same as register.

---

### `POST /auth/refresh`
Uses `httpOnly` refresh token cookie.  
**Response `200`:** `{ "access_token": "eyJ...", "expires_in": 900 }`

---

### `POST /auth/logout`
Clears refresh token cookie.  
**Response `204`:** No content.

---

### `POST /auth/wallet/connect`
Link MetaMask wallet (verify via signature).

**Request:**
```json
{
  "wallet_address": "0xABCD...1234",
  "signature": "0x...",
  "message": "ROBOWAR_CONNECT_1708123456"
}
```
**Response `200`:** `{ "wallet_address": "0xABCD...1234", "linked": true }`

---

## Users

### `GET /users/me`
Returns current authenticated user profile.
```json
{
  "id": "uuid",
  "username": "RoboPilot42",
  "email": "pilot@example.com",
  "wallet_address": "0x...",
  "gmo_balance": 12500,
  "eldr_balance": "3.141592653589793",
  "xp": 2400,
  "level": 8,
  "avatar_url": "/avatars/default.png",
  "created_at": "2026-01-01T00:00:00Z"
}
```

---

### `PATCH /users/me`
Update profile (username, avatar).

**Request:** `{ "username": "NewName", "avatar_url": "..." }`  
**Response `200`:** Updated user object.

---

### `GET /users/:id`
Public profile by user ID.  
Returns: username, level, avatar, rating, win/loss record. **No email/wallet.**

---

### `GET /users/me/stats`
Detailed personal statistics.
```json
{
  "battles_total": 142,
  "battles_won": 89,
  "battles_lost": 48,
  "battles_drawn": 5,
  "win_rate": 62.7,
  "rating": 1284,
  "peak_rating": 1410,
  "gmo_earned_total": 85000,
  "eldr_earned_total": "12.5",
  "favorite_element": "VOLT",
  "favorite_biome": "CITY"
}
```

---

## Robots

### `GET /robots`
List all 36 robots. Supports filtering.

**Query params:** `element`, `tier`, `biome_bonus`, `sort_by` (base_attack|base_hp|gmo_cost)

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "slug": "volt-striker-mk1",
      "display_name": "Volt Striker Mk.I",
      "element": "VOLT",
      "tier": "T1",
      "base_hp": 80,
      "base_attack": 65,
      "base_defense": 40,
      "base_speed": 75,
      "base_energy": 10,
      "energy_regen": 3,
      "strong_vs": ["CRYO", "IRON"],
      "weak_vs": ["NANO"],
      "biome_bonus": { "CITY": 15, "GRASSLAND": 5 },
      "gmo_cost": 500,
      "is_starter": true,
      "sprite_atlas": "robots/volt/striker_mk1.json"
    }
  ],
  "total": 36
}
```

---

### `GET /robots/:id`
Single robot detail.

---

### `GET /users/me/robots`
All robots owned by the authenticated user.

**Response:** Same shape + `nickname`, `upgrade_*`, `acquired_at`.

---

### `POST /users/me/robots/:robotId/purchase`
Purchase a robot with GMO.

**Response `200`:** `{ "user_robot_id": "uuid", "gmo_balance_after": 9500 }`  
**Response `400`:** `{ "error": "INSUFFICIENT_GMO" }` / `{ "error": "ALREADY_OWNED" }`

---

### `PATCH /users/me/robots/:userRobotId`
Update nickname or apply upgrades.

**Request:** `{ "nickname": "Zap Master", "upgrade_attack": 1 }`

---

## Pilots

### `GET /users/me/pilots`
List owned pilots.

---

### `POST /pilots/mint`
Mint a new pilot NFT (costs GMO + on-chain gas).

**Request:** `{ "name": "ACE-7", "sprite_key": "pilot_ace_7" }`  
**Response `202`:** `{ "pilot_id": "uuid", "tx_hash": "0x...", "status": "PENDING" }`

---

### `GET /pilots/:id`
Single pilot detail including NFT metadata.

---

## Algorithms

### `GET /users/me/algorithms`
List all algorithms by the authenticated user.

**Query:** `status` (DRAFT|ACTIVE|ARCHIVED), `sort_by` (created_at|win_rate|times_used)

---

### `POST /algorithms`
Create a new algorithm.

**Request:**
```json
{
  "name": "Aggressive Striker v3",
  "description": "Full attack until low HP, then heal",
  "rule_tree": {
    "version": 2,
    "rules": [
      {
        "priority": 1,
        "condition": {
          "type": "AND",
          "children": [
            { "type": "COMPARE", "left": "self.hp_pct", "op": "<", "right": 30 },
            { "type": "COMPARE", "left": "self.energy", "op": ">=", "right": 5 }
          ]
        },
        "action": { "type": "SKILL", "skillId": "heal_burst", "target": "SELF" }
      },
      {
        "priority": 2,
        "condition": { "type": "COMPARE", "left": "self.energy", "op": ">=", "right": 3 },
        "action": { "type": "SKILL", "skillId": "overcharge_strike", "target": "ENEMY" }
      },
      {
        "priority": 99,
        "condition": { "type": "ALWAYS" },
        "action": { "type": "ATTACK", "target": "ENEMY" }
      }
    ]
  }
}
```

**Response `201`:** Algorithm object with `is_valid`, `validation_errors`.

---

### `GET /algorithms/:id`
Single algorithm detail.

---

### `PUT /algorithms/:id`
Full update (increments version, stores parent_id).

---

### `DELETE /algorithms/:id`
Soft-delete (sets status to ARCHIVED).

---

### `POST /algorithms/:id/validate`
Re-validate a rule tree without saving.

**Response `200`:** `{ "is_valid": true, "errors": [] }` or `{ "is_valid": false, "errors": ["Rule 2: unknown skill 'nuke'"] }`

---

### `POST /algorithms/:id/activate`
Set as the active algorithm for battles.

---

### `GET /algorithms/:id/simulate`
Dry-run simulation vs AI baseline.

**Query:** `robot_id`, `biome`, `ai_difficulty` (EASY|MEDIUM|HARD)  
**Response:** Full battle log preview.

---

## Battles

### `POST /battles/queue`
Enter matchmaking queue.

**Request:**
```json
{
  "mode": "RANKED",
  "robot_id": "uuid",
  "algorithm_id": "uuid",
  "pilot_id": "uuid",
  "gmo_wager": 100
}
```
**Response `202`:** `{ "queue_id": "uuid", "estimated_wait_s": 12 }`

---

### `DELETE /battles/queue`
Leave matchmaking queue.  
**Response `204`:** No content.

---

### `GET /battles/queue/status`
Current queue position and status.

**Response:** `{ "status": "WAITING", "position": 3, "rating_range": 150 }`

---

### `GET /battles/:id`
Get battle details.

**Response:**
```json
{
  "id": "uuid",
  "mode": "RANKED",
  "status": "COMPLETED",
  "biome": "CITY",
  "player1": { "id": "uuid", "username": "Zephyr", "robot": { ... }, "pilot": { ... } },
  "player2": { "id": "uuid", "username": "Blitzdrop", "robot": { ... }, "pilot": { ... } },
  "winner_id": "uuid",
  "total_ticks": 48,
  "lcg_seed": 1234567890,
  "gmo_wagered": 200,
  "gmo_winner_gain": 380,
  "started_at": "2026-02-24T09:00:00Z",
  "completed_at": "2026-02-24T09:00:38Z"
}
```

---

### `GET /battles/:id/replay`
Full tick-by-tick battle log for replay.

**Response:**
```json
{
  "lcg_seed": 1234567890,
  "ticks": [
    {
      "tick": 1,
      "p1": { "hp": 80, "energy": 3, "action": "ATTACK", "damage_dealt": 12, "status_effects": [] },
      "p2": { "hp": 80, "energy": 3, "action": "DEFEND", "damage_dealt": 0, "status_effects": [] },
      "biome_event": null
    }
  ]
}
```

---

### `GET /battles`
Battle history (paginated).

**Query:** `user_id`, `mode`, `status`, `biome`, `limit` (default 20, max 100), `offset`

---

### `GET /battles/live`
List currently in-progress battles (spectate feed).

---

## Leaderboard

### `GET /leaderboard`
Global ranked leaderboard.

**Query:** `mode` (RANKED|CASUAL), `season`, `element` (filter by favourite element), `limit`, `offset`

**Response `200`:**
```json
{
  "season": 1,
  "updated_at": "2026-02-24T09:05:00Z",
  "data": [
    {
      "rank": 1,
      "user_id": "uuid",
      "username": "BoltKing99",
      "avatar_url": "...",
      "level": 42,
      "rating": 2150,
      "wins": 312,
      "losses": 88,
      "win_rate": 78.0
    }
  ],
  "total": 98432
}
```

---

### `GET /leaderboard/me`
Authenticated user's leaderboard position + neighbours (±5 ranks).

---

## Economy / Web3

### `GET /economy/rates`
Current GMO ↔ ELDR exchange rates and limits.

**Response:**
```json
{
  "gmo_per_eldr": 1000,
  "min_eldr_deposit": "0.01",
  "max_eldr_withdraw": "100.0",
  "withdraw_fee_pct": 2.5
}
```

---

### `POST /economy/deposit`
Initiate ELDR → GMO deposit (on-chain tx required first).

**Request:** `{ "tx_hash": "0x...", "eldr_amount": "1.0" }`  
**Response `202`:** `{ "log_id": "uuid", "status": "PENDING", "gmo_expected": 1000 }`

---

### `POST /economy/withdraw`
Request GMO → ELDR withdrawal.

**Request:** `{ "gmo_amount": 5000 }`  
**Response `202`:** `{ "log_id": "uuid", "tx_hash": "0x...", "eldr_amount": "4.875", "fee_eldr": "0.125" }`

---

### `GET /economy/transactions`
User's transaction history.

**Query:** `type`, `status`, `limit`, `offset`

---

### `GET /economy/balance`
Real-time balances (DB + on-chain sync).

**Response:**
```json
{
  "gmo_balance": 12500,
  "eldr_balance_offchain": "3.141592653589793",
  "eldr_balance_onchain": "3.141592653589793",
  "synced_at": "2026-02-24T09:00:01Z"
}
```

---

## Admin Endpoints (🔒 ADMIN role required)

### `GET /admin/users` — List/search users
### `PATCH /admin/users/:id/ban` — Ban/unban user
### `POST /admin/robots/seed` — Re-seed robot catalogue
### `POST /admin/leaderboard/refresh` — Force leaderboard refresh
### `GET /admin/metrics` — System health metrics

---

## WebSocket Events

**Connection URL**: `wss://api.robowar.io/v2/ws`  
**Auth**: Pass `token` as query param on handshake: `?token=<access_token>`  
**Library**: Socket.IO v4

---

### Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `battle:join` | `{ battle_id }` | Join a battle room (player or spectator) |
| `battle:leave` | `{ battle_id }` | Leave battle room |
| `battle:ready` | `{ battle_id }` | Signal player is ready to start |
| `battle:emote` | `{ battle_id, emote_id }` | Send in-battle emote |
| `queue:join` | `{ mode, robot_id, algorithm_id, pilot_id, gmo_wager }` | Enter matchmaking |
| `queue:leave` | — | Exit matchmaking |
| `spectate:join` | `{ battle_id }` | Join spectator stream |
| `spectate:leave` | `{ battle_id }` | Leave spectator stream |
| `ping` | — | Keepalive |

---

### Server → Client Events

| Event | Payload | Description |
|---|---|---|
| `queue:matched` | `{ battle_id, opponent: UserSnap, biome, estimated_start_ms }` | Match found |
| `queue:updated` | `{ position, rating_range }` | Queue position update |
| `battle:starting` | `{ battle_id, countdown_ms }` | Battle countdown begun |
| `battle:tick` | `{ tick, p1_state, p2_state, biome_event, lcg_state }` | Live tick update |
| `battle:tick_batch` | `{ ticks: [...] }` | Batch of ticks (catchup / late join) |
| `battle:ended` | `{ winner_id, is_draw, total_ticks, gmo_delta, eldr_delta, rating_delta }` | Battle resolved |
| `battle:emote_received` | `{ from_player, emote_id }` | Opponent emote |
| `balance:updated` | `{ gmo_balance, eldr_balance }` | Balance changed server-side |
| `transaction:confirmed` | `{ tx_hash, type, eldr_amount, gmo_delta }` | On-chain tx confirmed |
| `notification` | `{ type, title, body, action_url }` | System notification |
| `error` | `{ code, message }` | Protocol error |
| `pong` | — | Keepalive reply |

---

### WebSocket Room Strategy

```
battle:{battle_id}     — Players + spectators for a single battle
user:{user_id}         — Private channel per user (balance updates, notifications)
queue:{mode}           — Matchmaking pool channel
leaderboard            — Broadcast leaderboard deltas (top-100 only)
```

---

## Error Codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request body invalid |
| 400 | `INSUFFICIENT_GMO` | Not enough GMO balance |
| 400 | `ALREADY_OWNED` | Robot already in roster |
| 400 | `ALGORITHM_INVALID` | Rule tree failed validation |
| 401 | `UNAUTHORIZED` | Missing or expired token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 403 | `USER_BANNED` | Account is banned |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `ALREADY_IN_QUEUE` | Already in matchmaking |
| 409 | `BATTLE_IN_PROGRESS` | Already in active battle |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `SERVICE_UNAVAILABLE` | Maintenance mode |

---

## Pagination

All list endpoints use offset pagination:

```json
{
  "data": [...],
  "total": 1042,
  "limit": 20,
  "offset": 0,
  "has_more": true
}
```

---

## Versioning

API versioning via URL prefix: `/v2/...`  
Breaking changes → new version. Old versions sunset after 6 months.
