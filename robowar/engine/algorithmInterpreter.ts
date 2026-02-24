/**
 * algorithmInterpreter.ts — Evaluates algorithm rules each turn
 * ROBOWAR V2 — FATİH (Game Engine Specialist)
 *
 * Takes BattleState + a robot's AlgorithmRule[] → returns the chosen Action.
 * Rules are sorted by priority (descending) and the first matching condition wins.
 * Falls back to USE_MEDIUM_ATTACK if no rule matches.
 */

import {
  Action,
  AlgorithmRule,
  BattleState,
  Condition,
  RobotBattleState,
  StatusEffect,
} from "./types";
import { hasAdvantage } from "./elementAdvantage";

// ─────────────────────────────────────────────
// HP % helpers
// ─────────────────────────────────────────────

function hpPct(bot: RobotBattleState): number {
  return (bot.currentHp / bot.stats.hp) * 100;
}

// ─────────────────────────────────────────────
// Condition evaluators
// ─────────────────────────────────────────────

function evaluateCondition(
  condition: Condition,
  conditionValue: number | undefined,
  self: RobotBattleState,
  enemy: RobotBattleState,
  state: BattleState
): boolean {
  const threshold = conditionValue ?? 0;

  switch (condition) {
    case Condition.MY_HP_BELOW:
      return hpPct(self) < threshold;

    case Condition.MY_HP_ABOVE:
      return hpPct(self) > threshold;

    case Condition.ENEMY_HP_BELOW:
      return hpPct(enemy) < threshold;

    case Condition.ENEMY_HP_ABOVE_80:
      return hpPct(enemy) > 80;

    case Condition.ENEMY_HP_DROPPING_FAST: {
      // "Dropping fast" = lost >15% HP in last 3 recorded turns
      if (enemy.recentHpHistory.length < 2) return false;
      const oldest = enemy.recentHpHistory[0];
      const latest = enemy.recentHpHistory[enemy.recentHpHistory.length - 1];
      const dropped = ((oldest - latest) / enemy.stats.hp) * 100;
      return dropped > (threshold || 15);
    }

    case Condition.MY_ATTACK_MOVES_EXHAUSTED:
      // True when energy is too low to use any super attack
      return (
        self.currentEnergy < self.stats.superAttack1.energyCost &&
        self.currentEnergy < self.stats.superAttack2.energyCost
      );

    case Condition.ENEMY_LAST_MOVE_WAS_HEAVY_ATTACK:
      return enemy.lastAction === Action.USE_HEAVY_ATTACK;

    case Condition.ENEMY_LAST_MOVE_WAS_DEFENSE:
      return (
        enemy.lastAction === Action.FULL_DEFENSE ||
        enemy.lastAction === Action.PARTIAL_DEFENSE
      );

    case Condition.MY_ENERGY_CRITICAL:
      // Energy is below threshold% of capacity
      return (
        (self.currentEnergy / self.stats.energyCapacity) * 100 <
        (threshold || 20)
      );

    case Condition.ROUND_NUMBER_ABOVE:
      return state.round > threshold;

    case Condition.ENEMY_ELEMENT_ADVANTAGE:
      // Enemy's element beats ours
      return hasAdvantage(enemy.stats.element, self.stats.element);

    case Condition.ENEMY_ELEMENT_DISADVANTAGE:
      // Our element beats the enemy's
      return hasAdvantage(self.stats.element, enemy.stats.element);

    case Condition.I_AM_STUNNED:
      return self.statusEffects.includes(StatusEffect.STUN);

    case Condition.MY_SUPER_AVAILABLE:
      return (
        self.currentEnergy >= self.stats.superAttack1.energyCost ||
        self.currentEnergy >= self.stats.superAttack2.energyCost
      );

    case Condition.CONSECUTIVE_HITS_ABOVE:
      return self.consecutiveHits > threshold;

    case Condition.MISS_STREAK_ABOVE:
      return self.missStreak > threshold;

    default:
      return false;
  }
}

// ─────────────────────────────────────────────
// Main interpreter
// ─────────────────────────────────────────────

/**
 * Given the current BattleState and the rule set for the acting robot,
 * evaluate rules in descending priority order and return the first matching Action.
 *
 * @param state   Full battle state snapshot
 * @param selfKey Which robot is acting ("robot1" | "robot2")
 * @param rules   The robot's AlgorithmRule array
 * @returns       The chosen Action
 */
export function interpretAlgorithm(
  state: BattleState,
  selfKey: "robot1" | "robot2",
  rules: AlgorithmRule[]
): Action {
  const enemyKey = selfKey === "robot1" ? "robot2" : "robot1";
  const self  = state[selfKey];
  const enemy = state[enemyKey];

  // Sort rules highest priority first (stable sort)
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    const matches = evaluateCondition(
      rule.condition,
      rule.conditionValue,
      self,
      enemy,
      state
    );

    if (matches) {
      return rule.action;
    }
  }

  // Default fallback
  return Action.USE_MEDIUM_ATTACK;
}
