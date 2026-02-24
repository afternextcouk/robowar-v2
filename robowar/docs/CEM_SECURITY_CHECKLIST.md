# CEM_SECURITY_CHECKLIST.md — ROBOWAR V2 Security Checklist

**Reviewer:** CEM (Code Reviewer & Security Specialist) — Claude Sonnet 4.6
**Date:** 2026-02-24
**Ticket:** YPY-43

---

## 1. OWASP Top 10 Coverage (2021)

| # | Category | Status | Notes |
|---|----------|--------|-------|
| A01 | **Broken Access Control** | ⚠️ PARTIAL | `requireAuth` JWT middleware is solid. Admin check via DB query is correct. **Gap:** Socket.IO matchmaking namespace does NOT verify userId from JWT — client can spoof `data.userId` in `join_queue`. |
| A02 | **Cryptographic Failures** | ⚠️ PARTIAL | Passwords hashed with `bcrypt` (rounds=12) ✅. JWT `HS256` used (symmetric — acceptable for single-service). **CRITICAL GAP:** JWT secret falls back to `"dev_secret"` if env var missing. Refresh tokens stored in HttpOnly cookie ✅. |
| A03 | **Injection** | ✅ PASS | All SQL queries use parameterized `$1,$2` placeholders via `pg` client. No raw string interpolation of user values. No eval/Function usage found. Algorithm `rule_tree` is stored as JSON JSONB — no SQL injection risk from its content. |
| A04 | **Insecure Design** | ❌ FAIL | Robot purchase not in DB transaction (race condition possible). No refresh token revocation design. Battle simulation worker is a stub — no actual secure simulation flow exists yet. |
| A05 | **Security Misconfiguration** | ⚠️ PARTIAL | Helmet enabled ✅. CORS configured ✅. ContentSecurityPolicy **disabled in non-production** — XSS won't be caught in development. No HTTPS-redirect middleware. JWT secret fallback (see A02). |
| A06 | **Vulnerable and Outdated Components** | ⚠️ UNKNOWN | Package versions not audited in this review. Recommend running `npm audit` and pinning critical deps (`jsonwebtoken`, `bcryptjs`, `express`). |
| A07 | **Identification and Authentication Failures** | ⚠️ PARTIAL | Login rate-limited (10 req/min) ✅. bcrypt password hashing ✅. Banned user check on login ✅. **Gap:** No refresh token rotation. No MetaMask wallet auth. No brute-force lockout beyond rate limiting. |
| A08 | **Software and Data Integrity Failures** | ⚠️ PARTIAL | Algorithm `rule_tree` stored without schema validation — arbitrary data ingested. BullMQ jobs use `jobId` deduplication ✅ (prevents duplicate battle runs). No subresource integrity for frontend (N/A — handled at Vercel). |
| A09 | **Security Logging and Monitoring** | ⚠️ PARTIAL | Winston logger used ✅. Slow query logging (>500ms) ✅. Worker job failures logged ✅. **Gaps:** No audit log for admin actions (ban, unban). No alert on repeated auth failures. No login anomaly detection. |
| A10 | **Server-Side Request Forgery (SSRF)** | ✅ N/A | No outbound HTTP calls based on user-supplied URLs identified. Transaction watch worker will call blockchain RPC (TODO) — when implemented, ensure RPC URL is from env var only, never from user input. |

---

## 2. Web3-Specific Security

### 2.1 Reentrancy
**Status: N/A (Off-chain)**
ROBOWAR V2 is an off-chain game with ELDR as ERC-20. No smart contracts handle game logic. The token contract itself (external) is assumed standard ERC-20 — reentrancy risk applies to the contract, not this backend. No on-chain game state mutations exist in the backend code.

**Recommendation:** When implementing ELDR deposit/withdraw, ensure:
- Deposits: verify tx on-chain before crediting off-chain balance (event-driven, not user-triggered)
- Withdrawals: debit off-chain balance first (in DB transaction), then submit on-chain tx; use a job queue for retries

### 2.2 Front-Running
**Status: N/A (Current state) / FUTURE RISK**
No on-chain settlement currently. If GMO→ELDR exchange or battle wagers ever settle on-chain, front-running risk applies. Mitigation: commit-reveal scheme for battle outcomes before publishing on-chain.

### 2.3 Oracle Manipulation
**Status: N/A**
No price oracles used. GMO/ELDR exchange rates are hardcoded in `economy.ts` (`gmo_per_eldr: 1000`). If rates become dynamic from an oracle, add TWAP and sanity-check bounds.

### 2.4 Signature Verification (Wallet Auth — NOT YET IMPLEMENTED)
When MetaMask auth is implemented, required security controls:

```
✅ Required Controls:
□ EIP-191 personal_sign message format (not raw RLP)
□ Nonce stored in Redis with TTL ≤ 5 minutes
□ Nonce is single-use (invalidate before returning JWT)
□ Nonce is bound to wallet address (prevent cross-address reuse)
□ Signature verification using ethers.js verifyMessage() server-side
□ Wallet address lowercased before storage (case-normalization)
□ Include domain + chain ID in signed message (EIP-4361 / Sign-In-With-Ethereum recommended)
□ Replay attack: timestamp in message + server-side expiry check
```

### 2.5 BigInt / Token Amount Safety
- Current `gmo_balance` stored as INTEGER — safe for game tokens where max value is predictable
- `eldr_balance` stored/returned as string — correct to avoid JS float precision issues
- **Required:** When implementing ELDR arithmetic server-side, use `ethers.BigNumber` or `Decimal.js`; never `parseFloat()` or `Number()` on token amounts

---

## 3. Algorithm Anti-Cheat: Server-Side Validation Requirements

