# ROBOWAR V2 — Database Schema

> **Engine**: PostgreSQL 16  
> **Managed by**: `backend/src/db/migrations/`  
> **ORM**: Raw SQL with `pg` (no ORM — performance-first)

---

## 1. `users`

Primary player identity table. Stores credentials and Web3 wallet.

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(32) NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  wallet_address VARCHAR(42) UNIQUE,           -- EVM checksummed address
  gmo_balance   BIGINT NOT NULL DEFAULT 0,     -- Golden Motor Oil (in-game, µGMO)
  eldr_balance  NUMERIC(36,18) NOT NULL DEFAULT 0, -- ELDR ERC-20 mirror (read-only)
  xp            INTEGER NOT NULL DEFAULT 0,
  level         SMALLINT NOT NULL DEFAULT 1,
  avatar_url    TEXT,
  is_banned     BOOLEAN NOT NULL DEFAULT FALSE,
  ban_reason    TEXT,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_level ON users(level DESC);
```

---

## 2. `pilots`

Pilot NFTs / profiles. Each user can own multiple pilots (skins/stat bonuses).

```sql
CREATE TYPE pilot_rarity AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

CREATE TABLE pilots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(64) NOT NULL,
  rarity        pilot_rarity NOT NULL DEFAULT 'COMMON',
  nft_token_id  BIGINT,                        -- On-chain token ID (nullable if not minted)
  sprite_key    VARCHAR(64) NOT NULL,           -- Asset key in sprite atlas
  -- Stat modifiers (percentage, e.g. 5 = +5%)
  stat_hp_mod        SMALLINT NOT NULL DEFAULT 0,
  stat_attack_mod    SMALLINT NOT NULL DEFAULT 0,
  stat_defense_mod   SMALLINT NOT NULL DEFAULT 0,
  stat_speed_mod     SMALLINT NOT NULL DEFAULT 0,
  stat_energy_mod    SMALLINT NOT NULL DEFAULT 0,
  battles_fought INTEGER NOT NULL DEFAULT 0,
  battles_won    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pilots_user ON pilots(user_id);
CREATE INDEX idx_pilots_nft ON pilots(nft_token_id) WHERE nft_token_id IS NOT NULL;
```

---

## 3. `robots`

Master robot catalogue. 36 robots × 6 elements = base table (seeded, read-mostly).

```sql
CREATE TYPE element_type AS ENUM ('VOLT', 'PYRO', 'CRYO', 'NANO', 'VOID', 'IRON');
CREATE TYPE robot_tier AS ENUM ('T1', 'T2', 'T3');

CREATE TABLE robots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            VARCHAR(64) NOT NULL UNIQUE,  -- e.g. 'volt-striker-mk1'
  display_name    VARCHAR(64) NOT NULL,
  element         element_type NOT NULL,
  tier            robot_tier NOT NULL DEFAULT 'T1',
  sprite_atlas    VARCHAR(128) NOT NULL,
  -- Base stats
  base_hp         SMALLINT NOT NULL,
  base_attack     SMALLINT NOT NULL,
  base_defense    SMALLINT NOT NULL,
  base_speed      SMALLINT NOT NULL,
  base_energy     SMALLINT NOT NULL,           -- Max energy per turn
  energy_regen    SMALLINT NOT NULL DEFAULT 2, -- Energy gained per tick
  -- Elemental affinities (0-100, who this robot deals/takes extra damage from)
  strong_vs       element_type[],              -- deals +25% dmg
  weak_vs         element_type[],              -- takes +25% dmg
  -- Biome bonuses
  biome_bonus     JSONB NOT NULL DEFAULT '{}', -- {"GRASSLAND": 10, "DESERT": 5, ...}
  -- Economy
  gmo_cost        INTEGER NOT NULL DEFAULT 500,
  is_starter      BOOLEAN NOT NULL DEFAULT FALSE,
  unlock_level    SMALLINT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_robots_element ON robots(element);
CREATE INDEX idx_robots_tier ON robots(tier);

-- Junction: user → owned robots
CREATE TABLE user_robots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  robot_id    UUID NOT NULL REFERENCES robots(id),
  nickname    VARCHAR(64),
  -- Per-user upgrades (level 1–5)
  upgrade_hp        SMALLINT NOT NULL DEFAULT 0,
  upgrade_attack    SMALLINT NOT NULL DEFAULT 0,
  upgrade_defense   SMALLINT NOT NULL DEFAULT 0,
  upgrade_speed     SMALLINT NOT NULL DEFAULT 0,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, robot_id)
);

