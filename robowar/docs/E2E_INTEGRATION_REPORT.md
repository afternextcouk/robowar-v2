# ROBOWAR V2 — End-to-End Integration Report
**Task:** YPY-56  
**Author:** SELİN (Backend Lead)  
**Date:** 2026-02-24  
**Model:** Claude Sonnet 4.6  

---

## 1. Full Battle Flow Trace

```
MetaMask → Nonce → Sign → Verify → JWT → Socket Connect → Queue → Match → Battle → Result
```

### Step 1 — Wallet Connect (`useWallet.ts`)
```
Browser calls: eth_requestAccounts
→ MetaMask returns: accounts[], chainId
→ FE stores: address (lowercase), chainId in gameStore.wallet
```

### Step 2 — Nonce Request (`auth.ts` → `/api/auth/nonce/:address`)
```
FE: GET /v2/auth/nonce/:address
BE: Validates address regex (^0x[0-9a-fA-F]{40}$)
BE: crypto.randomBytes(16).toString('hex') → nonce
BE: Redis.setex(`metamask:nonce:${address}`, 300, nonce)
BE: Returns { nonce, message: "Sign this message to login to ROBOWAR: <nonce>" }
```

### Step 3 — Sign (`useWallet.ts`)
```
FE: eth.request({ method: 'personal_sign', params: [message, address] })
MetaMask: Prompts user to sign → returns signature string
```

### Step 4 — Verify & JWT Issue (`auth.ts` → `POST /api/auth/verify`)
```
FE: POST /v2/auth/verify { address, signature }
BE: Redis.get(`metamask:nonce:${address}`) → retrieve nonce
BE: ethers.verifyMessage(message, signature) → recoveredAddress
BE: Validates recoveredAddress === normalizedAddress
BE: Redis.del nonce (single-use invalidation)
BE: DB UPSERT into users WHERE wallet_address = $1
    - New user: INSERT with username=`player_${nonce.slice(0,8)}`, gmo_balance=1000
    - Existing: SELECT * WHERE wallet_address
BE: generateTokens(user):
    - access  = JWT signed with JWT_SECRET,   exp: 15m, payload: { sub, username }
    - refresh = JWT signed with JWT_REFRESH_SECRET, exp: 7d, payload: { sub, jti }
BE: Redis.setex(`auth:refresh:${refreshId}`, 604800, userId)
BE: Set-Cookie: refresh_token (httpOnly, sameSite=strict)
BE: Response: { user: { id, username, wallet_address, level, gmo_balance }, access_token, expires_in: 900 }
FE: authStore.setAccessToken(access_token)
FE: authStore.setUser({ id, username, wallet_address, gmo_balance, ... })
```

### Step 5 — Socket.IO Connection (`useSocket.ts`)
```
FE: io(SOCKET_URL, { path: '/v2/ws', auth: { token: accessToken }, transports: ['websocket'] })
BE: Socket.IO handshake → JWT middleware verifies auth.token
    (Note: matchmaking.ts namespace does NOT implement JWT check — see GAPS section)
```

### Step 6 — Join Matchmaking Queue
```
FE emits:    queue:join   { mode: 'RANKED', robot_id, algorithm_id? }
             (via useSocket.joinMatchmaking() → Lobby.handleFindBattle())

BE listens:  join_queue   { userId, robotId, tier, element, algorithmId }
             (matchmaking.ts, line ~110)

⚠️ MISMATCH — see Section 3
```

### Step 7 — Queue Confirmation
```
BE emits:    queue_joined  { position: 'searching', message: '...' }
FE listens:  queue:updated / matchmaking:joined
⚠️ MISMATCH — see Section 3
```

### Step 8 — Match Found
```
BE (matchmaking.ts): Every 2 seconds, findMatch() polls Redis queue
  - Finds best opponent by matchScore() (tier/element match, time-based relaxation)
  - After 30s wait: any match accepted (score forced to 0)
  - On match: removeFromQueue(both)
  - battleId = `battle_${Date.now()}_${random}`
  - startsAt = now + 3s
  - ns.to(socketId).emit('match_found', { battleId, opponent, startsAt }) → BOTH players

FE listens:  match_found  { battleId, opponent, startsAt }
  → navigate(`/battle/${data.battleId}`)
  ✅ Event name matches; battleId field matches.
```

### Step 9 — Battle Room Join
```
FE emits:    battle:join   { battle_id: battleId }
             (via useSocket.joinBattle())

BE listens:  battle_start  { battleId }
             (matchmaking.ts, line ~160)

⚠️ MISMATCH — see Section 3
```

