/**
 * ROBOWAR V2 — Battles API
 * Battle history, replay data, and matchmaking queue.
 *
 * Backend routes:
 *   POST   /v2/battles/queue          — Join matchmaking
 *   DELETE /v2/battles/queue          — Leave matchmaking
 *   GET    /v2/battles                — Battle history (paginated, filterable)
 *   GET    /v2/battles/live           — Currently live battles
 *   GET    /v2/battles/:id            — Single battle
 *   GET    /v2/battles/:id/replay     — Replay ticks + LCG seed
 */

import { api } from './client';
import type {
  Battle,
  BattleTick,
  BattleMode,
  PaginatedResponse,
} from '../types';

// ─── Matchmaking Queue ───────────────────────────────────────────────────────

export interface JoinQueuePayload {
  mode?: BattleMode;
  robot_id: string;
  algorithm_id: string;
  pilot_id?: string;
  gmo_wager?: number;
}

export interface JoinQueueResult {
  queue_id: string;
  estimated_wait_s: number;
}

/** Enter matchmaking queue. Returns queue_id and estimated wait time. */
export async function joinQueue(payload: JoinQueuePayload): Promise<JoinQueueResult> {
  return api.post<JoinQueueResult>('/battles/queue', payload);
}

/** Leave matchmaking queue (cancels the waiting entry). */
export async function leaveQueue(): Promise<void> {
  return api.delete('/battles/queue');
}

// ─── History ─────────────────────────────────────────────────────────────────

export interface BattleHistoryParams {
  user_id?: string;
  mode?: BattleMode;
  status?: string;
  limit?: number;
  offset?: number;
}

/** Get paginated battle history with optional filters. */
export async function listBattles(
  params: BattleHistoryParams = {}
): Promise<PaginatedResponse<Battle>> {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  ).toString();

  return api.get<PaginatedResponse<Battle>>(`/battles${qs ? `?${qs}` : ''}`);
}

/** Get the list of currently live (IN_PROGRESS) battles. */
export async function listLiveBattles(): Promise<{ data: Battle[] }> {
  return api.get<{ data: Battle[] }>('/battles/live');
}

/** Get a single battle by ID. */
export async function getBattle(id: string): Promise<Battle> {
  return api.get<Battle>(`/battles/${id}`);
}

// ─── Replay ──────────────────────────────────────────────────────────────────

export interface ReplayData {
  lcg_seed: number;
  ticks: BattleTick[];
}

/**
 * Fetch the full replay data for a completed battle.
 * Contains LCG seed (for deterministic re-simulation) and all tick snapshots.
 */
export async function getBattleReplay(id: string): Promise<ReplayData> {
  return api.get<ReplayData>(`/battles/${id}/replay`);
}