CREATE INDEX idx_user_robots_user ON user_robots(user_id);
```

---

## 4. `algorithms`

Player-authored IF-THEN battle algorithms stored as JSON AST.

```sql
CREATE TYPE algorithm_status AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TABLE algorithms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(128) NOT NULL,
  description   TEXT,
  status        algorithm_status NOT NULL DEFAULT 'DRAFT',
  -- The algorithm as a validated JSON rule tree
  -- Schema: { version: 2, rules: [{ priority: int, condition: CondNode, action: ActionNode }] }
  rule_tree     JSONB NOT NULL DEFAULT '{"version":2,"rules":[]}',
  -- Validation metadata
  is_valid      BOOLEAN NOT NULL DEFAULT FALSE,
  validation_errors JSONB,
  -- Analytics
  times_used    INTEGER NOT NULL DEFAULT 0,
  win_rate      NUMERIC(5,2),                  -- Computed, cached
  -- Versioning
  version       SMALLINT NOT NULL DEFAULT 1,
  parent_id     UUID REFERENCES algorithms(id), -- Fork lineage
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_algorithms_user ON algorithms(user_id);
CREATE INDEX idx_algorithms_status ON algorithms(status);

-- Full-text search on algorithm name
CREATE INDEX idx_algorithms_name_fts ON algorithms USING gin(to_tsvector('english', name));
```

### Algorithm Rule Tree JSON Schema

```json
{
  "version": 2,
  "rules": [
    {
      "priority": 1,
      "condition": {
        "type": "AND",
        "children": [
          { "type": "COMPARE", "left": "self.hp", "op": "<", "right": 30 },
          { "type": "COMPARE", "left": "self.energy", "op": ">=", "right": 5 }
        ]
      },
      "action": {
        "type": "SKILL",
        "skillId": "heal_burst",
        "target": "SELF"
      }
    }
  ]
}
```

**Condition Types**: `AND`, `OR`, `NOT`, `COMPARE`, `IN_BIOME`, `ENEMY_ELEMENT`, `TURN_MOD`  
**Action Types**: `ATTACK`, `SKILL`, `DEFEND`, `MOVE`, `CHARGE_ENERGY`, `IDLE`

---

## 5. `battles`

Each PvP or PvE encounter. Records full tick-by-tick log.

```sql
CREATE TYPE battle_status AS ENUM (
  'MATCHMAKING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED'
);
CREATE TYPE biome_type AS ENUM ('GRASSLAND', 'DESERT', 'SNOWFIELD', 'CITY');
CREATE TYPE battle_mode AS ENUM ('RANKED', 'CASUAL', 'TOURNAMENT', 'AI');

CREATE TABLE battles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode            battle_mode NOT NULL DEFAULT 'CASUAL',
  status          battle_status NOT NULL DEFAULT 'MATCHMAKING',
  biome           biome_type NOT NULL,
  -- Players
  player1_id      UUID NOT NULL REFERENCES users(id),
  player2_id      UUID REFERENCES users(id),             -- NULL = PvE/AI
  player1_robot_id  UUID NOT NULL REFERENCES user_robots(id),
  player2_robot_id  UUID REFERENCES user_robots(id),
  player1_algo_id   UUID NOT NULL REFERENCES algorithms(id),
  player2_algo_id   UUID REFERENCES algorithms(id),
  player1_pilot_id  UUID REFERENCES pilots(id),
  player2_pilot_id  UUID REFERENCES pilots(id),
  -- Outcome
  winner_id       UUID REFERENCES users(id),             -- NULL = draw/cancelled
  is_draw         BOOLEAN NOT NULL DEFAULT FALSE,
  total_ticks     SMALLINT,
  -- LCG Seed (deterministic replay)
  lcg_seed        BIGINT NOT NULL,
  -- Full battle log (tick snapshots, gzip-compressed JSON stored as bytea)
  battle_log      JSONB,                                 -- Uncompressed for recent
  battle_log_gz   BYTEA,                                 -- Compressed for archive
  -- Economy
  gmo_wagered     INTEGER NOT NULL DEFAULT 0,
  gmo_winner_gain INTEGER,
  eldr_wagered    NUMERIC(36,18) NOT NULL DEFAULT 0,
  eldr_winner_gain NUMERIC(36,18),
  -- Timestamps
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_battles_player1 ON battles(player1_id);
CREATE INDEX idx_battles_player2 ON battles(player2_id);
CREATE INDEX idx_battles_status ON battles(status);
CREATE INDEX idx_battles_mode ON battles(mode);
CREATE INDEX idx_battles_created ON battles(created_at DESC);
CREATE INDEX idx_battles_biome ON battles(biome);
```

---

## 6. `energy_logs`

GMO / ELDR energy economy ledger. Every credit/debit is recorded.

```sql
CREATE TYPE energy_action AS ENUM (
  'BATTLE_WIN',
  'BATTLE_LOSS',
  'BATTLE_WAGER',
  'ROBOT_PURCHASE',
  'ALGORITHM_SAVE',
  'DAILY_REWARD',
  'TOURNAMENT_PRIZE',
  'ELDR_DEPOSIT',
  'ELDR_WITHDRAW',
  'ADMIN_GRANT',
  'REFUND'
);