### Step 10 — Battle Simulation (worker.ts)
```
BullMQ Worker "battle-simulation":
  1. Load battle record (JOIN matchmaking_entries P1/P2)
  2. Mark battle status = 'RUNNING'
  3. emit.toBattle(battleId, 'battle:started', { battleId })
  4. Load robots, algorithms, pilots from DB
  5. Build BattleConfig { seed, biome, maxTicks=100, p1Robot, p2Robot, ... }
  6. runBattle(config) → { ticks[], winner, totalTicks, finalP1Hp, finalP2Hp }
  7. Stream ticks: emit.toBattle(battleId, 'battle:tick', tick)
     - Every 10th tick: setImmediate() yield to avoid event-loop starve
  8. UPDATE battles SET status='COMPLETED', winner, winner_user_id, battle_log, total_ticks...
  9. emit.toBattle(battleId, 'battle:complete', { battleId, winner, winnerId, totalTicks, finalP1Hp, finalP2Hp })
```

### Step 11 — FE Tick Processing
```
FE listens:  battle:tick  (BattleTick type)
  - Determines myTick vs enmTick by comparing battle.myRobotId with tick.p1
  - Updates gameStore: turn, myHp, myEnergy, enemyHp, enemyEnergy
  - Appends BattleLogEntry if action !== 'IDLE'
  ✅ Event name matches (worker emits 'battle:tick', FE listens 'battle:tick')
```

### Step 12 — Battle Complete
```
BE worker emits:  battle:complete  { battleId, winner, winnerId, totalTicks, finalP1Hp, finalP2Hp }
FE listens:       battle:complete  (WsBattleEnded type: { winner_id, eldr_delta })
  → updateBattleState({ status: 'FINISHED', winner: data.winner_id, rewardEldr: data.eldr_delta })

⚠️ MISMATCH — see Section 3
```

---

## 2. Socket.IO Event Reference

### Client → Server

| FE Event Name   | FE Payload                                        | BE Listener     | BE Payload Expected                              | Status     |
|-----------------|---------------------------------------------------|-----------------|--------------------------------------------------|------------|
| `queue:join`    | `{ mode?, robot_id?, algorithm_id? }`             | `join_queue`    | `{ userId, robotId, tier, element, algorithmId }`| ❌ MISMATCH |
| `queue:leave`   | *(none)*                                          | `leave_queue`   | *(none)*                                         | ❌ MISMATCH |
| `battle:join`   | `{ battle_id: string }`                           | `battle_start`  | `{ battleId: string }`                           | ❌ MISMATCH |
| `battle:leave`  | `{ battle_id: string }`                           | *(none)*        | N/A                                              | ❌ MISSING  |
| `battle:ready`  | `{ battle_id: string }`                           | *(none)*        | N/A                                              | ❌ MISSING  |
| `ping`          | *(none)*                                          | *(none)*        | N/A                                              | ❌ MISSING  |
| `battle_turn`   | `{ battleId, turnData }`                          | `battle_turn`   | `{ battleId, turnData }`                         | ✅ MATCH    |
| `battle_end`    | `{ battleId, winnerId, result }`                  | `battle_end`    | `{ battleId, winnerId, result }`                 | ✅ MATCH    |

### Server → Client

| BE Event Name        | BE Payload                                                 | FE Listener          | Status     |
|----------------------|------------------------------------------------------------|----------------------|------------|
| `match_found`        | `{ battleId, opponent{userId,robotId,tier,element}, startsAt }` | `match_found`   | ✅ MATCH    |
| `queue_joined`       | `{ position, message }`                                    | `queue:updated` / `matchmaking:joined` | ❌ MISMATCH |
| `queue_left`         | `{ message }`                                              | `queue:left`         | ❌ MISMATCH |
| `battle:tick`        | BattleTick (worker)                                        | `battle:tick`        | ✅ MATCH    |
| `battle:started`     | `{ battleId }`                                             | *(none)*             | ❌ MISSING  |
| `battle:complete`    | `{ battleId, winner, winnerId, totalTicks, finalP1Hp, finalP2Hp }` | `battle:complete` | ⚠️ PARTIAL |
| `battle_turn`        | `{ battleId, turnData }` (relay)                           | *(none in useSocket)*| ❌ MISSING  |
| `matchmaking:joined` | *(never emitted by BE)*                                    | `matchmaking:joined` | ❌ DEAD     |
| `matchmaking:matched`| *(never emitted by BE)*                                    | `matchmaking:matched`| ❌ DEAD     |

---

## 3. Gaps & Mismatches

### 🔴 CRITICAL — Queue Join Event Name Mismatch
- **FE emits:** `queue:join` with `{ mode, robot_id, algorithm_id }`
- **BE listens:** `join_queue` with `{ userId, robotId, tier, element, algorithmId }`
- **Impact:** Players can NEVER enter the matchmaking queue. This is a total feature break.
- **Fix:** See Section 4.

### 🔴 CRITICAL — Queue Leave Event Name Mismatch
- **FE emits:** `queue:leave`
- **BE listens:** `leave_queue`
- **Impact:** Players cannot leave the queue; Redis entry persists until socket disconnect.

