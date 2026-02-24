// ─── Core Enums ────────────────────────────────────────────────────────────
export type ElementType = "VOLT" | "PYRO" | "CRYO" | "NANO" | "VOID" | "IRON";
export type RobotTier = "T1" | "T2" | "T3";
export type BiomeType = "GRASSLAND" | "DESERT" | "SNOWFIELD" | "CITY";
export type BattleMode = "RANKED" | "CASUAL" | "TOURNAMENT" | "AI";
export type BattleStatus = "MATCHMAKING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "DISPUTED";
export type AlgorithmStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type PilotRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

// ─── User ───────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  email: string;
  wallet_address: string | null;
  gmo_balance: number;
  eldr_balance: string;
  xp: number;
  level: number;
  avatar_url: string | null;
  created_at: string;
}

export interface UserStats {
  battles_total: number;
  battles_won: number;
  battles_lost: number;
  battles_drawn: number;
  win_rate: number;
  rating: number;
  peak_rating: number;
  gmo_earned_total: number;
  eldr_earned_total: string;
  favorite_element: ElementType | null;
  favorite_biome: BiomeType | null;
}

// ─── Robot ──────────────────────────────────────────────────────────────────
export interface Robot {
  id: string;
  slug: string;
  display_name: string;
  element: ElementType;
  tier: RobotTier;
  sprite_atlas: string;
  base_hp: number;
  base_attack: number;
  base_defense: number;
  base_speed: number;
  base_energy: number;
  energy_regen: number;
  strong_vs: ElementType[];
  weak_vs: ElementType[];
  biome_bonus: Partial<Record<BiomeType, number>>;
  gmo_cost: number;
  is_starter: boolean;
}

export interface UserRobot extends Robot {
  user_robot_id: string;
  nickname: string | null;
  upgrade_hp: number;
  upgrade_attack: number;
  upgrade_defense: number;
  upgrade_speed: number;
  acquired_at: string;
}

// ─── Pilot ──────────────────────────────────────────────────────────────────
export interface Pilot {
  id: string;
  user_id: string;
  name: string;
  rarity: PilotRarity;
  nft_token_id: number | null;
  sprite_key: string;
  stat_hp_mod: number;
  stat_attack_mod: number;
  stat_defense_mod: number;
  stat_speed_mod: number;
  stat_energy_mod: number;
  battles_fought: number;
  battles_won: number;
}

// ─── Algorithm ──────────────────────────────────────────────────────────────
export type ConditionType = "AND" | "OR" | "NOT" | "COMPARE" | "IN_BIOME" | "ENEMY_ELEMENT" | "TURN_MOD" | "ALWAYS";
export type ActionType = "ATTACK" | "SKILL" | "DEFEND" | "MOVE" | "CHARGE_ENERGY" | "IDLE";
export type CompareOperator = "<" | "<=" | ">" | ">=" | "==" | "!=";
export type AlgorithmVariable =
  | "self.hp" | "self.hp_pct" | "self.energy" | "self.energy_pct"
  | "self.attack" | "self.defense" | "self.speed"
  | "enemy.hp" | "enemy.hp_pct" | "enemy.energy"
  | "turn_number" | "distance";

export interface ConditionNode {
  type: ConditionType;
  children?: ConditionNode[];
  left?: AlgorithmVariable;
  op?: CompareOperator;
  right?: number | string;
  value?: string;
}

export interface ActionNode {
  type: ActionType;
  skillId?: string;
  target?: "SELF" | "ENEMY" | "NEAREST";
  direction?: "N" | "S" | "E" | "W";
}

export interface AlgorithmRule {
  priority: number;
  condition: ConditionNode;
  action: ActionNode;
}

export interface RuleTree {
  version: 2;
  rules: AlgorithmRule[];
}

export interface Algorithm {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: AlgorithmStatus;
  rule_tree: RuleTree;
  is_valid: boolean;
  validation_errors: string[] | null;
  times_used: number;
  win_rate: number | null;
  version: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Battle ─────────────────────────────────────────────────────────────────
export interface BattlePlayerSnap {
  id: string;
  username: string;
  avatar_url: string | null;
  robot: Robot;
  pilot: Pilot | null;
  rating: number;
}

export interface Battle {
  id: string;
  mode: BattleMode;
  status: BattleStatus;
  biome: BiomeType;
  player1: BattlePlayerSnap;
  player2: BattlePlayerSnap | null;
  winner_id: string | null;
  is_draw: boolean;
  total_ticks: number | null;
  lcg_seed: number;
  gmo_wagered: number;
  gmo_winner_gain: number | null;
  eldr_wagered: string;
  eldr_winner_gain: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface BattleTick {
  tick: number;
  p1: TickState;
  p2: TickState;
  biome_event: BiomeEvent | null;
  lcg_state: number;
}

export interface TickState {
  hp: number;
  energy: number;
  action: ActionType;
  skill_id: string | null;
  damage_dealt: number;
  damage_taken: number;
  healing: number;
  status_effects: StatusEffect[];
  position: [number, number];
}

export interface StatusEffect {
  id: string;
  name: string;
  remaining_ticks: number;
  stacks: number;
}

export interface BiomeEvent {
  id: string;
  name: string;
  description: string;
  effect: Record<string, unknown>;
}

// ─── Leaderboard ────────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  rating: number;
  wins: number;
  losses: number;
  win_rate: number;
}

// ─── Economy ────────────────────────────────────────────────────────────────
export interface EconomyRates {
  gmo_per_eldr: number;
  min_eldr_deposit: string;
  max_eldr_withdraw: string;
  withdraw_fee_pct: number;
}

export interface BalanceSnapshot {
  gmo_balance: number;
  eldr_balance_offchain: string;
  eldr_balance_onchain: string;
  synced_at: string;
}

// ─── WebSocket ──────────────────────────────────────────────────────────────
export interface WsQueueMatched {
  battle_id: string;
  opponent: BattlePlayerSnap;
  biome: BiomeType;
  estimated_start_ms: number;
}

export interface WsBattleEnded {
  winner_id: string | null;
  is_draw: boolean;
  total_ticks: number;
  gmo_delta: number;
  eldr_delta: string;
  rating_delta: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