CREATE TABLE energy_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action        energy_action NOT NULL,
  -- GMO change (signed integer, negative = debit)
  gmo_delta     BIGINT NOT NULL DEFAULT 0,
  gmo_balance_after BIGINT NOT NULL,
  -- ELDR change
  eldr_delta    NUMERIC(36,18) NOT NULL DEFAULT 0,
  eldr_balance_after NUMERIC(36,18) NOT NULL DEFAULT 0,
  -- Context
  ref_battle_id UUID REFERENCES battles(id),
  ref_tx_hash   VARCHAR(66),                   -- On-chain tx hash
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_energy_logs_user ON energy_logs(user_id);
CREATE INDEX idx_energy_logs_action ON energy_logs(action);
CREATE INDEX idx_energy_logs_created ON energy_logs(created_at DESC);
```

---

## 7. `transactions`

On-chain ELDR ERC-20 transactions mirrored off-chain.

```sql
CREATE TYPE tx_status AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REVERTED');
CREATE TYPE tx_type AS ENUM ('DEPOSIT', 'WITHDRAW', 'BATTLE_LOCK', 'BATTLE_SETTLE', 'MINT_PILOT', 'BURN');

CREATE TABLE transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tx_hash       VARCHAR(66) NOT NULL UNIQUE,
  tx_type       tx_type NOT NULL,
  status        tx_status NOT NULL DEFAULT 'PENDING',
  chain_id      INTEGER NOT NULL DEFAULT 1,
  block_number  BIGINT,
  from_address  VARCHAR(42) NOT NULL,
  to_address    VARCHAR(42) NOT NULL,
  eldr_amount   NUMERIC(36,18) NOT NULL,
  gas_used      BIGINT,
  gas_price_gwei NUMERIC(20,9),
  -- Contract call data decoded
  decoded_input JSONB,
  error_message TEXT,
  confirmed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tx_user ON transactions(user_id);
CREATE INDEX idx_tx_hash ON transactions(tx_hash);
CREATE INDEX idx_tx_status ON transactions(status);
CREATE INDEX idx_tx_type ON transactions(tx_type);
CREATE INDEX idx_tx_block ON transactions(block_number);
```

---

## 8. `leaderboard`

Materialized leaderboard snapshot — refreshed every 5 minutes via BullMQ job.

```sql
-- Materialized view (fast reads, scheduled refresh)
CREATE MATERIALIZED VIEW leaderboard AS
SELECT
  u.id           AS user_id,
  u.username,
  u.avatar_url,
  u.level,
  COUNT(b.id) FILTER (WHERE b.winner_id = u.id)  AS wins,
  COUNT(b.id) FILTER (WHERE b.status = 'COMPLETED'
    AND (b.player1_id = u.id OR b.player2_id = u.id)
    AND b.winner_id != u.id AND NOT b.is_draw)    AS losses,
  COUNT(b.id) FILTER (WHERE b.is_draw)             AS draws,
  ROUND(
    COUNT(b.id) FILTER (WHERE b.winner_id = u.id)::NUMERIC /
    NULLIF(COUNT(b.id) FILTER (WHERE b.status = 'COMPLETED'
      AND (b.player1_id = u.id OR b.player2_id = u.id)), 0) * 100, 1
  )              AS win_rate,
  SUM(b.gmo_winner_gain) FILTER (WHERE b.winner_id = u.id) AS total_gmo_earned,
  -- ELO-style rating (maintained separately, joined here)
  COALESCE(r.rating, 1000) AS rating,
  ROW_NUMBER() OVER (ORDER BY COALESCE(r.rating, 1000) DESC) AS rank
FROM users u
LEFT JOIN battles b ON b.player1_id = u.id OR b.player2_id = u.id
LEFT JOIN user_ratings r ON r.user_id = u.id
WHERE u.is_banned = FALSE
GROUP BY u.id, u.username, u.avatar_url, u.level, r.rating;

CREATE UNIQUE INDEX idx_leaderboard_user ON leaderboard(user_id);
CREATE INDEX idx_leaderboard_rank ON leaderboard(rank);
CREATE INDEX idx_leaderboard_rating ON leaderboard(rating DESC);

