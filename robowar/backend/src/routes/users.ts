import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { query, queryOne } from "../db";
import { AppError } from "../middleware/errorHandler";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await queryOne("SELECT id,username,email,wallet_address,gmo_balance,eldr_balance,xp,level,avatar_url,created_at FROM users WHERE id = $1", [req.user!.sub]);
    if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
    res.json(user);
  } catch (err) { next(err); }
});

usersRouter.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const { username, avatar_url } = req.body;
    const user = await queryOne("UPDATE users SET username = COALESCE($1, username), avatar_url = COALESCE($2, avatar_url), updated_at = NOW() WHERE id = $3 RETURNING id,username,avatar_url,level", [username, avatar_url, req.user!.sub]);
    res.json(user);
  } catch (err) { next(err); }
});

usersRouter.get("/me/stats", requireAuth, async (req, res, next) => {
  try {
    const stats = await queryOne("SELECT * FROM leaderboard WHERE user_id = $1", [req.user!.sub]);
    res.json(stats || {});
  } catch (err) { next(err); }
});

usersRouter.get("/me/robots", requireAuth, async (req, res, next) => {
  try {
    const robots = await query("SELECT ur.*, r.* FROM user_robots ur JOIN robots r ON r.id = ur.robot_id WHERE ur.user_id = $1", [req.user!.sub]);
    res.json({ data: robots });
  } catch (err) { next(err); }
});

usersRouter.get("/:id", async (req, res, next) => {
  try {
    const user = await queryOne("SELECT id,username,avatar_url,level FROM users WHERE id = $1", [req.params.id]);
    if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
    res.json(user);
  } catch (err) { next(err); }
});