### 🔴 CRITICAL — Queue Confirmation Event Name Mismatch
- **BE emits:** `queue_joined` (underscore)
- **FE listens:** `queue:updated` (colon) and `matchmaking:joined` (colon prefix)
- **Impact:** FE matchStatus never transitions to `SEARCHING`. UI never shows "Looking for opponent".

### 🔴 CRITICAL — Queue Left Confirmation Mismatch
- **BE emits:** `queue_left`
- **FE types:** `queue:left`
- **Impact:** FE never receives queue-leave confirmation.

### 🔴 CRITICAL — Battle Room Join Event Name Mismatch
- **FE emits:** `battle:join` with `{ battle_id }` (snake_case field)
- **BE listens:** `battle_start` with `{ battleId }` (camelCase field)
- **Impact:** Sockets never join the `battle:${battleId}` room → no tick/complete events received.

### 🔴 CRITICAL — `battle:complete` Payload Field Name Mismatch
- **BE emits:** `{ battleId, winner, winnerId, totalTicks, finalP1Hp, finalP2Hp }`
- **FE expects:** `{ winner_id, eldr_delta }` (WsBattleEnded type)
- `winner_id` → BE sends `winnerId` (camelCase)
- `eldr_delta` → BE never sends this field (not computed in worker)
- **Impact:** FE always shows `winner: null`, reward always `null`. Victory/defeat overlay broken.

### 🟡 HIGH — Missing `battle:leave` Handler on BE
- **FE emits:** `battle:leave` with `{ battle_id }`
- **BE has no listener.** Socket stays in battle room silently.

### 🟡 HIGH — Missing `battle:ready` Handler on BE
- **FE emits:** `battle:ready` with `{ battle_id }`
- **BE has no listener.** Readiness is never tracked; no synchronized battle start possible.

### 🟡 HIGH — Missing `battle:started` Listener on FE
- **BE worker emits:** `battle:started` (first event when worker picks up battle)
- **FE never listens** for this event → FE doesn't know when battle actually started.

### 🟡 HIGH — Missing Socket JWT Auth in Matchmaking Namespace
- `matchmaking.ts` registers `ns.on('connection')` but never validates the JWT in `socket.handshake.auth`
- `userId` comes from the **client-supplied payload** — trivially spoofable
- **Fix:** Add auth middleware: `ns.use((socket, next) => { verifyJwt(socket.handshake.auth.token); next(); })`

### 🟡 HIGH — Queue Join Payload Missing `tier` and `element`
- FE sends `{ mode, robot_id, algorithm_id }` but BE requires `tier` and `element` for matchmaking quality scoring
- Even after fixing event name, the match scoring logic will default incorrectly

### 🟡 HIGH — `matchmaking:joined` / `matchmaking:matched` Events Are Dead
- These typed events appear in FE's `ServerToClientEvents` and Lobby.tsx listeners
- **BE never emits them.** They are FE-only aliases with no BE counterpart.
- **Fix:** Either remove from FE or have BE emit them.

### 🟢 LOW — `ping` / `pong` Keep-alive Unimplemented
- FE emits `ping` but BE has no `ping` listener and never emits `pong`

### 🟢 LOW — `eldr_delta` Not Computed
- FE expects `eldr_delta` in `battle:complete` for reward display
- Worker never computes or emits this; no on-chain/DB ELDR reward logic exists yet

---

## 4. Recommended Fixes

### Fix A — Align Socket Event Names (Backend: matchmaking.ts)
```typescript
// BEFORE (BE)
socket.on('join_queue', ...)
socket.on('leave_queue', ...)
socket.on('battle_start', ...)
socket.emit('queue_joined', ...)
socket.emit('queue_left', ...)

// AFTER (BE) — match FE naming convention
socket.on('queue:join', ...)
socket.on('queue:leave', ...)
socket.on('battle:join', ...)
socket.emit('queue:updated', ...)  // or 'queue:joined'
socket.emit('queue:left', ...)
```

### Fix B — Align Queue Join Payload (Backend: matchmaking.ts)
```typescript
// Accept FE payload shape
socket.on('queue:join', async (data: {
  mode?: string;
  robot_id?: string;       // was: robotId
  algorithm_id?: string;   // was: algorithmId
}) => {
  // Load tier + element from DB using robot_id
  const robot = await queryOne('SELECT tier, element FROM robots ... WHERE ur.id = $1', [data.robot_id]);
  const entry: QueueEntry = {
    socketId: socket.id,
    userId: socket.data.userId,  // from JWT middleware, not client payload!
    robotId: data.robot_id!,
    tier: robot.tier,
    element: robot.element,
    algorithmId: data.algorithm_id ?? 'default',
    joinedAt: Date.now(),
  };
  ...
```

