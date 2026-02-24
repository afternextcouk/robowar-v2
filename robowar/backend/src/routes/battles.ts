import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { query, queryOne } from "../db";
import { AppError } from "../middleware/errorHandler";
import { jobs } from "../jobs/queues";
import { v4 as uuid } from "uuid";

export const battlesRouter = Router();

// POST /battles/queue
battlesRouter.post("/queue", requireAuth, async (req, res, next) => {
  try {
    const { mode, robot_id, algorithm_id, pilot_id, gmo_wager = 0 } = req.body;
    const userId = req.user!.sub;

    // Validate robot ownership
    const robot = await queryOne("SELECT id FROM user_robots WHERE id = $1 AND user_id = $2", [robot_id, userId]);
    if (!robot) throw new AppError("NOT_FOUND", "Robot not found", 404);

    // Validate algorithm
    const algo = await queryOne("SELECT id FROM algorithms WHERE id = $1 AND user_id = $2 AND is_valid = TRUE", [algorithm_id, userId]);
    if (!algo) throw new AppError("ALGORITHM_INVALID", "Algorithm not found or invalid", 400);

    // Check not already in queue
    const inQueue = await queryOne("SELECT id FROM matchmaking_queue WHERE user_id = $1 AND status = 'WAITING'", [userId]);
    if (inQueue) throw new AppError("ALREADY_IN_QUEUE", "Already in matchmaking queue", 409);

    const queueId = uuid();
    await query(
      `INSERT INTO matchmaking_queue (id, user_id, mode, robot_id, algorithm_id, pilot_id, rating)
       VALUES ($1, $2, $3, $4, $5, $6,
         COALESCE((SELECT rating FROM user_ratings WHERE user_id = $2), 1000))`,
      [queueId, userId, mode || "RANKED", robot_id, algorithm_id, pilot_id]
    );

    await jobs.runMatchmaking(mode || "RANKED");

    res.status(202).json({ queue_id: queueId, estimated_wait_s: 15 });
  } catch (err) {
    next(err);
  }
});

// DELETE /battles/queue
battlesRouter.delete("/queue", requireAuth, async (req, res, next) => {
  try {
    await query("UPDATE matchmaking_queue SET status = 'EXPIRED' WHERE user_id = $1 AND status = 'WAITING'", [req.user!.sub]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /battles/:id
battlesRouter.get("/:id", async (req, res, next) => {
  try {
    const battle = await queryOne("SELECT * FROM battles WHERE id = $1", [req.params.id]);
    if (!battle) throw new AppError("NOT_FOUND", "Battle not found", 404);
    res.json(battle);
  } catch (err) {
    next(err);
  }
});

// GET /battles/:id/replay
battlesRouter.get("/:id/replay", async (req, res, next) => {
  try {
    const battle = await queryOne<{ battle_log: unknown; lcg_seed: number }>(
      "SELECT battle_log, lcg_seed FROM battles WHERE id = $1 AND status = 'COMPLETED'",
      [req.params.id]
    );
    if (!battle) throw new AppError("NOT_FOUND", "Completed battle not found", 404);
    res.json({ lcg_seed: battle.lcg_seed, ticks: battle.battle_log });
  } catch (err) {
    next(err);
  }
});

// GET /battles
battlesRouter.get("/", async (req, res, next) => {
  try {
    const { user_id, mode, status, limit = 20, offset = 0 } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (user_id) { conditions.push(`(player1_id = $${p} OR player2_id = $${p})`); params.push(user_id); p++; }
    if (mode) { conditions.push(`mode = $${p++}`); params.push(mode); }
    if (status) { conditions.push(`status = $${p++}`); params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const battles = await query(`SELECT * FROM battles ${where} ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`, params);
    const [{ count }] = await query<{ count: string }>(`SELECT COUNT(*) FROM battles ${where}`, params.slice(0, -2));

    res.json({ data: battles, total: parseInt(count), limit: Number(limit), offset: Number(offset), has_more: Number(offset) + battles.length < parseInt(count) });
  } catch (err) {
    next(err);
  }
});

// GET /battles/live
battlesRouter.get("/live", async (_req, res, next) => {
  try {
    const battles = await query("SELECT * FROM battles WHERE status = 'IN_PROGRESS' ORDER BY started_at DESC LIMIT 20");
    res.json({ data: battles });
  } catch (err) {
    next(err);
  }
});
