# ROBOWAR V2 — Deployment Checklist
**Task:** YPY-56  
**Author:** SELİN (Backend Lead)  
**Date:** 2026-02-24  

---

## ✅ Pre-Deploy Environment Variables

### Backend (Required — will crash on missing)
| Variable              | Description                                  | Example / Notes                          |
|-----------------------|----------------------------------------------|------------------------------------------|
| `JWT_SECRET`          | Access token signing secret                  | ≥32 random chars, never reuse            |
| `JWT_REFRESH_SECRET`  | Refresh token signing secret                 | ≥32 random chars, different from above   |
| `DATABASE_URL`        | PostgreSQL connection string                 | `postgres://user:pass@host:5432/robowar` |
| `REDIS_URL`           | Redis connection URL                         | `redis://host:6379`                      |
| `NODE_ENV`            | Runtime environment                          | `production` / `development`             |

### Backend (Optional but Recommended)
| Variable              | Description                                  | Default                                  |
|-----------------------|----------------------------------------------|------------------------------------------|
| `PORT`                | HTTP listen port                             | `3000`                                   |
| `LOG_LEVEL`           | Logger verbosity                             | `info`                                   |
| `CORS_ORIGIN`         | Allowed frontend origin                      | `http://localhost:5173`                  |
| `POLYGON_RPC_URL`     | Polygon JSON-RPC for on-chain verification   | (required for TX watch worker)           |
| `ELDR_CONTRACT_ADDR`  | ELDR ERC-20 contract address                 | (required for token rewards)             |
| `BULLMQ_CONCURRENCY`  | Worker job concurrency override              | `4` (battle), `2` (matchmaking)          |

### Frontend (Vite env vars — must be prefixed `VITE_`)
| Variable              | Description                                  | Example                                  |
|-----------------------|----------------------------------------------|------------------------------------------|
| `VITE_API_URL`        | Backend base URL                             | `https://api.robowar.io`                 |
| `VITE_WS_URL`         | Socket.IO server URL (if different)          | Same as `VITE_API_URL`                   |
| `VITE_CHAIN_ID`       | Required Ethereum chain ID                   | `137` (Polygon Mainnet)                  |

### Docker Compose Secrets (recommended over plain env)
```yaml
secrets:
  jwt_secret:
    external: true
  jwt_refresh_secret:
    external: true
  db_password:
    external: true
```

---

## 🗄️ Database Migration Steps

### Using docker-compose
```bash
# 1. Start DB only
docker-compose up -d postgres

# 2. Wait for healthy state
docker-compose exec postgres pg_isready -U $POSTGRES_USER -d robowar

# 3. Run migrations
docker-compose exec backend npm run migrate
# OR using a one-off container:
docker-compose run --rm --no-deps backend npm run migrate

# 4. Verify migration state
docker-compose exec postgres psql -U $POSTGRES_USER -d robowar \
  -c "SELECT version, name, executed_at FROM schema_migrations ORDER BY version DESC LIMIT 5;"
```

### Manual (no compose)
```bash
DATABASE_URL=postgres://user:pass@host:5432/robowar npm run migrate
```

### Required Tables (post-migration verification)
```sql
-- Verify core tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected tables:
-- algorithms, battles, matchmaking_entries, matchmaking_queue,
-- pilots, robots, schema_migrations, user_robots, users
```

### Seed Reference Data
```bash
# Seed robots, biomes, default algorithms
docker-compose exec backend npm run seed

# Verify
docker-compose exec postgres psql -U $POSTGRES_USER -d robowar \
  -c "SELECT COUNT(*) FROM robots; SELECT COUNT(*) FROM algorithms;"
```

### Materialized View (Leaderboard)
```sql
-- Create initial leaderboard view (if not in migration)
REFRESH MATERIALIZED VIEW leaderboard_view;

-- Verify
SELECT * FROM leaderboard_view LIMIT 5;
```

---

## 🏥 Health Check Endpoints

### Backend REST
| Endpoint                          | Expected Response                          | Notes                               |
|-----------------------------------|--------------------------------------------|-------------------------------------|
| `GET /health`                     | `200 { status: 'ok', db: 'ok', redis: 'ok' }` | Main health check                |
| `GET /v2/auth/nonce/0x000...000`  | `400 { error: 'VALIDATION_ERROR' }`        | Auth router alive (invalid address) |
| `GET /v2/auth/nonce/0x742d35Cc6634C0532925a3b844Bc454e4438f44e` | `200 { nonce, message }` | Full nonce flow |
| `GET /metrics`                    | Prometheus metrics (if configured)         | Optional                            |

### Socket.IO
```bash
# Confirm WS upgrade works
curl -i "http://localhost:3000/v2/ws/?EIO=4&transport=polling"
# → 200 with Socket.IO handshake JSON

# Or use wscat
wscat -c "ws://localhost:3000/v2/ws/?EIO=4&transport=websocket"
```

### Redis
```bash
docker-compose exec redis redis-cli ping
# → PONG

# Check matchmaking queue (should be empty at startup)
docker-compose exec redis redis-cli hlen robowar:matchmaking:queue
# → 0
```

