// ─── Engine Types ────────────────────────────────────────────────────────────

export type ElementType = "VOLT" | "PYRO" | "CRYO" | "NANO" | "VOID" | "IRON";
export type BiomeType = "GRASSLAND" | "DESERT" | "SNOWFIELD" | "CITY";
export type ActionType = "ATTACK" | "SKILL" | "DEFEND" | "MOVE" | "CHARGE_ENERGY" | "IDLE";

export interface RobotConfig {
  id: string;
  element: ElementType;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  energy: number;
  energyRegen: number;
  strongVs: ElementType[];
  weakVs: ElementType[];
  biomeBonus: Partial<Record<BiomeType, number>>;
}

export interface PilotConfig {
  hpMod: number;       // percentage modifier
  attackMod: number;
  defenseMod: number;
  speedMod: number;
  energyMod: number;
}

export interface FighterState {
  robotId: string;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  attack: number;
  defense: number;
  speed: number;
  position: [number, number];
  statusEffects: StatusEffect[];
  isDefending: boolean;
}

export interface StatusEffect {
  id: string;
  name: string;
  type: "BUFF" | "DEBUFF" | "DOT" | "HOT";
  remainingTicks: number;
  stacks: number;
  modifier?: Partial<Record<keyof FighterState, number>>;
  tickDamage?: number;
  tickHeal?: number;
}

export interface RuleTree {
  version: 2;
  rules: Rule[];
}

export interface Rule {
  priority: number;
  condition: ConditionNode;
  action: ActionNode;
}

export type ConditionNode =
  | { type: "AND"; children: ConditionNode[] }
  | { type: "OR"; children: ConditionNode[] }
  | { type: "NOT"; child: ConditionNode }
  | { type: "ALWAYS" }
  | { type: "COMPARE"; left: string; op: "<" | "<=" | ">" | ">=" | "==" | "!="; right: number }
  | { type: "IN_BIOME"; value: BiomeType }
  | { type: "ENEMY_ELEMENT"; value: ElementType }
  | { type: "TURN_MOD"; divisor: number; remainder: number };

export interface ActionNode {
  type: ActionType;
  skillId?: string;
  target?: "SELF" | "ENEMY";
  direction?: "N" | "S" | "E" | "W";
}

export interface TickResult {
  tick: number;
  lcgState: number;
  p1: TickPlayerState;
  p2: TickPlayerState;
  biomeEvent: BiomeEvent | null;
  winner: "P1" | "P2" | "DRAW" | null;
}

export interface TickPlayerState {
  hp: number;
  energy: number;
  action: ActionType;
  skillId: string | null;
  damageDealt: number;
  damageTaken: number;
  healing: number;
  statusEffects: StatusEffect[];
  position: [number, number];
}

export interface BiomeEvent {
  id: string;
  name: string;
  description: string;
  applyFn: (p1: FighterState, p2: FighterState, lcg: unknown) => void;
}

export interface BattleConfig {
  seed: number;
  biome: BiomeType;
  maxTicks: number;
  p1Robot: RobotConfig;
  p1Pilot: PilotConfig | null;
  p1Rules: RuleTree;
  p2Robot: RobotConfig;
  p2Pilot: PilotConfig | null;
  p2Rules: RuleTree;
}

export interface BattleResult {
  winner: "P1" | "P2" | "DRAW";
  totalTicks: number;
  ticks: TickResult[];
  finalP1Hp: number;
  finalP2Hp: number;
}
