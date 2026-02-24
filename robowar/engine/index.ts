/**
 * index.ts — Public API for the ROBOWAR V2 battle engine
 * FATİH (Game Engine Specialist)
 *
 * Single source of truth: combatEngine.ts
 * YPY-44: Removed dual-engine conflict; BattleEngine.ts is now a re-export stub.
 * YPY-46: LCG is now a class — export the class, not a module-level singleton.
 */

// LCG deterministic RNG (class-based, instance per battle)
export { LCG } from "./lcg";

// All types, interfaces, and enums
export * from "./types";

// Element advantage matrix
export {
  getElementMultiplier,
  hasAdvantage,
  hasDisadvantage,
  buildAdvantageMatrix,
  ADVANTAGE_MULTIPLIER,
  DISADVANTAGE_MULTIPLIER,
  NEUTRAL_MULTIPLIER,
} from "./elementAdvantage";

// Algorithm interpreter
export { interpretAlgorithm } from "./algorithmInterpreter";

// Main battle resolver — SINGLE source of truth
export { runBattle } from "./combatEngine";
