/**
 * ROBOWAR Battle Worker
 * Runs as a separate process. Start with: npm run worker
 *
 * YPY-45 FIX: Battle simulation worker fully implemented.
 */
import "dotenv/config";
import { Worker, Job } from "bullmq";
import { connectDB, query, queryOne } from "../db";
import { connectRedis, getRedis } from "../config/redis";
import { emit } from "../socket";
import { runBattle, BattleConfig, RobotConfig, PilotConfig, RuleTree, BiomeType } from "../engine";
import logger from "../config/logger";

// ─── DB Row Types ─────────────────────────────────────────────────────────────

interface BattleRow {
  id: string;
  p1_user_id: string;
  p2_user_id: string;
  p1_robot_id: string;
  p2_robot_id: string;
  p1_algorithm_id: string;
  p2_algorithm_id: string;
  p1_pilot_id: string | null;
  p2_pilot_id: string | null;
  biome: string;
  lcg_seed: number;
  status: string;
}

interface RobotRow {
  id: string;
  element: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  energy: number;
  energy_regen: number;
  strong_vs: string[];
  weak_vs: string[];
  biome_bonus: Record<string, number>;
}

interface PilotRow {
  hp_mod: number;
  attack_mod: number;
  defense_mod: number;
  speed_mod: number;
  energy_mod: number;
}

interface AlgorithmRow {
  id: string;
  rule_tree: RuleTree;
}

// ─── Helper: build RobotConfig from DB row ────────────────────────────────────

function toRobotConfig(row: RobotRow): RobotConfig {
  return {
    id: row.id,
    element: row.element as RobotConfig["element"],
    hp: row.hp,
    attack: row.attack,
    defense: row.defense,
    speed: row.speed,
    energy: row.energy,
    energyRegen: row.energy_regen,
    strongVs: (row.strong_vs ?? []) as RobotConfig["element"][],
    weakVs: (row.weak_vs ?? []) as RobotConfig["element"][],
    biomeBonus: (row.biome_bonus ?? {}) as Partial<Record<BiomeType, number>>,
  };
}

function toPilotConfig(row: PilotRow): PilotConfig {
  return {
    hpMod: row.hp_mod,
    attackMod: row.attack_mod,
    defenseMod: row.defense_mod,
    speedMod: row.speed_mod,
    energyMod: row.energy_mod,
  };
}

// ─── Battle Simulation Worker ─────────────────────────────────────────────────

