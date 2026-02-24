import { Router } from "express";
import { requireAdmin } from "../middleware/auth";
import { query } from "../db";
import { jobs } from "../jobs/queues";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get("/users", async (req, res, next) => {
  try {
    const users = await query("SELECT id,username,email,level,is_banned,created_at FROM users ORDER BY created_at DESC LIMIT 100");
    res.json({ data: users });
  } catch (err) { next(err); }
});

adminRouter.patch("/users/:id/ban", async (req, res, next) => {
  try {
    const { banned, reason } = req.body;
    await query("UPDATE users SET is_banned=$1, ban_reason=$2 WHERE id=$3", [banned, reason, req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

adminRouter.post("/leaderboard/refresh", async (_req, res, next) => {
  try {
    await jobs.refreshLeaderboard();
    res.json({ queued: true });
  } catch (err) { next(err); }
});

adminRouter.get("/metrics", async (_req, res) => {
  res.json({ service: "robowar-api", uptime: process.uptime(), memory: process.memoryUsage() });
});
