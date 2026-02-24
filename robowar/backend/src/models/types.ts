// ─── Database row types ──────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  wallet_address: string | null;
  gmo_balance: number;
  eldr_balance: string;
  xp: number;
  level: number;
  avatar_url: string | null;
  is_banned: boolean;
  ban_reason: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  role?: string;
}

export interface Robot {
  id: string;
  slug: string;
  display_name: string;
  element: "VOLT" | "PYRO" | "CRYO" | "NANO" | "VOID" | "IRON";
  tier: "T1" | "T2" | "T3";
  sprite_atlas: string;
  base_hp: number;
  base_attack: number;
  base_defense: number;
  base_speed: number;
  base_energy: number;
  energy_regen: number;
  strong_vs: string[];
  weak_vs: string[];
  biome_bonus: Record<string, number>;
  gmo_cost: number;
  is_starter: boolean;
  unlock_level: number;
}

export interface Algorithm {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  rule_tree: Record<string, unknown>;
  is_valid: boolean;
  validation_errors: string[] | null;
  times_used: number;
  win_rate: number | null;
  version: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Battle {
  id: string;
  mode: "RANKED" | "CASUAL" | "TOURNAMENT" | "AI";
  status: "MATCHMAKING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "DISPUTED";
  biome: "GRASSLAND" | "DESERT" | "SNOWFIELD" | "CITY";
  player1_id: string;
  player2_id: string | null;
  player1_robot_id: string;
  player2_robot_id: string | null;
  player1_algo_id: string;
  player2_algo_id: string | null;
  player1_pilot_id: string | null;
  player2_pilot_id: string | null;
  winner_id: string | null;
  is_draw: boolean;
  total_ticks: number | null;
  lcg_seed: number;
  battle_log: Record<string, unknown>[] | null;
  gmo_wagered: number;
  gmo_winner_gain: number | null;
  eldr_wagered: string;
  eldr_winner_gain: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Pilot {
  id: string;
  user_id: string;
  name: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  nft_token_id: number | null;
  sprite_key: string;
  stat_hp_mod: number;
  stat_attack_mod: number;
  stat_defense_mod: number;
  stat_speed_mod: number;
  stat_energy_mod: number;
  battles_fought: number;
  battles_won: number;
  created_at: string;
}
