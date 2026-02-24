import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { query, queryOne } from "../db";
import { cache, CK } from "../config/redis";

export const leaderboardRouter = Router();

leaderboardRouter.get("/", async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const cacheKey = CK.leaderboard(Number(offset));
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);
    const data = await query("SELECT * FROM leaderboard ORDER BY rank ASC LIMIT $1 OFFSET $2", [limit, offset]);
    const [{ count }] = await query<{ count: string }>("SELECT COUNT(*) FROM leaderboard");
    const response = { season: 1, data, total: parseInt(count), limit: Number(limit), offset: Number(offset), has_more: Number(offset) + data.length < parseInt(count) };
    await cache.set(cacheKey, response, 60);
    res.json(response);
  } catch (err) { next(err); }
});

leaderboardRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const me = await queryOne<{ rank: number }>("SELECT * FROM leaderboard WHERE user_id = $1", [req.user!.sub]);
    if (!me) return res.json({ rank: null, neighbours: [] });
    const neighbours = await query("SELECT * FROM leaderboard WHERE rank BETWEEN $1 AND $2 ORDER BY rank", [Math.max(1, me.rank - 5), me.rank + 5]);
    res.json({ ...me, neighbours });
  } catch (err) { next(err); }
});
