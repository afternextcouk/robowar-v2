/**
 * ROBOWAR V2 — Algorithms API
 * Full CRUD for user battle algorithms.
 *
 * Backend routes: GET/POST /v2/algorithms
 *                 GET/PUT/DELETE /v2/algorithms/:id
 *                 POST /v2/algorithms/:id/activate
 */

import { api } from './client';
import type { Algorithm, RuleTree, PaginatedResponse } from '../types';

// ─── List ────────────────────────────────────────────────────────────────────

/** List all active (non-archived) algorithms for the authenticated user. */
export async function listAlgorithms(): Promise<PaginatedResponse<Algorithm>> {
  return api.get<PaginatedResponse<Algorithm>>('/algorithms');
}

// ─── Get ─────────────────────────────────────────────────────────────────────

/** Get a single algorithm by ID (must belong to authenticated user). */
export async function getAlgorithm(id: string): Promise<Algorithm> {
  return api.get<Algorithm>(`/algorithms/${id}`);
}

// ─── Create ──────────────────────────────────────────────────────────────────

export interface CreateAlgorithmPayload {
  name: string;
  description?: string;
  rule_tree: RuleTree;
}

/** Create a new algorithm draft. */
export async function createAlgorithm(payload: CreateAlgorithmPayload): Promise<Algorithm> {
  return api.post<Algorithm>('/algorithms', payload);
}

// ─── Update ──────────────────────────────────────────────────────────────────

export interface UpdateAlgorithmPayload {
  name?: string;
  description?: string;
  rule_tree?: RuleTree;
}

/**
 * Update an existing algorithm.
 * Each update increments the algorithm's version counter on the backend.
 */
export async function updateAlgorithm(
  id: string,
  payload: UpdateAlgorithmPayload
): Promise<Algorithm> {
  return api.put<Algorithm>(`/algorithms/${id}`, payload);
}

// ─── Delete (soft-archive) ───────────────────────────────────────────────────

/** Soft-delete an algorithm (status → ARCHIVED). */
export async function deleteAlgorithm(id: string): Promise<void> {
  return api.delete(`/algorithms/${id}`);
}

// ─── Activate ────────────────────────────────────────────────────────────────

/**
 * Set an algorithm as the active one.
 * All other algorithms are moved back to DRAFT status.
 */
export async function activateAlgorithm(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/algorithms/${id}/activate`);
}
