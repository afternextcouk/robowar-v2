/**
 * types.ts — All TypeScript interfaces and enums for the ROBOWAR V2 battle engine
 * FATİH (Game Engine Specialist)
 */

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export enum Element {
  VOLT = "VOLT",
  PYRO = "PYRO",
  CRYO = "CRYO",
  NANO = "NANO",
  VOID = "VOID",
  IRON = "IRON",
}

export enum StatusEffect {
  NONE    = "NONE",
  STUN    = "STUN",    // skip 1 turn
  BURN    = "BURN",    // 5% HP/turn
  FREEZE  = "FREEZE",  // SPD halved
  POISON  = "POISON",  // 3% HP/turn
}

export enum Condition {
  MY_HP_BELOW                    = "MY_HP_BELOW",
  MY_HP_ABOVE                    = "MY_HP_ABOVE",
  ENEMY_HP_BELOW                 = "ENEMY_HP_BELOW",
  ENEMY_HP_DROPPING_FAST         = "ENEMY_HP_DROPPING_FAST",
  MY_ATTACK_MOVES_EXHAUSTED      = "MY_ATTACK_MOVES_EXHAUSTED",
  ENEMY_LAST_MOVE_WAS_HEAVY_ATTACK = "ENEMY_LAST_MOVE_WAS_HEAVY_ATTACK",
  ENEMY_LAST_MOVE_WAS_DEFENSE    = "ENEMY_LAST_MOVE_WAS_DEFENSE",
  MY_ENERGY_CRITICAL             = "MY_ENERGY_CRITICAL",
  ROUND_NUMBER_ABOVE             = "ROUND_NUMBER_ABOVE",
  ENEMY_ELEMENT_ADVANTAGE        = "ENEMY_ELEMENT_ADVANTAGE",
  ENEMY_ELEMENT_DISADVANTAGE     = "ENEMY_ELEMENT_DISADVANTAGE",
  I_AM_STUNNED                   = "I_AM_STUNNED",
  ENEMY_HP_ABOVE_80              = "ENEMY_HP_ABOVE_80",
  MY_SUPER_AVAILABLE             = "MY_SUPER_AVAILABLE",
  CONSECUTIVE_HITS_ABOVE         = "CONSECUTIVE_HITS_ABOVE",
  MISS_STREAK_ABOVE              = "MISS_STREAK_ABOVE",
}

export enum Action {
  USE_HEAVY_ATTACK   = "USE_HEAVY_ATTACK",
  USE_LIGHT_ATTACK   = "USE_LIGHT_ATTACK",
  USE_MEDIUM_ATTACK  = "USE_MEDIUM_ATTACK",
  USE_SUPER_ATTACK_1 = "USE_SUPER_ATTACK_1",
  USE_SUPER_ATTACK_2 = "USE_SUPER_ATTACK_2",
  FULL_DEFENSE       = "FULL_DEFENSE",
  PARTIAL_DEFENSE    = "PARTIAL_DEFENSE",
  HEALING_ROUTINE    = "HEALING_ROUTINE",
  ELEMENT_BURST      = "ELEMENT_BURST",
  ANALYZE_ENEMY      = "ANALYZE_ENEMY",
  COUNTER_STANCE     = "COUNTER_STANCE",
}

// ─────────────────────────────────────────────
// ROBOT STATS
// ─────────────────────────────────────────────

export interface SuperAttack {
  name: string;
  /** Base damage multiplier (e.g. 2.5 = 250% of ATK) */
  damageMultiplier: number;
  /** Energy cost to execute */
  energyCost: number;
  /** Optional status effect applied on hit */
  statusEffect?: StatusEffect;
  /** Probability of status effect applying (0–1) */
  statusChance?: number;
}

export interface PassiveTrait {
  name: string;
  description: string;
  /** E.g. "ON_HIT_BURN_CHANCE" | "LIFESTEAL" | "COUNTER_ON_BLOCK" etc. */
  traitType: string;
  value: number; // e.g. 0.15 = 15%
}

export interface RobotStats {
  id: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  energyCapacity: number;
  energyCostPerBattle: number;
  element: Element;
  superAttack1: SuperAttack;
  superAttack2: SuperAttack;
  passiveTrait: PassiveTrait;
  /** 1–5 rarity / power tier */
  tier: number;
}

// ─────────────────────────────────────────────
// ALGORITHM RULES
// ─────────────────────────────────────────────

export interface AlgorithmRule {
  condition: Condition;
  /** Numeric threshold for conditions that require one (e.g. HP%, round number) */
  conditionValue?: number;
  action: Action;
  /** Higher number = checked first */
  priority: number;
}

// ─────────────────────────────────────────────
// BATTLE STATE (snapshot of a single robot mid-battle)
// ─────────────────────────────────────────────

export interface RobotBattleState {
  stats: RobotStats;
  currentHp: number;
  currentEnergy: number;
  currentSpd: number; // may differ from base due to FREEZE / buffs
  statusEffects: StatusEffect[];
  /** How many turns each status effect has remaining */
  statusDurations: Partial<Record<StatusEffect, number>>;
  lastAction: Action | null;
  consecutiveHits: number;
  missStreak: number;
  superUsedThisBattle: boolean;
  /** Permanent accumulated stat bonuses from Stat Gift System */
  statGifts: Partial<Pick<RobotStats, "hp" | "atk" | "def" | "spd">>;
  /** Running HP history for "dropping fast" detection (last 3 turns) */
  recentHpHistory: number[];
  /** Total kills across career */
  totalKills: number;
  /** Evolution stage (0 = base, increments at kill milestones) */
  evolutionStage: number;
  /** Kills since last stat gift */
  killsSinceLastGift: number;
}

export interface BattleState {
  round: number;
  robot1: RobotBattleState;
  robot2: RobotBattleState;
  seed: number;
}

// ─────────────────────────────────────────────
// TURN & BATTLE RESULTS
// ─────────────────────────────────────────────

export interface TurnEvent {
  actorId: string;
  action: Action;
  damage?: number;
  healing?: number;
  statusApplied?: StatusEffect;
  statusCured?: StatusEffect;
  missed?: boolean;
  critical?: boolean;
  elementMultiplier?: number;
  narrative?: string;
}

export interface TurnResult {
  round: number;
  events: TurnEvent[];
  robot1HpAfter: number;
  robot2HpAfter: number;
  robot1Action: Action;
  robot2Action: Action;
  /** Which robot acted first this turn (by SPD) */
  firstActorId: string;
}

export interface StatGiftEvent {
  robotId: string;
  stat: keyof Pick<RobotStats, "hp" | "atk" | "def" | "spd">;
  amount: number;
  killMilestone: number;
}

export interface EvolutionEvent {
  robotId: string;
  newStage: number;
  killMilestone: number;
  narrative: string;
}

export interface BattleResult {
  winnerId: string | null; // null = draw
  loserId: string | null;
  rounds: number;
  turns: TurnResult[];
  robot1FinalHpPct: number;
  robot2FinalHpPct: number;
  /** ID of robot that exhausted the opponent's HP, or null on timeout draw */
  knockoutBy: string | null;
  statGiftEvents: StatGiftEvent[];
  evolutionEvents: EvolutionEvent[];
  /** The seed used — deterministically reproducible with same inputs */
  seed: number;
}
