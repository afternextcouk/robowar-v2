-- ROBOWAR V2 — Initial Schema Migration
-- Run via: docker-compose exec backend npm run migrate

BEGIN;

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE element_type    AS ENUM ('VOLT', 'PYRO', 'CRYO', 'NANO', 'VOID', 'IRON');
CREATE TYPE robot_tier      AS ENUM ('T1', 'T2', 'T3');
CREATE TYPE pilot_rarity    AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');
CREATE TYPE algorithm_status AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE battle_status   AS ENUM ('MATCHMAKING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED');
CREATE TYPE biome_type      AS ENUM ('GRASSLAND', 'DESERT', 'SNOWFIELD', 'CITY');
CREATE TYPE battle_mode     AS ENUM ('RANKED', 'CASUAL', 'TOURNAMENT', 'AI');
CREATE TYPE energy_action   AS ENUM (
  'BATTLE_WIN', 'BATTLE_LOSS', 'BATTLE_WAGER', 'ROBOT_PURCHASE',
  'ALGORITHM_SAVE', 'DAILY_REWARD', 'TOURNAMENT_PRIZE',
  'ELDR_DEPOSIT', 'ELDR_WITHDRAW', 'ADMIN_GRANT', 'REFUND'
);
CREATE TYPE tx_status AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REVERTED');
CREATE TYPE tx_type   AS ENUM ('DEPOSIT', 'WITHDRAW', 'BATTLE_LOCK', 'BATTLE_SETTLE', 'MINT_PILOT', 'BURN');
CREATE TYPE queue_status AS ENUM ('WAITING', 'MATCHED', 'EXPIRED');
CREATE TYPE user_role AS ENUM ('PLAYER', 'ADMIN', 'MODERATOR');

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(32) NOT NULL UNIQUE,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  wallet_address  VARCHAR(42) UNIQUE,
  role            user_role NOT NULL DEFAULT 'PLAYER',
  gmo_balance     BIGINT NOT NULL DEFAULT 0,
  eldr_balance    NUMERIC(36,18) NOT NULL DEFAULT 0,
  xp              INTEGER NOT NULL DEFAULT 0,
  level           SMALLINT NOT NULL DEFAULT 1,
  avatar_url      TEXT,
  is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
  ban_reason      TEXT,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_wallet  ON users(wallet_address);
CREATE INDEX idx_users_level   ON users(level DESC);
CREATE INDEX idx_users_email   ON users(email);

-- ─── Robots ──────────────────────────────────────────────────────────────────
CREATE TABLE robots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            VARCHAR(64) NOT NULL UNIQUE,
  display_name    VARCHAR(64) NOT NULL,
  element         element_type NOT NULL,
  tier            robot_tier NOT NULL DEFAULT 'T1',
  sprite_atlas    VARCHAR(128) NOT NULL,
  base_hp         SMALLINT NOT NULL,
  base_attack     SMALLINT NOT NULL,
  base_defense    SMALLINT NOT NULL,
  base_speed      SMALLINT NOT NULL,
  base_energy     SMALLINT NOT NULL,
  energy_regen    SMALLINT NOT NULL DEFAULT 2,
  strong_vs       element_type[],
  weak_vs         element_type[],
  biome_bonus     JSONB NOT NULL DEFAULT '{}',
  gmo_cost        INTEGER NOT NULL DEFAULT 500,
  is_starter      BOOLEAN NOT NULL DEFAULT FALSE,
  unlock_level    SMALLINT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_robots_element ON robots(element);
CREATE INDEX idx_robots_tier    ON robots(tier);

-- ─── User Robots ─────────────────────────────────────────────────────────────
CREATE TABLE user_robots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  robot_id         UUID NOT NULL REFERENCES robots(id),
  nickname         VARCHAR(64),
  upgrade_hp       SMALLINT NOT NULL DEFAULT 0,
  upgrade_attack   SMALLINT NOT NULL DEFAULT 0,
  upgrade_defense  SMALLINT NOT NULL DEFAULT 0,
  upgrade_speed    SMALLINT NOT NULL DEFAULT 0,
  acquired_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, robot_id)
);
CREATE INDEX idx_user_robots_user ON user_robots(user_id);

