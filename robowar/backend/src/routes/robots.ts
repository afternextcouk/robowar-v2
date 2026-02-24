import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { query, queryOne, withTransaction } from "../db";
import type { PoolClient } from "pg";
import { cache, CK } from "../config/redis";
import { AppError } from "../middleware/errorHandler";

export const robotsRouter = Router();

robotsRouter.get("/", async (_req, res, next) => {
  try {
    const cached = await cache.get(CK.robots());
    if (cached) return res.json(cached);
    const robots = await query("SELECT * FROM robots ORDER BY element, tier, display_name");
    const response = { data: robots, total: robots.length };
    await cache.set(CK.robots(), response, 3600);
    res.json(response);
  } catch (err) { next(err); }
});

robotsRouter.get("/:id", async (req, res, next) => {
  try {
    const robot = await queryOne("SELECT * FROM robots WHERE id = $1 OR slug = $1", [req.params.id]);
    if (!robot) throw new AppError("NOT_FOUND", "Robot not found", 404);
    res.json(robot);
  } catch (err) { next(err); }
});

/**
 * POST /robots/:robotId/purchase
 * YPY-45 FIX: GMO deduction and robot assignment wrapped in a single
 * Postgres transaction to prevent race conditions (double-spend).
 */
robotsRouter.post("/:robotId/purchase", requireAuth, async (req, res, next) => {
  try {
    // Pre-flight checks outside transaction (read-only, no TOCTOU risk here)
    const robot = await queryOne<{ id: string; gmo_cost: number }>(
      "SELECT id, gmo_cost FROM robots WHERE id = $1",
      [req.params.robotId]
    );
    if (!robot) throw new AppError("NOT_FOUND", "Robot not found", 404);

    const result = await withTransaction(async (client: PoolClient) => {
      // Lock the user row to prevent concurrent purchases
      const userRow = await client.query<{ gmo_balance: number }>(
        "SELECT gmo_balance FROM users WHERE id = $1 FOR UPDATE",
        [req.user!.sub]
      );
      const user = userRow.rows[0];
      if (!user || user.gmo_balance < robot.gmo_cost) {
        throw new AppError("INSUFFICIENT_GMO", "Not enough GMO", 400);
      }

      // Check ownership (inside transaction to prevent duplicate inserts)
      const ownedRow = await client.query(
        "SELECT id FROM user_robots WHERE user_id = $1 AND robot_id = $2",
        [req.user!.sub, robot.id]
      );
      if (ownedRow.rows.length > 0) {
        throw new AppError("ALREADY_OWNED", "Robot already owned", 409);
      }

      // Deduct GMO balance
      const updatedUserRow = await client.query<{ gmo_balance: number }>(
        "UPDATE users SET gmo_balance = gmo_balance - $1 WHERE id = $2 RETURNING gmo_balance",
        [robot.gmo_cost, req.user!.sub]
      );

      // Assign robot to user
      const urRow = await client.query<{ id: string }>(
        "INSERT INTO user_robots (user_id, robot_id) VALUES ($1, $2) RETURNING id",
        [req.user!.sub, robot.id]
      );

      return {
        user_robot_id: urRow.rows[0].id,
        gmo_balance_after: updatedUserRow.rows[0].gmo_balance,
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});
