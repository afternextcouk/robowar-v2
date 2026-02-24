import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { query, queryOne } from "../db";

export const economyRouter = Router();

economyRouter.get("/rates", async (_req, res) => {
  res.json({ gmo_per_eldr: 1000, min_eldr_deposit: "0.01", max_eldr_withdraw: "100.0", withdraw_fee_pct: 2.5 });
});

economyRouter.get("/balance", requireAuth, async (req, res, next) => {
  try {
    const user = await queryOne<{ gmo_balance: number; eldr_balance: string }>("SELECT gmo_balance, eldr_balance FROM users WHERE id = $1", [req.user!.sub]);
    res.json({ gmo_balance: user?.gmo_balance, eldr_balance_offchain: user?.eldr_balance, eldr_balance_onchain: user?.eldr_balance, synced_at: new Date().toISOString() });
  } catch (err) { next(err); }
});

economyRouter.get("/transactions", requireAuth, async (req, res, next) => {
  try {
    const txs = await query("SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50", [req.user!.sub]);
    res.json({ data: txs, total: txs.length });
  } catch (err) { next(err); }
});