### Fix C — Align `battle:complete` Payload (Backend: worker.ts)
```typescript
// BEFORE
emit.toBattle(battleId, 'battle:complete', {
  battleId, winner, winnerId, totalTicks, finalP1Hp, finalP2Hp
});

// AFTER — match WsBattleEnded type
emit.toBattle(battleId, 'battle:complete', {
  battle_id:   battleId,
  winner:      result.winner,       // 'P1' | 'P2' | 'DRAW'
  winner_id:   winnerId,            // UUID
  loser_id:    loserId,
  total_ticks: result.totalTicks,
  final_p1_hp: result.finalP1Hp,
  final_p2_hp: result.finalP2Hp,
  eldr_delta:  computedEldrReward,  // implement reward calculation
});
```

### Fix D — Add JWT Middleware to Matchmaking Namespace
```typescript
// matchmaking.ts — add before registerMatchmakingHandlers
ns.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('UNAUTHORIZED'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };
    socket.data.userId = payload.sub;
    next();
  } catch {
    next(new Error('UNAUTHORIZED'));
  }
});
```

### Fix E — Add `battle:leave`, `battle:ready`, `ping` Handlers (Backend)
```typescript
socket.on('battle:leave', (data: { battle_id: string }) => {
  socket.leave(`battle:${data.battle_id}`);
});

socket.on('battle:ready', (data: { battle_id: string }) => {
  ns.to(`battle:${data.battle_id}`).emit('battle:player_ready', {
    user_id: socket.data.userId,
    username: socket.data.username,
  });
});

socket.on('ping', () => {
  socket.emit('pong');
});
```

### Fix F — Align `battle:join` Payload Field Name
```typescript
// Backend: listen for snake_case OR camelCase
socket.on('battle:join', (data: { battle_id?: string; battleId?: string }) => {
  const id = data.battle_id ?? data.battleId;
  socket.join(`battle:${id}`);
  socket.emit('battle:joined', { battle_id: id });
});
```

---

## 5. Docker Startup Sequence

```bash
# 1. Start infrastructure
docker-compose up -d

# Services started:
#   postgres:5432    — wait for healthcheck (pg_isready)
#   redis:6379       — wait for healthcheck (redis-cli ping)
#   backend:3000     — depends_on: [postgres, redis]
#   worker:*         — depends_on: [postgres, redis]
#   frontend:5173    — depends_on: [backend] (optional, can be separate)

# 2. Run DB migrations (once postgres healthy)
docker-compose exec backend npm run migrate
# OR
docker-compose run --rm migrate

# 3. Seed reference data (robots, biomes, default algorithms)
docker-compose exec backend npm run seed

# 4. Verify services ready
curl http://localhost:3000/health          # → { status: 'ok', db: 'ok', redis: 'ok' }
curl http://localhost:3000/api/auth/nonce/0x0000000000000000000000000000000000000000
# → 400 validation error (proves auth router is live)

# 5. Worker status
docker-compose logs worker --tail=20
# Should show: "🤖 ROBOWAR Worker online"
```

### docker-compose.yml Expected Service Order
```
postgres → redis → (backend + worker) → frontend
```

### Health Check Dependencies
| Service  | Depends On         | Healthcheck              |
|----------|--------------------|--------------------------|
| postgres | —                  | `pg_isready -U $PG_USER` |
| redis    | —                  | `redis-cli ping`         |
| backend  | postgres, redis    | `GET /health`            |
| worker   | postgres, redis    | process exit code        |
| frontend | backend (optional) | HTTP 200 on port 5173    |

---

## 6. Summary Table

| Phase           | Status | Notes                                            |
|-----------------|--------|--------------------------------------------------|
| Wallet Connect  | ✅ OK   | MetaMask integration correct                     |
| Nonce Request   | ✅ OK   | Redis TTL 5min, regex validated                  |
| Sign & Verify   | ✅ OK   | ethers.verifyMessage, nonce single-use           |
| JWT Issue       | ✅ OK   | Dual token (access 15m + refresh 7d), Redis jti  |
| Socket Connect  | ⚠️ GAP | No JWT auth middleware on matchmaking namespace  |
| Queue Join      | ❌ FAIL | Event name mismatch + payload shape mismatch     |
| Queue Confirm   | ❌ FAIL | BE emits `queue_joined`, FE listens `queue:updated`|
| Match Found     | ✅ OK   | `match_found` event + battleId field aligns      |
| Battle Room Join| ❌ FAIL | `battle:join` vs `battle_start` + field name     |
| Battle Ticks    | ✅ OK   | `battle:tick` matches on both sides              |
| Battle Complete | ⚠️ PARTIAL | Event name OK; payload fields camelCase/snake_case mismatch |
| ELDR Reward     | ❌ FAIL | `eldr_delta` never computed or emitted           |
