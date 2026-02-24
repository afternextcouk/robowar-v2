/**
 * combatEngine.ts — Main battle resolver for ROBOWAR V2
 * FATİH (Game Engine Specialist)
 *
 * runBattle(robot1, robot2, algo1, algo2, seed) → BattleResult
 *
 * Core rules:
 *  - SIMULTANEOUS damage resolution (YPY-49 fix): both robots choose their
 *    action and damage is calculated BEFORE any HP changes are applied.
 *    The faster robot gets a +10% accuracy bonus but the slower one still
 *    attacks in the same round. Speed only determines tie-breaking priority.
 *  - Damage formula: (ATK * multiplier) - (DEF * 0.5) ± LCG variance 10%
 *  - Status effects: STUN (skip 1 turn), BURN (5% HP/turn), FREEZE (SPD halved), POISON (3% HP/turn)
 *  - Max 50 rounds → highest HP% wins
 *  - Stat Gift System: every 3-4 kills → random permanent stat bonus
 *  - Evolution triggers: at 3, 10, 25, 50 total kills
 *
 * YPY-46 fix: Each runBattle() call instantiates its own `new LCG(seed)`
 *   — no shared module-level singleton, concurrent battles stay independent.
 * YPY-49 fix: Simultaneous damage resolution — both robots always attack in
 *   the same round; speed only grants a small accuracy bonus.
 */

import { LCG } from "./lcg";
import {
  Action,
  AlgorithmRule,
  BattleResult,
  BattleState,
  EvolutionEvent,
  RobotBattleState,
  RobotStats,
  StatGiftEvent,
  StatusEffect,
  TurnEvent,
  TurnResult,
} from "./types";
import { interpretAlgorithm } from "./algorithmInterpreter";
import { getElementMultiplier } from "./elementAdvantage";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const MAX_ROUNDS = 50;
const LCG_VARIANCE = 0.10; // ±10%
const HP_HISTORY_WINDOW = 3;

/**
 * Accuracy bonus for the faster robot (YPY-49).
 * When a robot is faster it retains full damage; the slower robot's raw
 * damage is scaled down by this fraction (i.e. slower robot deals ~90%).
 */
const SPEED_ACCURACY_BONUS = 0.10; // 10% advantage for the faster robot

/** Kill milestones that trigger evolution */
const EVOLUTION_MILESTONES = [3, 10, 25, 50];
/** How many kills between stat gifts */
const GIFT_INTERVAL_MIN = 3;
const GIFT_INTERVAL_MAX = 4;

// Stat gift amounts per stat
const STAT_GIFT_AMOUNTS: Record<string, number> = {
  hp:  50,
  atk: 5,
  def: 3,
  spd: 2,
};

// Action multipliers
const ACTION_MULTIPLIERS: Record<Action, number> = {
  [Action.USE_HEAVY_ATTACK]:   1.8,
  [Action.USE_MEDIUM_ATTACK]:  1.0,
  [Action.USE_LIGHT_ATTACK]:   0.6,
  [Action.USE_SUPER_ATTACK_1]: 0.0, // handled separately
  [Action.USE_SUPER_ATTACK_2]: 0.0, // handled separately
  [Action.FULL_DEFENSE]:       0.0, // no damage dealt
  [Action.PARTIAL_DEFENSE]:    0.4, // counter chip
  [Action.HEALING_ROUTINE]:    0.0,
  [Action.ELEMENT_BURST]:      1.4,
  [Action.ANALYZE_ENEMY]:      0.0,
  [Action.COUNTER_STANCE]:     0.0,
};

/** Flat defense multiplier when FULL_DEFENSE is active */
const FULL_DEFENSE_REDUCTION  = 0.85; // block 85%
const PARTIAL_DEFENSE_REDUCTION = 0.45; // block 45%

/**
 * Minimum element multiplier floor (YPY-50).
 * Even at full element disadvantage a robot deals at least 70% of its base
 * damage. With the ±10% balancing fix the worst case is already 0.90 × base,
 * but this floor acts as a safety net against any future multiplier changes.
 */
const ELEMENT_MULTIPLIER_FLOOR = 0.70;