### PostgreSQL
```bash
docker-compose exec postgres pg_isready -U $POSTGRES_USER
# → localhost:5432 - accepting connections
```

### Worker
```bash
# Check BullMQ queues via Redis
docker-compose exec redis redis-cli keys "bull:*"
# Should see: bull:battle-simulation:*, bull:matchmaking:*, etc.

# Worker logs
docker-compose logs worker --tail=50
# Should contain: "🤖 ROBOWAR Worker online"
```

---

## 🧪 Smoke Test Commands

### 1. Register a test user
```bash
curl -s -X POST http://localhost:3000/v2/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"smoketest1","email":"smoke1@test.com","password":"password123"}' \
  | jq '.access_token'
# → "eyJ..." (JWT string)
```

### 2. Login
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/v2/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke1@test.com","password":"password123"}' \
  | jq -r '.access_token')
echo "Token: $TOKEN"
```

### 3. Token Refresh
```bash
# Uses the httpOnly cookie set during login
curl -s -X POST http://localhost:3000/v2/auth/refresh \
  --cookie-jar /tmp/cookies.txt --cookie /tmp/cookies.txt \
  | jq '.access_token'
```

### 4. MetaMask Nonce Flow (automated)
```bash
# Get nonce for a test address
curl -s http://localhost:3000/v2/auth/nonce/0x742d35Cc6634C0532925a3b844Bc454e4438f44e \
  | jq .
# → { nonce: "...", message: "Sign this message to login to ROBOWAR: ..." }
```

### 5. Socket.IO Connect Smoke Test
```bash
# Install: npm install -g socket.io-client-tool (or use Node.js script)
node -e "
const { io } = require('socket.io-client');
const s = io('http://localhost:3000', {
  path: '/v2/ws',
  auth: { token: '$TOKEN' },
  transports: ['websocket']
});
s.on('connect', () => { console.log('✅ Socket connected:', s.id); process.exit(0); });
s.on('connect_error', (e) => { console.error('❌ Connect error:', e.message); process.exit(1); });
setTimeout(() => { console.error('❌ Timeout'); process.exit(1); }, 5000);
"
```

### 6. Queue Join Smoke Test (after event name fix applied)
```bash
node -e "
const { io } = require('socket.io-client');
const s = io('http://localhost:3000', { path: '/v2/ws', auth: { token: '$TOKEN' }, transports: ['websocket'] });
s.on('connect', () => {
  s.emit('queue:join', { mode: 'RANKED', robot_id: 'test-robot-id' });
});
s.on('queue:updated', (d) => { console.log('✅ Queue joined:', d); process.exit(0); });
s.on('error', (e) => { console.error('❌ Error:', e); process.exit(1); });
setTimeout(() => { console.error('❌ Timeout waiting for queue:updated'); process.exit(1); }, 5000);
"
```

### 7. Database Integrity Check
```bash
docker-compose exec postgres psql -U $POSTGRES_USER -d robowar -c "
SELECT
  (SELECT COUNT(*) FROM users)             AS users,
  (SELECT COUNT(*) FROM robots)            AS robots,
  (SELECT COUNT(*) FROM algorithms)        AS algorithms,
  (SELECT COUNT(*) FROM battles)           AS battles,
  (SELECT COUNT(*) FROM matchmaking_queue) AS queue_entries;
"
```

### 8. Worker Battle Simulation Smoke Test
```bash
# Enqueue a test battle (requires valid battle record in DB)
node -e "
const { Queue } = require('bullmq');
const { createClient } = require('redis');
const redis = createClient({ url: 'redis://localhost:6379' });
redis.connect().then(async () => {
  const q = new Queue('battle-simulation', { connection: redis });
  await q.add('simulate', { battleId: 'test-battle-uuid-here' }, { jobId: 'smoke-test-1' });
  console.log('✅ Job enqueued');
  await redis.quit();
});
"
# Check worker logs for processing
docker-compose logs worker --follow --tail=20
```

---

## 🚀 Full Deployment Sequence

```bash
# 1. Pull latest images / build
docker-compose pull
docker-compose build

# 2. Start infrastructure
docker-compose up -d postgres redis

# 3. Wait for health
sleep 5
docker-compose exec postgres pg_isready

# 4. Migrate + seed
docker-compose run --rm --no-deps backend npm run migrate
docker-compose run --rm --no-deps backend npm run seed

# 5. Start backend + worker + frontend
docker-compose up -d backend worker frontend

# 6. Verify all healthy
docker-compose ps
curl -f http://localhost:3000/health && echo "✅ Backend OK"

# 7. Tail logs for 30s to catch startup errors
docker-compose logs -f --tail=50 2>&1 | timeout 30 cat
```

---

## ⚠️ Known Issues (Pre-Fix State)

> These must be resolved before matchmaking is functional. See `E2E_INTEGRATION_REPORT.md` Section 3 & 4.

- [ ] Socket event name mismatches block queue join/leave
- [ ] `battle:complete` payload uses camelCase on BE, snake_case expected by FE
- [ ] No JWT auth in Socket.IO matchmaking namespace
- [ ] `eldr_delta` reward not computed by worker
- [ ] `battle:ready` / `battle:leave` unhandled on backend
