/**
 * ROBOWAR V2 — Robots API
 * CRUD calls for robot catalog and user-owned robots.
 *
 * Backend routes: GET/POST /v2/robots, GET /v2/robots/:id
 *                 POST /v2/robots/:robotId/purchase
 *                 GET  /v2/users/me/robots  (user-owned robots)
 */

import { api } from './client';
import type { Robot, UserRobot, PaginatedResponse } from '../types';

// ─── Catalog (public) ────────────────────────────────────────────────────────

/** List all robots available in the catalog. */
export async function listRobots(): Promise<PaginatedResponse<Robot>> {
  return api.get<PaginatedResponse<Robot>>('/robots');
}

/** Get a single robot by ID or slug. */
export async function getRobot(idOrSlug: string): Promise<Robot> {
  return api.get<Robot>(`/robots/${idOrSlug}`);
}

// ─── User-owned robots ───────────────────────────────────────────────────────

/** List robots owned by the authenticated user. */
export async function listMyRobots(): Promise<PaginatedResponse<UserRobot>> {
  return api.get<PaginatedResponse<UserRobot>>('/users/me/robots');
}

// ─── Purchase ────────────────────────────────────────────────────────────────

export interface PurchaseResult {
  user_robot_id: string;
  gmo_balance_after: number;
}

/**
 * Purchase a robot from the catalog with GMO tokens.
 * Backend deducts GMO and assigns robot in a single transaction.
 */
export async function purchaseRobot(robotId: string): Promise<PurchaseResult> {
  return api.post<PurchaseResult>(`/robots/${robotId}/purchase`);
}

// ─── Upgrade (nickname, etc.) ────────────────────────────────────────────────

export interface RobotUpdatePayload {
  nickname?: string;
}

/** Update a user-owned robot (e.g. set nickname). */
export async function updateMyRobot(
  userRobotId: string,
  payload: RobotUpdatePayload
): Promise<UserRobot> {
  return api.put<UserRobot>(`/users/me/robots/${userRobotId}`, payload);
}
