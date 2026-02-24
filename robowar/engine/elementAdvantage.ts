/**
 * elementAdvantage.ts — Element superiority matrix
 * ROBOWAR V2 — FATİH (Game Engine Specialist)
 *
 * Circular chain: VOLT > CRYO > PYRO > NANO > VOID > IRON > VOLT
 * +10% damage on advantage, -10% damage on disadvantage, 1.0 neutral.
 * YPY-50 fix: reduced from ±20% to ±10% to prevent 100% win-rate counter matchups.
 */

import { Element } from "./types";

/**
 * Directed "beats" map: key beats every element in its value array.
 *
 *   VOLT  beats CRYO
 *   CRYO  beats PYRO
 *   PYRO  beats NANO
 *   NANO  beats VOID
 *   VOID  beats IRON
 *   IRON  beats VOLT
 */
const BEATS: Record<Element, Element> = {
  [Element.VOLT]: Element.CRYO,
  [Element.CRYO]: Element.PYRO,
  [Element.PYRO]: Element.NANO,
  [Element.NANO]: Element.VOID,
  [Element.VOID]: Element.IRON,
  [Element.IRON]: Element.VOLT,
};

export const ADVANTAGE_MULTIPLIER    = 1.1;  // +10%  (YPY-50: was 1.2)
export const DISADVANTAGE_MULTIPLIER = 0.9;  // -10%  (YPY-50: was 0.8)
export const NEUTRAL_MULTIPLIER      = 1.0;

/**
 * Returns the damage multiplier when `attacker` attacks `defender`.
 *
 * @param attacker — attacking robot's element
 * @param defender — defending robot's element
 * @returns 1.1 (advantage) | 0.9 (disadvantage) | 1.0 (neutral)
 */
export function getElementMultiplier(attacker: Element, defender: Element): number {
  if (attacker === defender) return NEUTRAL_MULTIPLIER;

  if (BEATS[attacker] === defender) return ADVANTAGE_MULTIPLIER;
  if (BEATS[defender] === attacker) return DISADVANTAGE_MULTIPLIER;

  return NEUTRAL_MULTIPLIER;
}

/**
 * Returns true if `element` has a type advantage over `opponent`.
 */
export function hasAdvantage(element: Element, opponent: Element): boolean {
  return BEATS[element] === opponent;
}

/**
 * Returns true if `element` has a type disadvantage against `opponent`.
 */
export function hasDisadvantage(element: Element, opponent: Element): boolean {
  return BEATS[opponent] === element;
}

/**
 * Full advantage lookup table (for UI / debug display).
 * Returns { [attacker]: { [defender]: multiplier } }
 */
export function buildAdvantageMatrix(): Record<Element, Record<Element, number>> {
  const elements = Object.values(Element) as Element[];
  const matrix = {} as Record<Element, Record<Element, number>>;
  for (const atk of elements) {
    matrix[atk] = {} as Record<Element, number>;
    for (const def of elements) {
      matrix[atk][def] = getElementMultiplier(atk, def);
    }
  }
  return matrix;
}