async function processBattle(job: Job): Promise<Record<string, unknown>> {
  const { battleId } = job.data as { battleId: string };
  logger.info(`[Battle Worker] Processing battle ${battleId} (job ${job.id})`);

  // 1. Load battle record
  const battle = await queryOne<BattleRow>(
    `SELECT b.*,
            me1.robot_id   AS p1_robot_id,
            me1.algorithm_id AS p1_algorithm_id,
            me1.pilot_id   AS p1_pilot_id,
            me2.robot_id   AS p2_robot_id,
            me2.algorithm_id AS p2_algorithm_id,
            me2.pilot_id   AS p2_pilot_id
     FROM battles b
     JOIN matchmaking_entries me1 ON me1.battle_id = b.id AND me1.side = 'P1'
     JOIN matchmaking_entries me2 ON me2.battle_id = b.id AND me2.side = 'P2'
     WHERE b.id = $1 AND b.status = 'PENDING'`,
    [battleId]
  );

  if (!battle) {
    logger.warn(`[Battle Worker] Battle ${battleId} not found or not pending — skipping`);
    return { skipped: true };
  }

  // Mark as RUNNING
  await query("UPDATE battles SET status = 'RUNNING', started_at = NOW() WHERE id = $1", [battleId]);
  emit.toBattle(battleId, "battle:started", { battleId });

  // 2. Load robots
  const [p1RobotRow, p2RobotRow] = await Promise.all([
    queryOne<RobotRow>(
      `SELECT r.* FROM robots r
       JOIN user_robots ur ON ur.robot_id = r.id
       WHERE ur.id = $1`,
      [battle.p1_robot_id]
    ),
    queryOne<RobotRow>(
      `SELECT r.* FROM robots r
       JOIN user_robots ur ON ur.robot_id = r.id
       WHERE ur.id = $1`,
      [battle.p2_robot_id]
    ),
  ]);

  if (!p1RobotRow || !p2RobotRow) {
    throw new Error(`[Battle Worker] Could not load robots for battle ${battleId}`);
  }

  // 3. Load algorithms
  const [p1Algo, p2Algo] = await Promise.all([
    queryOne<AlgorithmRow>("SELECT id, rule_tree FROM algorithms WHERE id = $1", [battle.p1_algorithm_id]),
    queryOne<AlgorithmRow>("SELECT id, rule_tree FROM algorithms WHERE id = $1", [battle.p2_algorithm_id]),
  ]);

  if (!p1Algo || !p2Algo) {
    throw new Error(`[Battle Worker] Could not load algorithms for battle ${battleId}`);
  }

  // 4. Load pilots (optional)
  const [p1PilotRow, p2PilotRow] = await Promise.all([
    battle.p1_pilot_id
      ? queryOne<PilotRow>("SELECT hp_mod, attack_mod, defense_mod, speed_mod, energy_mod FROM pilots WHERE id = $1", [battle.p1_pilot_id])
      : Promise.resolve(null),
    battle.p2_pilot_id
      ? queryOne<PilotRow>("SELECT hp_mod, attack_mod, defense_mod, speed_mod, energy_mod FROM pilots WHERE id = $1", [battle.p2_pilot_id])
      : Promise.resolve(null),
  ]);

  // 5. Build BattleConfig
  const seed = battle.lcg_seed ?? Math.floor(Math.random() * 2 ** 31);
  const config: BattleConfig = {
    seed,
    biome: (battle.biome ?? "GRASSLAND") as BiomeType,
    maxTicks: 100,
    p1Robot: toRobotConfig(p1RobotRow),
    p2Robot: toRobotConfig(p2RobotRow),
    p1Pilot: p1PilotRow ? toPilotConfig(p1PilotRow) : null,
    p2Pilot: p2PilotRow ? toPilotConfig(p2PilotRow) : null,
    p1Rules: p1Algo.rule_tree,
    p2Rules: p2Algo.rule_tree,
  };

  // 6. Run the deterministic simulation
  logger.info(`[Battle Worker] Running engine for battle ${battleId}, seed=${seed}`);
  const result = runBattle(config);

  // 7. Stream tick events via Socket.IO
  for (const tick of result.ticks) {
    emit.toBattle(battleId, "battle:tick", tick);
    // Small yield so the event loop isn't starved on long battles
    if (tick.tick % 10 === 0) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  // 8. Persist result to DB
  const winnerId =
    result.winner === "P1"
      ? battle.p1_user_id
      : result.winner === "P2"
      ? battle.p2_user_id
      : null;

  await query(
    `UPDATE battles
     SET status        = 'COMPLETED',
         winner        = $1,
         winner_user_id = $2,
         battle_log    = $3,
         lcg_seed      = $4,
         total_ticks   = $5,
         final_p1_hp   = $6,
         final_p2_hp   = $7,
         ended_at      = NOW()
     WHERE id = $8`,
    [
      result.winner,
      winnerId,
      JSON.stringify(result.ticks),
      seed,
      result.totalTicks,
      result.finalP1Hp,
      result.finalP2Hp,
      battleId,
    ]
  );

  // 9. Emit completion event
  emit.toBattle(battleId, "battle:complete", {
    battleId,
    winner: result.winner,
    winnerId,
    totalTicks: result.totalTicks,
    finalP1Hp: result.finalP1Hp,
    finalP2Hp: result.finalP2Hp,
  });

  logger.info(`[Battle Worker] ✅ Battle ${battleId} complete — winner: ${result.winner}`);
  return { battleId, winner: result.winner, totalTicks: result.totalTicks };
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  await connectDB();
  await connectRedis();
  logger.info("🤖 ROBOWAR Worker online");

  // ─── Battle Simulation Worker ────────────────────────────
  const battleWorker = new Worker(
    "battle-simulation",
    processBattle,
    { connection: getRedis(), concurrency: 4 }
  );

  // ─── Matchmaking Worker ──────────────────────────────────
  const matchmakingWorker = new Worker(
    "matchmaking",
    async (job: Job) => {
      const { mode } = job.data as { mode: string };
      logger.info(`[MM Worker] Running matchmaking for mode: ${mode}`);
      // Find two waiting players with closest ratings
      const candidates = await query<{
        id: string;
        user_id: string;
        robot_id: string;
        algorithm_id: string;
        pilot_id: string | null;
        rating: number;
      }>(
        `SELECT id, user_id, robot_id, algorithm_id, pilot_id, rating
         FROM matchmaking_queue
         WHERE mode = $1 AND status = 'WAITING'
         ORDER BY rating ASC, created_at ASC
         LIMIT 2`,
        [mode]
      );

      if (candidates.length < 2) {
        logger.info(`[MM Worker] Not enough players for mode ${mode}`);
        return;
      }

      const [p1, p2] = candidates;
      const seed = Math.floor(Math.random() * 2 ** 31);
      const biome = (["GRASSLAND", "DESERT", "SNOWFIELD", "CITY"] as const)[
        Math.floor(Math.random() * 4)
      ];

      // Create battle record
      const [battle] = await query<{ id: string }>(
        `INSERT INTO battles (id, biome, lcg_seed, status, p1_user_id, p2_user_id)
         VALUES (gen_random_uuid(), $1, $2, 'PENDING', $3, $4) RETURNING id`,
        [biome, seed, p1.user_id, p2.user_id]
      );

      // Create matchmaking_entries
      await query(
        `INSERT INTO matchmaking_entries (battle_id, user_id, robot_id, algorithm_id, pilot_id, side)
         VALUES ($1, $2, $3, $4, $5, 'P1'), ($1, $6, $7, $8, $9, 'P2')`,
        [battle.id, p1.user_id, p1.robot_id, p1.algorithm_id, p1.pilot_id ?? null,
          p2.user_id, p2.robot_id, p2.algorithm_id, p2.pilot_id ?? null]
      );

      // Mark queue entries as matched
      await query(
        "UPDATE matchmaking_queue SET status = 'MATCHED', battle_id = $1 WHERE id = ANY($2::uuid[])",
        [battle.id, [p1.id, p2.id]]
      );

      // Queue the simulation
      const { battleSimQueue } = await import("./queues");
      await battleSimQueue.add(
        "simulate",
        { battleId: battle.id },
        { jobId: `battle:${battle.id}` }
      );

      logger.info(`[MM Worker] Matched ${p1.user_id} vs ${p2.user_id} → battle ${battle.id}`);
    },
    { connection: getRedis(), concurrency: 2 }
  );

  // ─── Leaderboard Refresh Worker ──────────────────────────
  const leaderboardWorker = new Worker(
    "leaderboard-refresh",
    async () => {
      logger.info("[LB Worker] Refreshing leaderboard materialized view");
      await query("REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_view");
    },
    { connection: getRedis(), concurrency: 1 }
  );

  // ─── Transaction Watch Worker ────────────────────────────
  const txWorker = new Worker(
    "transaction-watch",
    async (job: Job) => {
      const { txHash, userId, type } = job.data as { txHash: string; userId: string; type: string };
      logger.info(`[TX Worker] Watching tx ${txHash} for user ${userId} (${type})`);
      // TODO: Verify on-chain via ethers provider and update DB
    },
    { connection: getRedis(), concurrency: 5 }
  );

  // ─── Error Handlers ──────────────────────────────────────
  for (const worker of [battleWorker, matchmakingWorker, leaderboardWorker, txWorker]) {
    worker.on("failed", (job, err) => {
      logger.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
    });
    worker.on("completed", (job) => {
      logger.info(`[Worker] Job ${job.id} completed`);
    });
  }

  // ─── Graceful Shutdown ───────────────────────────────────
  process.on("SIGTERM", async () => {
    logger.info("Closing workers...");
    await Promise.all([
      battleWorker.close(),
      matchmakingWorker.close(),
      leaderboardWorker.close(),
      txWorker.close(),
    ]);
    process.exit(0);
  });
}

bootstrap().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error("Worker bootstrap failed:", message);
  process.exit(1);
});