-- ELO ratings table (updated after each ranked battle)
CREATE TABLE user_ratings (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL DEFAULT 1000,
  peak_rating INTEGER NOT NULL DEFAULT 1000,
  season      SMALLINT NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard;
END;
$$ LANGUAGE plpgsql;
```

---

## 9. `matchmaking_queue`

Active matchmaking sessions stored in Redis + synced here.

```sql
CREATE TYPE queue_status AS ENUM ('WAITING', 'MATCHED', 'EXPIRED');

CREATE TABLE matchmaking_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode          battle_mode NOT NULL DEFAULT 'RANKED',
  robot_id      UUID NOT NULL REFERENCES user_robots(id),
  algorithm_id  UUID NOT NULL REFERENCES algorithms(id),
  pilot_id      UUID REFERENCES pilots(id),
  rating        INTEGER NOT NULL DEFAULT 1000,
  rating_range  SMALLINT NOT NULL DEFAULT 50,     -- ±range for matching
  status        queue_status NOT NULL DEFAULT 'WAITING',
  matched_battle_id UUID REFERENCES battles(id),
  queued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes'
);

CREATE INDEX idx_queue_status ON matchmaking_queue(status, mode, rating);
CREATE INDEX idx_queue_user ON matchmaking_queue(user_id);
```

---

## 10. Utility: Triggers & Functions

```sql
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_algorithms_updated_at
  BEFORE UPDATE ON algorithms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ELO update after battle completion
CREATE OR REPLACE FUNCTION update_elo_after_battle()
RETURNS TRIGGER AS $$
DECLARE
  p1_rating INTEGER;
  p2_rating INTEGER;
  k_factor  INTEGER := 32;
  expected_p1 NUMERIC;
  new_p1 INTEGER;
  new_p2 INTEGER;
BEGIN
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' AND NEW.mode = 'RANKED' THEN
    SELECT COALESCE(rating, 1000) INTO p1_rating FROM user_ratings WHERE user_id = NEW.player1_id;
    SELECT COALESCE(rating, 1000) INTO p2_rating FROM user_ratings WHERE user_id = NEW.player2_id;
    
    expected_p1 := 1.0 / (1.0 + POWER(10.0, (p2_rating - p1_rating) / 400.0));
    
    IF NEW.is_draw THEN
      new_p1 := p1_rating + ROUND(k_factor * (0.5 - expected_p1));
      new_p2 := p2_rating + ROUND(k_factor * (0.5 - (1 - expected_p1)));
    ELSIF NEW.winner_id = NEW.player1_id THEN
      new_p1 := p1_rating + ROUND(k_factor * (1.0 - expected_p1));
      new_p2 := p2_rating + ROUND(k_factor * (0.0 - (1 - expected_p1)));
    ELSE
      new_p1 := p1_rating + ROUND(k_factor * (0.0 - expected_p1));
      new_p2 := p2_rating + ROUND(k_factor * (1.0 - (1 - expected_p1)));
    END IF;

    INSERT INTO user_ratings (user_id, rating, peak_rating)
      VALUES (NEW.player1_id, GREATEST(new_p1, 0), GREATEST(new_p1, 0))
      ON CONFLICT (user_id) DO UPDATE
        SET rating = GREATEST(new_p1, 0),
            peak_rating = GREATEST(user_ratings.peak_rating, new_p1),
            updated_at = NOW();

    INSERT INTO user_ratings (user_id, rating, peak_rating)
      VALUES (NEW.player2_id, GREATEST(new_p2, 0), GREATEST(new_p2, 0))
      ON CONFLICT (user_id) DO UPDATE
        SET rating = GREATEST(new_p2, 0),
            peak_rating = GREATEST(user_ratings.peak_rating, new_p2),
            updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_elo_update
  AFTER UPDATE ON battles
  FOR EACH ROW EXECUTE FUNCTION update_elo_after_battle();
```

---

## Table Summary

| Table | Rows (est.) | Notes |
|---|---|---|
| `users` | ~100K | Core identity |
| `pilots` | ~300K | 3 avg per user |
| `robots` | 36 | Seeded static |
| `user_robots` | ~500K | Roster per user |
| `algorithms` | ~2M | Multiple per user |
| `battles` | ~10M | High write volume |
| `energy_logs` | ~50M | Append-only ledger |
| `transactions` | ~5M | On-chain mirror |
| `leaderboard` | ~100K | Materialized view |
| `user_ratings` | ~100K | ELO scores |
| `matchmaking_queue` | ~10K | Short-lived rows |
