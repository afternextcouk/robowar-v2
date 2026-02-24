import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { query, queryOne } from "../db";
import { AppError } from "../middleware/errorHandler";
import { v4 as uuid } from "uuid";

export const algorithmsRouter = Router();

algorithmsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const algos = await query("SELECT * FROM algorithms WHERE user_id = $1 AND status != 'ARCHIVED' ORDER BY updated_at DESC", [req.user!.sub]);
    res.json({ data: algos, total: algos.length });
  } catch (err) { next(err); }
});

algorithmsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const { name, description, rule_tree } = req.body;
    if (!name || !rule_tree) throw new AppError("VALIDATION_ERROR", "name and rule_tree required", 400);
    const id = uuid();
    const [algo] = await query("INSERT INTO algorithms (id, user_id, name, description, rule_tree) VALUES ($1,$2,$3,$4,$5) RETURNING *", [id, req.user!.sub, name, description, JSON.stringify(rule_tree)]);
    res.status(201).json(algo);
  } catch (err) { next(err); }
});

algorithmsRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const algo = await queryOne("SELECT * FROM algorithms WHERE id = $1 AND user_id = $2", [req.params.id, req.user!.sub]);
    if (!algo) throw new AppError("NOT_FOUND", "Algorithm not found", 404);
    res.json(algo);
  } catch (err) { next(err); }
});

algorithmsRouter.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const { name, description, rule_tree } = req.body;
    const [algo] = await query("UPDATE algorithms SET name=COALESCE($1,name), description=COALESCE($2,description), rule_tree=COALESCE($3,rule_tree), updated_at=NOW(), version=version+1 WHERE id=$4 AND user_id=$5 RETURNING *", [name, description, JSON.stringify(rule_tree), req.params.id, req.user!.sub]);
    if (!algo) throw new AppError("NOT_FOUND", "Algorithm not found", 404);
    res.json(algo);
  } catch (err) { next(err); }
});

algorithmsRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await query("UPDATE algorithms SET status='ARCHIVED' WHERE id=$1 AND user_id=$2", [req.params.id, req.user!.sub]);
    res.status(204).send();
  } catch (err) { next(err); }
});

algorithmsRouter.post("/:id/activate", requireAuth, async (req, res, next) => {
  try {
    await query("UPDATE algorithms SET status='DRAFT' WHERE user_id=$1 AND status='ACTIVE'", [req.user!.sub]);
    await query("UPDATE algorithms SET status='ACTIVE' WHERE id=$1 AND user_id=$2", [req.params.id, req.user!.sub]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