-- ─── Pilots ──────────────────────────────────────────────────────────────────
CREATE TABLE pilots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             VARCHAR(64) NOT NULL,
  rarity           pilot_rarity NOT NULL DEFAULT 'COMMON',
  nft_token_id     BIGINT,
  sprite_key       VARCHAR(64) NOT NULL,
  stat_hp_mod      SMALLINT NOT NULL DEFAULT 0,
  stat_attack_mod  SMALLINT NOT NULL DEFAULT 0,
  stat_defense_mod SMALLINT NOT NULL DEFAULT 0,
  stat_speed_mod   SMALLINT NOT NULL DEFAULT 0,
  stat_energy_mod  SMALLINT NOT NULL DEFAULT 0,
  battles_fought   INTEGER NOT NULL DEFAULT 0,
  battles_won      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pilots_user ON pilots(user_id);
CREATE INDEX idx_pilots_nft  ON pilots(nft_token_id) WHERE nft_token_id IS NOT NULL;

-- ─── Algorithms ──────────────────────────────────────────────────────────────
CREATE TABLE algorithms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                VARCHAR(128) NOT NULL,
  description         TEXT,
  status              algorithm_status NOT NULL DEFAULT 'DRAFT',
  rule_tree           JSONB NOT NULL DEFAULT '{"version":2,"rules":[]}',
  is_valid            BOOLEAN NOT NULL DEFAULT FALSE,
  validation_errors   JSONB,
  times_used          INTEGER NOT NULL DEFAULT 0,
  win_rate            NUMERIC(5,2),
  version             SMALLINT NOT NULL DEFAULT 1,
  parent_id           UUID REFERENCES algorithms(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_algorithms_user    ON algorithms(user_id);
CREATE INDEX idx_algorithms_status  ON algorithms(status);
CREATE INDEX idx_algorithms_name_fts ON algorithms USING gin(to_tsvector('english', name));

-- ─── Battles ─────────────────────────────────────────────────────────────────
CREATE TABLE battles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode                battle_mode NOT NULL DEFAULT 'CASUAL',
  status              battle_status NOT NULL DEFAULT 'MATCHMAKING',
  biome               biome_type NOT NULL,
  player1_id          UUID NOT NULL REFERENCES users(id),
  player2_id          UUID REFERENCES users(id),
  player1_robot_id    UUID NOT NULL REFERENCES user_robots(id),
  player2_robot_id    UUID REFERENCES user_robots(id),
  player1_algo_id     UUID NOT NULL REFERENCES algorithms(id),
  player2_algo_id     UUID REFERENCES algorithms(id),
  player1_pilot_id    UUID REFERENCES pilots(id),
  player2_pilot_id    UUID REFERENCES pilots(id),
  winner_id           UUID REFERENCES users(id),
  is_draw             BOOLEAN NOT NULL DEFAULT FALSE,
  total_ticks         SMALLINT,
  lcg_seed            BIGINT NOT NULL,
  battle_log          JSONB,
  battle_log_gz       BYTEA,
  gmo_wagered         INTEGER NOT NULL DEFAULT 0,
  gmo_winner_gain     INTEGER,
  eldr_wagered        NUMERIC(36,18) NOT NULL DEFAULT 0,
  eldr_winner_gain    NUMERIC(36,18),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_battles_player1  ON battles(player1_id);
CREATE INDEX idx_battles_player2  ON battles(player2_id);
CREATE INDEX idx_battles_status   ON battles(status);
CREATE INDEX idx_battles_mode     ON battles(mode);
CREATE INDEX idx_battles_created  ON battles(created_at DESC);
CREATE INDEX idx_battles_biome    ON battles(biome);

-- ─── Energy Logs ─────────────────────────────────────────────────────────────
CREATE TABLE energy_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action              energy_action NOT NULL,
  gmo_delta           BIGINT NOT NULL DEFAULT 0,
  gmo_balance_after   BIGINT NOT NULL,
  eldr_delta          NUMERIC(36,18) NOT NULL DEFAULT 0,
  eldr_balance_after  NUMERIC(36,18) NOT NULL DEFAULT 0,
  ref_battle_id       UUID REFERENCES battles(id),
  ref_tx_hash         VARCHAR(66),
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_energy_logs_user    ON energy_logs(user_id);
CREATE INDEX idx_energy_logs_action  ON energy_logs(action);
CREATE INDEX idx_energy_logs_created ON energy_logs(created_at DESC);

-- ─── Transactions ─────────────────────────────────────────────────────────────
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tx_hash         VARCHAR(66) NOT NULL UNIQUE,
  tx_type         tx_type NOT NULL,
  status          tx_status NOT NULL DEFAULT 'PENDING',
  chain_id        INTEGER NOT NULL DEFAULT 1,
  block_number    BIGINT,
  from_address    VARCHAR(42) NOT NULL,
  to_address      VARCHAR(42) NOT NULL,
  eldr_amount     NUMERIC(36,18) NOT NULL,
  gas_used        BIGINT,
  gas_price_gwei  NUMERIC(20,9),
  decoded_input   JSONB,
  error_message   TEXT,
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tx_user    ON transactions(user_id);
CREATE INDEX idx_tx_hash    ON transactions(tx_hash);
CREATE INDEX idx_tx_status  ON transactions(status);
CREATE INDEX idx_tx_type    ON transactions(tx_type);
CREATE INDEX idx_tx_block   ON transactions(block_number);

-- ─── User Ratings ─────────────────────────────────────────────────────────────
CREATE TABLE user_ratings (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rating       INTEGER NOT NULL DEFAULT 1000,
  peak_rating  INTEGER NOT NULL DEFAULT 1000,
  season       SMALLINT NOT NULL DEFAULT 1,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Matchmaking Queue ────────────────────────────────────────────────────────
CREATE TABLE matchmaking_queue (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode                battle_mode NOT NULL DEFAULT 'RANKED',
  robot_id            UUID NOT NULL REFERENCES user_robots(id),
  algorithm_id        UUID NOT NULL REFERENCES algorithms(id),
  pilot_id            UUID REFERENCES pilots(id),
  rating              INTEGER NOT NULL DEFAULT 1000,
  rating_range        SMALLINT NOT NULL DEFAULT 50,
  status              queue_status NOT NULL DEFAULT 'WAITING',
  matched_battle_id   UUID REFERENCES battles(id),
  queued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes'
);
CREATE INDEX idx_queue_status ON matchmaking_queue(status, mode, rating);
CREATE INDEX idx_queue_user   ON matchmaking_queue(user_id);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_algorithms_updated_at
  BEFORE UPDATE ON algorithms FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ELO Update Trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_elo_after_battle()
RETURNS TRIGGER AS $$
DECLARE
  p1_rating INTEGER; p2_rating INTEGER;
  k_factor INTEGER := 32;
  expected_p1 NUMERIC; new_p1 INTEGER; new_p2 INTEGER;
BEGIN
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' AND NEW.mode = 'RANKED' AND NEW.player2_id IS NOT NULL THEN
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
      ON CONFLICT (user_id) DO UPDATE SET
        rating = GREATEST(new_p1, 0),
        peak_rating = GREATEST(user_ratings.peak_rating, new_p1),
        updated_at = NOW();
    INSERT INTO user_ratings (user_id, rating, peak_rating)
      VALUES (NEW.player2_id, GREATEST(new_p2, 0), GREATEST(new_p2, 0))
      ON CONFLICT (user_id) DO UPDATE SET
        rating = GREATEST(new_p2, 0),
        peak_rating = GREATEST(user_ratings.peak_rating, new_p2),
        updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_elo_update
  AFTER UPDATE ON battles FOR EACH ROW EXECUTE FUNCTION update_elo_after_battle();

-- ─── Leaderboard Materialized View ───────────────────────────────────────────
CREATE MATERIALIZED VIEW leaderboard AS
SELECT
  u.id AS user_id, u.username, u.avatar_url, u.level,
  COUNT(b.id) FILTER (WHERE b.winner_id = u.id) AS wins,
  COUNT(b.id) FILTER (WHERE b.status = 'COMPLETED'
    AND (b.player1_id = u.id OR b.player2_id = u.id)
    AND b.winner_id != u.id AND NOT b.is_draw) AS losses,
  COUNT(b.id) FILTER (WHERE b.is_draw) AS draws,
  ROUND(COUNT(b.id) FILTER (WHERE b.winner_id = u.id)::NUMERIC /
    NULLIF(COUNT(b.id) FILTER (WHERE b.status = 'COMPLETED'
      AND (b.player1_id = u.id OR b.player2_id = u.id)), 0) * 100, 1) AS win_rate,
  COALESCE(r.rating, 1000) AS rating,
  ROW_NUMBER() OVER (ORDER BY COALESCE(r.rating, 1000) DESC) AS rank
FROM users u
LEFT JOIN battles b ON b.player1_id = u.id OR b.player2_id = u.id
LEFT JOIN user_ratings r ON r.user_id = u.id
WHERE u.is_banned = FALSE
GROUP BY u.id, u.username, u.avatar_url, u.level, r.rating;

CREATE UNIQUE INDEX idx_leaderboard_user   ON leaderboard(user_id);
CREATE INDEX idx_leaderboard_rank          ON leaderboard(rank);
CREATE INDEX idx_leaderboard_rating        ON leaderboard(rating DESC);

CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard; END; $$ LANGUAGE plpgsql;

COMMIT;
