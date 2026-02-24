/**
 * ROBOWAR V2 — Elemental Advantage Matrix
 *
 * 6 elements: VOLT, PYRO, CRYO, NANO, VOID, IRON
 *
 * Multipliers:
 *   STRONG (1.25×)  — attacker has advantage
 *   NEUTRAL (1.0×) — no advantage
 *   WEAK (0.75×)   — attacker is at a disadvantage
 */
import type { ElementType } from "../core/types";

type AdvantageMatrix = Record<ElementType, Record<ElementType, number>>;

/**
 * matrix[attacker][defender] = damage multiplier
 *
 * Design:
 * VOLT → CRYO (electricity melts ice), IRON (conducts)
 * PYRO → CRYO (heat beats cold), NANO (burns circuits)
 * CRYO → VOLT (freezes conductors), PYRO (suppresses fire)
 * NANO → IRON (corrodes metal), VOID (disrupts void energy)
 * VOID → NANO (absorbs nano-bots), PYRO (smothers fire)
 * IRON → VOLT (grounds it), VOID (dense matter resists void)
 */
const matrix: AdvantageMatrix = {
  VOLT: {
    VOLT: 1.00,
    PYRO: 1.00,
    CRYO: 1.25,
    NANO: 0.75,
    VOID: 1.00,
    IRON: 1.25,
  },
  PYRO: {
    VOLT: 1.00,
    PYRO: 1.00,
    CRYO: 1.25,
    NANO: 1.25,
    VOID: 0.75,
    IRON: 0.75,
  },
  CRYO: {
    VOLT: 1.25,
    PYRO: 1.25,
    CRYO: 1.00,
    NANO: 1.00,
    VOID: 0.75,
    IRON: 0.75,
  },
  NANO: {
    VOLT: 0.75,
    PYRO: 0.75,
    CRYO: 1.00,
    NANO: 1.00,
    VOID: 1.25,
    IRON: 1.25,
  },
  VOID: {
    VOLT: 1.00,
    PYRO: 1.25,
    CRYO: 1.25,
    NANO: 1.25,
    VOID: 1.00,
    IRON: 0.75,
  },
  IRON: {
    VOLT: 1.25,
    PYRO: 1.00,
    CRYO: 1.00,
    NANO: 0.75,
    VOID: 1.25,
    IRON: 1.00,
  },
};

export const ELEMENT_MATRIX = {
  multiplier(attacker: ElementType, defender: ElementType): number {
    return matrix[attacker][defender] ?? 1.0;
  },

  isStrong(attacker: ElementType, defender: ElementType): boolean {
    return this.multiplier(attacker, defender) > 1.0;
  },

  isWeak(attacker: ElementType, defender: ElementType): boolean {
    return this.multiplier(attacker, defender) < 1.0;
  },

  getStrongAgainst(element: ElementType): ElementType[] {
    return (Object.keys(matrix[element]) as ElementType[]).filter(
      (e) => matrix[element][e] > 1.0
    );
  },

  getWeakAgainst(element: ElementType): ElementType[] {
    return (Object.keys(matrix[element]) as ElementType[]).filter(
      (e) => matrix[element][e] < 1.0
    );
  },
};
