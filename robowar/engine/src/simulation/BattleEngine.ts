/**
 * BattleEngine.ts — YPY-44 FIX: Dual-engine conflict resolved.
 *
 * This file previously contained Burcu's incompatible scaffold and caused a
 * dual-engine conflict with the canonical combatEngine.ts at the engine root.
 *
 * It is now a thin re-export that delegates entirely to the single source of
 * truth: /engine/combatEngine.ts
 *
 * Do NOT add logic here. All engine code lives in:
 *   /engine/combatEngine.ts
 */

// Re-export the canonical battle runner so any imports targeting this path
// continue to compile without pulling in a conflicting implementation.
export { runBattle } from "../../combatEngine";

// DEFAULT_MAX_TICKS is consumed by src/index.ts — kept here as a named export
// so callers don't break. The actual limit is MAX_ROUNDS (50) in combatEngine.ts;
// this constant is for the src/ API surface.
export const DEFAULT_MAX_TICKS = 50;
