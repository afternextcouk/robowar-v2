import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { query, queryOne } from "../db";
import { AppError } from "../middleware/errorHandler";

export const pilotsRouter = Router();

pilotsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const pilots = await query("SELECT * FROM pilots WHERE user_id = $1 ORDER BY created_at DESC", [req.user!.sub]);
    res.json({ data: pilots });
  } catch (err) { next(err); }
});

pilotsRouter.get("/:id", async (req, res, next) => {
  try {
    const pilot = await queryOne("SELECT * FROM pilots WHERE id = $1", [req.params.id]);
    if (!pilot) throw new AppError("NOT_FOUND", "Pilot not found", 404);
    res.json(pilot);
  } catch (err) { next(err); }
});