The ROBOWAR V2 algorithm system must enforce these controls to prevent cheating:

### 3.1 Algorithm Submission Validation (on POST/PUT)
```
✅ Currently Missing — Must Implement:
□ Maximum rules: 50 per algorithm
□ Maximum condition tree depth: 10 levels (AND/OR nesting)
□ Valid action.type values: enum check against ActionType
□ Valid condition.type values: enum check against ConditionNode types
□ Valid variable names in COMPARE conditions: whitelist ["self.hp", "self.hp_pct", "self.energy", ...]
□ Numeric bounds on condition values (e.g., hp_pct must be 0–100)
□ Maximum total JSON size: 50KB
□ rule_tree.version must match current engine version
```

### 3.2 Battle Execution Server-Side Requirements
```
✅ Currently Missing — Must Implement:
□ Battle simulation MUST run entirely server-side (engine/src/ or engine/ — never on client)
□ Seed MUST be generated server-side and NOT disclosed to players before battle ends
□ LCG state snapshots per tick MUST be stored to enable replay verification
□ Algorithm rules MUST be fetched from DB at battle start (not from client socket payload)
□ Robot stats MUST be fetched from DB at battle start (not trusted from client)
□ Battle results MUST be computed server-side and stored before emitting to clients
□ Clients should receive only: tick result, final HP, winner — not raw RNG state
```

### 3.3 Matchmaking Anti-Cheat
```
□ Algorithm `is_valid` flag MUST be verified before queueing (currently done ✅)
□ Robot ownership MUST be verified before queueing (currently done ✅)
□ GMO wager amount MUST be validated against user balance before queueing (NOT currently done)
□ Re-verify ownership and algorithm validity at battle start (not just queue entry time)
```

### 3.4 Replay Integrity
```
□ Store LCG seed in battles table (currently: lcg_seed column exists ✅)
□ Store full tick log as JSONB (currently: battle_log column exists ✅)
□ Replay verification: re-run engine with same seed + same algorithms → must produce identical result
□ Expose replay endpoint only after battle is COMPLETED (currently done ✅)
```

---

## 4. Rate Limiting Recommendations

### 4.1 Current Rate Limits (app.ts)
| Endpoint | Window | Max | Assessment |
|----------|--------|-----|------------|
| `/v2/auth` | 60s | 10 | ✅ Good for auth |
| `/v2/*` | 60s | 100 | ⚠️ Too permissive for some endpoints |

### 4.2 Recommended Per-Endpoint Limits

| Endpoint | Window | Recommended Max | Reason |
|----------|--------|-----------------|--------|
| `POST /auth/register` | 60min | 5 per IP | Account creation abuse |
| `POST /auth/login` | 15min | 10 per IP | Brute force |
| `POST /auth/refresh` | 60s | 30 | Token refresh flood |
| `POST /battles/queue` | 60s | 5 per user | Matchmaking abuse |
| `POST /algorithms` | 60s | 10 per user | Storage DoS |
| `PUT /algorithms/:id` | 60s | 20 per user | Update spam |
| `POST /robots/:id/purchase` | 60s | 5 per user | Race condition amplification |
| `GET /battles` | 60s | 30 per user | Data scraping |
| `GET /leaderboard` | 60s | 10 per IP | Scraping |

### 4.3 Socket.IO Rate Limiting (Missing)
No Socket.IO event-level rate limiting exists. Recommended:

| Event | Limit |
|-------|-------|
| `battle:emote` | 5/second |
| `battle:join` | 2/second |
| `queue:join` | 1 per 10s |
| `join_queue` (matchmaking ns) | 1 per 5s |
| `battle_turn` | 10/second |

**Implementation:** Use in-memory token bucket per socket, or Redis-backed counter for multi-instance deployments.

### 4.4 Admin Endpoint Security
Admin endpoints currently use `requireAdmin` which checks DB role — correct. Additionally recommend:
- IP allowlisting for `/v2/admin/*` via nginx/ingress (restrict to trusted networks)
- Separate rate limit: 10 requests/minute on admin routes
- Audit log for all admin actions

---

## 5. HTTP Security Headers Audit

| Header | Status | Notes |
|--------|--------|-------|
| `X-Content-Type-Options` | ✅ Set by Helmet | `nosniff` |
| `X-Frame-Options` | ✅ Set by Helmet | `DENY` |
| `X-XSS-Protection` | ✅ Set by Helmet | |
| `Strict-Transport-Security` | ✅ Set by Helmet | (production only) |
| `Content-Security-Policy` | ⚠️ Production only | Missing in development — add minimal CSP to catch issues early |
| `Referrer-Policy` | ✅ Set by Helmet | |
| `Permissions-Policy` | ❓ Unknown | Check Helmet version supports this |

---

## 6. Secrets & Environment Variables

### Required Production Env Vars (MUST validate on startup)
```
JWT_SECRET          — min 32 random bytes, base64
JWT_REFRESH_SECRET  — min 32 random bytes, base64
DATABASE_URL        — PostgreSQL connection string
REDIS_URL           — Redis connection string
CORS_ORIGIN         — comma-separated allowed origins
NODE_ENV            — must be "production"
```

### Missing Vars (for future features)
```
ETHERS_RPC_URL      — Ethereum RPC for tx watching
ELDR_CONTRACT_ADDR  — ELDR token contract address
ADMIN_JWT_SECRET    — Separate secret for admin tokens (recommended)
```

### Startup Validation Recommendation
Add to `backend/src/index.ts`:
```typescript
const REQUIRED_ENV = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'REDIS_URL'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FATAL: Required env var ${key} is not set`);
    process.exit(1);
  }
}
```

---

*Report generated by CEM — Code Reviewer & Security Specialist*
*ROBOWAR V2 — YPY-43*