// ─────────────────────────────────────────────
// PENDING ACTION — carries a fully-calculated
// result that has NOT yet been applied to state.
// Enables simultaneous damage resolution (YPY-49).
// ─────────────────────────────────────────────

interface PendingAction {
  actorId:            string;
  action:             Action;
  damageToTarget:     number;
  healingToSelf:      number;
  energyCostToSelf:   number;
  energyRegenToSelf:  number;
  statusToApplyOnTarget?: { effect: StatusEffect; duration: number };
  speedPenaltyOnTarget?: boolean; // FREEZE via ELEMENT_BURST
  narrative:          string;
  elementMultiplier?: number;
  missed:             boolean;
  isFallback:         boolean;  // true when super was chosen but energy insufficient
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hpPct(bot: RobotBattleState): number {
  return (bot.currentHp / bot.stats.hp) * 100;
}

function isAlive(bot: RobotBattleState): boolean {
  return bot.currentHp > 0;
}

function nextGiftInterval(lcg: LCG): number {
  return lcg.nextInt(GIFT_INTERVAL_MIN, GIFT_INTERVAL_MAX);
}

// ─────────────────────────────────────────────
// ROBOT BATTLE STATE INITIALIZATION
// ─────────────────────────────────────────────

function initBattleState(stats: RobotStats): RobotBattleState {
  return {
    stats,
    currentHp:    stats.hp,
    currentEnergy: stats.energyCapacity * 0.5, // start at 50% energy
    currentSpd:   stats.spd,
    statusEffects: [],
    statusDurations: {},
    lastAction:   null,
    consecutiveHits: 0,
    missStreak:   0,
    superUsedThisBattle: false,
    statGifts:    {},
    recentHpHistory: [stats.hp],
    totalKills:   0,
    evolutionStage: 0,
    killsSinceLastGift: 0,
  };
}

// ─────────────────────────────────────────────
// STATUS EFFECT PROCESSING
// ─────────────────────────────────────────────

function applyStatusTickDamage(
  bot: RobotBattleState,
  events: TurnEvent[]
): void {
  if (bot.statusEffects.includes(StatusEffect.BURN)) {
    const dmg = Math.round(bot.stats.hp * 0.05);
    bot.currentHp = Math.max(0, bot.currentHp - dmg);
    events.push({
      actorId: bot.stats.id,
      action:  Action.USE_MEDIUM_ATTACK, // placeholder (tick)
      damage:  dmg,
      narrative: `🔥 ${bot.stats.name} suffers BURN — ${dmg} HP lost`,
    });
  }

  if (bot.statusEffects.includes(StatusEffect.POISON)) {
    const dmg = Math.round(bot.stats.hp * 0.03);
    bot.currentHp = Math.max(0, bot.currentHp - dmg);
    events.push({
      actorId: bot.stats.id,
      action:  Action.USE_MEDIUM_ATTACK,
      damage:  dmg,
      narrative: `☠️ ${bot.stats.name} suffers POISON — ${dmg} HP lost`,
    });
  }
}

function tickStatusDurations(bot: RobotBattleState): void {
  const toRemove: StatusEffect[] = [];
  for (const se of bot.statusEffects) {
    if (se === StatusEffect.NONE) continue;
    const dur = (bot.statusDurations[se] ?? 1) - 1;
    if (dur <= 0) {
      toRemove.push(se);
    } else {
      bot.statusDurations[se] = dur;
    }
  }
  for (const se of toRemove) {
    bot.statusEffects = bot.statusEffects.filter(e => e !== se);
    delete bot.statusDurations[se];
    // Restore SPD if FREEZE expired
    if (se === StatusEffect.FREEZE) {
      bot.currentSpd = bot.stats.spd + (bot.statGifts.spd ?? 0);
    }
  }
}

function applyStatus(bot: RobotBattleState, status: StatusEffect, duration: number): void {
  if (!bot.statusEffects.includes(status)) {
    bot.statusEffects.push(status);
  }
  bot.statusDurations[status] = duration;

  if (status === StatusEffect.FREEZE) {
    bot.currentSpd = Math.max(1, Math.floor(bot.currentSpd / 2));
  }
}

// ─────────────────────────────────────────────
// STAT GIFT SYSTEM
// ─────────────────────────────────────────────

function checkStatGift(
  bot: RobotBattleState,
  giftEvents: StatGiftEvent[],
  giftIntervalRef: { next: number },
  lcg: LCG
): void {
  bot.killsSinceLastGift += 1;

  if (bot.killsSinceLastGift >= giftIntervalRef.next) {
    bot.killsSinceLastGift = 0;
    giftIntervalRef.next = nextGiftInterval(lcg);

    const stats = ["hp", "atk", "def", "spd"] as const;
    const chosen = stats[lcg.nextInt(0, stats.length - 1)];
    const amount = STAT_GIFT_AMOUNTS[chosen];

    bot.statGifts[chosen] = (bot.statGifts[chosen] ?? 0) + amount;
    if (chosen === "hp") {
      bot.currentHp = Math.min(
        bot.stats.hp + bot.statGifts.hp!,
        bot.currentHp + amount
      );
    }
    if (chosen === "spd" && !bot.statusEffects.includes(StatusEffect.FREEZE)) {
      bot.currentSpd += amount;
    }

    giftEvents.push({
      robotId:      bot.stats.id,
      stat:         chosen,
      amount,
      killMilestone: bot.totalKills,
    });
  }
}

// ─────────────────────────────────────────────
// EVOLUTION SYSTEM
// ─────────────────────────────────────────────

const EVOLUTION_NARRATIVES = [
  "sparks with newfound power — Stage 2 UNLOCKED",
  "core overclocks — Stage 3 AWAKENED",
  "chassis transforms — Stage 4 ASCENDANT",
  "transcends its limits — Stage 5 APEX FORM",
];

function checkEvolution(
  bot: RobotBattleState,
  evoEvents: EvolutionEvent[]
): void {
  for (const milestone of EVOLUTION_MILESTONES) {
    if (bot.totalKills === milestone && bot.evolutionStage < EVOLUTION_MILESTONES.indexOf(milestone) + 1) {
      bot.evolutionStage = EVOLUTION_MILESTONES.indexOf(milestone) + 1;

      // Stat bonuses per evolution stage
      const bonusAtkPct = 0.05 * bot.evolutionStage;
      const bonusDefPct = 0.03 * bot.evolutionStage;
      bot.stats = {
        ...bot.stats,
        atk: Math.round(bot.stats.atk * (1 + bonusAtkPct)),
        def: Math.round(bot.stats.def * (1 + bonusDefPct)),
      };

      const narrative = EVOLUTION_NARRATIVES[bot.evolutionStage - 1] ?? "evolves!";
      evoEvents.push({
        robotId:      bot.stats.id,
        newStage:     bot.evolutionStage,
        killMilestone: milestone,
        narrative:    `${bot.stats.name} ${narrative}`,
      });
      break;
    }
  }
}

// ─────────────────────────────────────────────
// DAMAGE CALCULATION
// ─────────────────────────────────────────────

function calcDamage(
  atk: number,
  def: number,
  actionMultiplier: number,
  elementMultiplier: number,
  lcg: LCG
): number {
  // YPY-50: enforce a minimum element multiplier so a robot always deals at
  // least ELEMENT_MULTIPLIER_FLOOR (70%) of its base damage regardless of
  // element disadvantage. With the ±10% fix the real-world floor is 0.90,
  // but this clamp guards against any future regression.
  const effectiveElemMult = Math.max(ELEMENT_MULTIPLIER_FLOOR, elementMultiplier);
  const variance = 1 + lcg.nextFloat(-LCG_VARIANCE, LCG_VARIANCE);
  const raw = (atk * actionMultiplier * effectiveElemMult * variance) - (def * 0.5);
  return Math.max(1, Math.round(raw));
}

// ─────────────────────────────────────────────
// ACTION CALCULATION PHASE (READ-ONLY)
// Determines what the actor WILL do and calculates
// all numbers — does NOT modify any state yet.
// This allows simultaneous resolution (YPY-49).
// ─────────────────────────────────────────────

function calcPendingAction(
  actor:   RobotBattleState,
  target:  RobotBattleState,
  action:  Action,
  speedAdvantage: boolean, // true when this robot is faster
  lcg: LCG
): PendingAction {
  const elemMult = getElementMultiplier(actor.stats.element, target.stats.element);
  const targetDefending = target.lastAction === Action.FULL_DEFENSE || target.lastAction === Action.PARTIAL_DEFENSE;
  const defReduction = target.lastAction === Action.FULL_DEFENSE
    ? FULL_DEFENSE_REDUCTION
    : target.lastAction === Action.PARTIAL_DEFENSE
      ? PARTIAL_DEFENSE_REDUCTION
      : 0;

  // Speed bonus: faster robot gets full damage; slower robot is penalised (YPY-49)
  const speedMult = speedAdvantage ? 1.0 : (1.0 - SPEED_ACCURACY_BONUS);

  const energyRegenToSelf = Math.round(actor.stats.energyCapacity * 0.08);
  const baseAtk = actor.stats.atk + (actor.statGifts.atk ?? 0);
  const baseDef = target.stats.def + (target.statGifts.def ?? 0);

  const pending: PendingAction = {
    actorId:            actor.stats.id,
    action,
    damageToTarget:     0,
    healingToSelf:      0,
    energyCostToSelf:   0,
    energyRegenToSelf,
    narrative:          "",
    elementMultiplier:  elemMult,
    missed:             false,
    isFallback:         false,
  };

  switch (action) {
    // ── Damage moves ─────────────────────────
    case Action.USE_HEAVY_ATTACK:
    case Action.USE_LIGHT_ATTACK:
    case Action.USE_MEDIUM_ATTACK:
    case Action.ELEMENT_BURST: {
      const mult = ACTION_MULTIPLIERS[action];
      let dmg = calcDamage(baseAtk, baseDef, mult, elemMult, lcg);
      dmg = Math.round(dmg * speedMult);
      if (targetDefending) {
        dmg = Math.max(1, Math.round(dmg * (1 - defReduction)));
      }
      pending.damageToTarget = dmg;

      // ELEMENT_BURST status chance
      if (action === Action.ELEMENT_BURST) {
        const statusMap: Record<string, StatusEffect> = {
          VOLT: StatusEffect.STUN,
          CRYO: StatusEffect.FREEZE,
          PYRO: StatusEffect.BURN,
          NANO: StatusEffect.POISON,
          VOID: StatusEffect.POISON,
          IRON: StatusEffect.STUN,
        };
        const se = statusMap[actor.stats.element];
        if (se && lcg.next() < 0.35) {
          pending.statusToApplyOnTarget = { effect: se, duration: 2 };
        }
      }

      // HEAVY_ATTACK small stun chance
      if (action === Action.USE_HEAVY_ATTACK && lcg.next() < 0.10) {
        pending.statusToApplyOnTarget = { effect: StatusEffect.STUN, duration: 1 };
      }

      pending.narrative = `${actor.stats.name} → ${action} → ${target.stats.name} [${dmg} dmg]`;
      break;
    }

    // ── Super Attacks ────────────────────────
    case Action.USE_SUPER_ATTACK_1:
    case Action.USE_SUPER_ATTACK_2: {
      const superAtk = action === Action.USE_SUPER_ATTACK_1
        ? actor.stats.superAttack1
        : actor.stats.superAttack2;

      if (actor.currentEnergy < superAtk.energyCost) {
        // Fall back to medium attack
        const fallback = calcPendingAction(actor, target, Action.USE_MEDIUM_ATTACK, speedAdvantage, lcg);
        fallback.isFallback = true;
        return fallback;
      }

      let dmg = calcDamage(baseAtk, baseDef, superAtk.damageMultiplier, elemMult, lcg);
      dmg = Math.round(dmg * speedMult);
      if (targetDefending) dmg = Math.max(1, Math.round(dmg * (1 - defReduction)));

      pending.damageToTarget = dmg;
      pending.energyCostToSelf = superAtk.energyCost;

      if (superAtk.statusEffect && superAtk.statusChance && lcg.next() < superAtk.statusChance) {
        pending.statusToApplyOnTarget = { effect: superAtk.statusEffect, duration: 2 };
      }

      pending.narrative = `⚡ ${actor.stats.name} → ${superAtk.name} [SUPER] → ${target.stats.name} [${dmg} dmg]`;
      break;
    }

    // ── Defensive moves ──────────────────────
    case Action.FULL_DEFENSE:
      pending.narrative = `🛡️ ${actor.stats.name} takes FULL DEFENSE stance`;
      break;

    case Action.PARTIAL_DEFENSE:
      pending.narrative = `🔰 ${actor.stats.name} takes PARTIAL DEFENSE stance`;
      break;

    // ── Healing Routine ──────────────────────
    case Action.HEALING_ROUTINE: {
      const healPct = 0.12 + lcg.next() * 0.06; // 12-18% of max HP
      const healed  = Math.round(actor.stats.hp * healPct);
      pending.healingToSelf = healed;
      pending.narrative = `💊 ${actor.stats.name} runs HEALING_ROUTINE — +${healed} HP`;
      break;
    }

    // ── Utility moves ────────────────────────
    case Action.ANALYZE_ENEMY:
      pending.narrative = `🔍 ${actor.stats.name} ANALYZES ${target.stats.name}`;
      break;

    case Action.COUNTER_STANCE:
      pending.narrative = `↩️ ${actor.stats.name} enters COUNTER_STANCE`;
      break;

    default:
      break;
  }

  return pending;
}

// ─────────────────────────────────────────────
// ACTION APPLICATION PHASE
// Takes a pre-calculated PendingAction and applies
// it to the actor + target states.
// Returns the TurnEvent and actual damage dealt.
// ─────────────────────────────────────────────

function applyPendingAction(
  actor:   RobotBattleState,
  target:  RobotBattleState,
  pending: PendingAction,
  giftEvents: StatGiftEvent[],
  evoEvents:  EvolutionEvent[],
  giftIntervalRef: { next: number },
  lcg: LCG
): { event: TurnEvent; damageDealt: number } {
  // Apply energy changes
  actor.currentEnergy = Math.max(0, actor.currentEnergy - pending.energyCostToSelf);
  actor.currentEnergy = Math.min(
    actor.stats.energyCapacity,
    actor.currentEnergy + pending.energyRegenToSelf
  );

  // Apply healing to self
  if (pending.healingToSelf > 0) {
    actor.currentHp = Math.min(
      actor.stats.hp + (actor.statGifts.hp ?? 0),
      actor.currentHp + pending.healingToSelf
    );
  }

  // Apply damage to target (HP was already reduced in the simultaneous phase,
  // here we just record the status effect if any)
  if (pending.statusToApplyOnTarget) {
    applyStatus(target, pending.statusToApplyOnTarget.effect, pending.statusToApplyOnTarget.duration);
  }

  // Track consecutive hits / miss streaks
  if (pending.damageToTarget > 0) {
    actor.consecutiveHits += 1;
    actor.missStreak = 0;
  } else if (pending.action !== Action.FULL_DEFENSE &&
             pending.action !== Action.PARTIAL_DEFENSE &&
             pending.action !== Action.HEALING_ROUTINE &&
             pending.action !== Action.ANALYZE_ENEMY &&
             pending.action !== Action.COUNTER_STANCE) {
    actor.missStreak += 1;
    actor.consecutiveHits = 0;
  }

  if (pending.action === Action.FULL_DEFENSE || pending.action === Action.PARTIAL_DEFENSE) {
    actor.consecutiveHits = 0;
  }

  // Record last action
  actor.lastAction = pending.action;

  const event: TurnEvent = {
    actorId:           pending.actorId,
    action:            pending.action,
    damage:            pending.damageToTarget > 0 ? pending.damageToTarget : undefined,
    healing:           pending.healingToSelf > 0 ? pending.healingToSelf : undefined,
    elementMultiplier: pending.elementMultiplier,
    statusApplied:     pending.statusToApplyOnTarget?.effect,
    narrative:         pending.narrative,
    missed:            pending.missed,
  };

  // Check if target was KO'd — credit kill
  if (!isAlive(target)) {
    actor.totalKills += 1;
    checkStatGift(actor, giftEvents, giftIntervalRef, lcg);
    checkEvolution(actor, evoEvents);
  }

  return { event, damageDealt: pending.damageToTarget };
}

// ─────────────────────────────────────────────
// COUNTER_STANCE REFLECTION
// ─────────────────────────────────────────────

function handleCounterStanceReflect(
  attacker: RobotBattleState,
  defender: RobotBattleState,
  incomingDamage: number,
  events: TurnEvent[]
): void {
  if (defender.lastAction === Action.COUNTER_STANCE && incomingDamage > 0) {
    const reflect = Math.round(incomingDamage * 0.3);
    attacker.currentHp = Math.max(0, attacker.currentHp - reflect);
    events.push({
      actorId:   defender.stats.id,
      action:    Action.COUNTER_STANCE,
      damage:    reflect,
      narrative: `↩️ ${defender.stats.name} COUNTER_STANCE reflects ${reflect} damage back!`,
    });
  }
}

// ─────────────────────────────────────────────
// RUN BATTLE — PUBLIC API
// ─────────────────────────────────────────────

export function runBattle(
  robot1: RobotStats,
  robot2: RobotStats,
  algo1:  AlgorithmRule[],
  algo2:  AlgorithmRule[],
  seedValue: number
): BattleResult {
  // YPY-46: Create a dedicated LCG instance per battle — no shared singleton.
  const lcg = new LCG(seedValue);

  const r1 = initBattleState(robot1);
  const r2 = initBattleState(robot2);

  const turns: TurnResult[] = [];
  const giftEvents: StatGiftEvent[] = [];
  const evoEvents:  EvolutionEvent[] = [];

  // Each robot tracks its own gift interval independently
  const r1GiftInterval = { next: nextGiftInterval(lcg) };
  const r2GiftInterval = { next: nextGiftInterval(lcg) };

  let round = 0;

  while (round < MAX_ROUNDS && isAlive(r1) && isAlive(r2)) {
    round++;

    const state: BattleState = { round, robot1: r1, robot2: r2, seed: seedValue };
    const roundEvents: TurnEvent[] = [];

    // ── Status ticks (start of round) ────────
    applyStatusTickDamage(r1, roundEvents);
    applyStatusTickDamage(r2, roundEvents);

    if (!isAlive(r1) || !isAlive(r2)) break;

    // ── Speed comparison — used for accuracy bonus only (YPY-49) ─────────
    // When speeds are equal, a coin-flip via LCG decides the tie.
    let r1HasSpeedAdvantage: boolean;
    if (r1.currentSpd > r2.currentSpd) {
      r1HasSpeedAdvantage = true;
    } else if (r2.currentSpd > r1.currentSpd) {
      r1HasSpeedAdvantage = false;
    } else {
      // Tie — random; one robot gets advantage, neither is excluded from attacking
      r1HasSpeedAdvantage = lcg.nextBool();
    }

    // ── PHASE 1: Both robots evaluate their algorithm & choose an action ──
    // This happens BEFORE any damage is applied (simultaneous resolution).
    const r1Action = interpretAlgorithm(state, "robot1", algo1);
    const r2Action = interpretAlgorithm(state, "robot2", algo2);

    // ── PHASE 2: Calculate pending actions for both (no state mutation) ──
    let r1Pending: PendingAction | null = null;
    let r2Pending: PendingAction | null = null;

    if (r1.statusEffects.includes(StatusEffect.STUN)) {
      // Stunned — skip their attack
      roundEvents.push({
        actorId:   r1.stats.id,
        action:    r1Action,
        narrative: `⚡ ${r1.stats.name} is STUNNED and loses their turn!`,
        missed:    true,
      });
      r1.lastAction = r1Action;
    } else {
      r1Pending = calcPendingAction(r1, r2, r1Action, r1HasSpeedAdvantage, lcg);
    }

    if (r2.statusEffects.includes(StatusEffect.STUN)) {
      roundEvents.push({
        actorId:   r2.stats.id,
        action:    r2Action,
        narrative: `⚡ ${r2.stats.name} is STUNNED and loses their turn!`,
        missed:    true,
      });
      r2.lastAction = r2Action;
    } else {
      r2Pending = calcPendingAction(r2, r1, r2Action, !r1HasSpeedAdvantage, lcg);
    }

    // ── PHASE 3: Apply damage to HP simultaneously ────────────────────────
    // Both HP bars are reduced AT THE SAME TIME — a robot that is killed in
    // this step still dealt its damage (it was already calculated in Phase 2).
    if (r1Pending !== null) {
      r2.currentHp = Math.max(0, r2.currentHp - r1Pending.damageToTarget);
    }
    if (r2Pending !== null) {
      r1.currentHp = Math.max(0, r1.currentHp - r2Pending.damageToTarget);
    }

    // ── PHASE 4: Apply remaining effects (energy, heals, statuses, events) ─
    // Ordered by speed advantage for narrative ordering, but HP was already set.
    const applyOrder: Array<{
      actor: RobotBattleState;
      target: RobotBattleState;
      pending: PendingAction;
      giftRef: { next: number };
    }> = [];

    if (r1HasSpeedAdvantage) {
      if (r1Pending) applyOrder.push({ actor: r1, target: r2, pending: r1Pending, giftRef: r1GiftInterval });
      if (r2Pending) applyOrder.push({ actor: r2, target: r1, pending: r2Pending, giftRef: r2GiftInterval });
    } else {
      if (r2Pending) applyOrder.push({ actor: r2, target: r1, pending: r2Pending, giftRef: r2GiftInterval });
      if (r1Pending) applyOrder.push({ actor: r1, target: r2, pending: r1Pending, giftRef: r1GiftInterval });
    }

    for (const { actor, target, pending, giftRef } of applyOrder) {
      const { event, damageDealt } = applyPendingAction(
        actor, target, pending, giftEvents, evoEvents, giftRef, lcg
      );
      roundEvents.push(event);

      // Counter-stance reflection
      handleCounterStanceReflect(actor, target, damageDealt, roundEvents);
    }

    // ── Tick status durations (end of round) ─
    tickStatusDurations(r1);
    tickStatusDurations(r2);

    // Update HP history
    r1.recentHpHistory.push(r1.currentHp);
    if (r1.recentHpHistory.length > HP_HISTORY_WINDOW) r1.recentHpHistory.shift();

    r2.recentHpHistory.push(r2.currentHp);
    if (r2.recentHpHistory.length > HP_HISTORY_WINDOW) r2.recentHpHistory.shift();

    turns.push({
      round,
      events:        roundEvents,
      robot1HpAfter: r1.currentHp,
      robot2HpAfter: r2.currentHp,
      robot1Action:  r1Action,
      robot2Action:  r2Action,
      firstActorId:  r1HasSpeedAdvantage ? r1.stats.id : r2.stats.id,
    });

    if (!isAlive(r1) || !isAlive(r2)) break;
  }

  // ── Determine winner ─────────────────────
  const r1HpPct = hpPct(r1);
  const r2HpPct = hpPct(r2);

  let winnerId: string | null = null;
  let loserId:  string | null = null;
  let knockoutBy: string | null = null;

  if (!isAlive(r1) && !isAlive(r2)) {
    // Double KO — draw
    winnerId = null;
    loserId  = null;
  } else if (!isAlive(r2)) {
    winnerId   = r1.stats.id;
    loserId    = r2.stats.id;
    knockoutBy = r1.stats.id;
  } else if (!isAlive(r1)) {
    winnerId   = r2.stats.id;
    loserId    = r1.stats.id;
    knockoutBy = r2.stats.id;
  } else {
    // Timeout — compare HP percentages
    if (r1HpPct > r2HpPct) {
      winnerId = r1.stats.id;
      loserId  = r2.stats.id;
    } else if (r2HpPct > r1HpPct) {
      winnerId = r2.stats.id;
      loserId  = r1.stats.id;
    }
    // exact tie → draw (winnerId remains null)
  }

  return {
    winnerId,
    loserId,
    rounds:           round,
    turns,
    robot1FinalHpPct: clamp(r1HpPct, 0, 100),
    robot2FinalHpPct: clamp(r2HpPct, 0, 100),
    knockoutBy,
    statGiftEvents:   giftEvents,
    evolutionEvents:  evoEvents,
    seed:             seedValue,
  };
}
