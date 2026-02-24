/**
 * ROBOWAR V2 — Skill Registry
 *
 * Each skill has an energy cost and an apply function.
 * apply() is called by BattleEngine during the SKILL action.
 */
import type { FighterState, StatusEffect } from "../core/types";
import type { LCG } from "../core/lcg";

export interface SkillResult {
  damage?: number;
  healing?: number;
  statusEffect?: {
    target: "SELF" | "ENEMY";
    effect: StatusEffect;
  };
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  element?: string;
  apply: (self: FighterState, enemy: FighterState, lcg: LCG) => SkillResult;
}

export const SKILLS: Record<string, Skill> = {
  // ─── Universal ────────────────────────────────────────────────
  heal_burst: {
    id: "heal_burst",
    name: "Heal Burst",
    description: "Restores 20% of max HP.",
    energyCost: 5,
    apply: (self) => ({ healing: Math.round(self.maxHp * 0.2) }),
  },

  power_strike: {
    id: "power_strike",
    name: "Power Strike",
    description: "Deals 150% ATK damage.",
    energyCost: 4,
    apply: (self, enemy) => ({
      damage: Math.max(1, Math.round(self.attack * 1.5 - enemy.defense * 0.5)),
    }),
  },

  overcharge_strike: {
    id: "overcharge_strike",
    name: "Overcharge Strike",
    description: "Deals 200% ATK damage but self takes 5% max HP recoil.",
    energyCost: 6,
    apply: (self, enemy) => ({
      damage: Math.max(1, Math.round(self.attack * 2 - enemy.defense)),
      statusEffect: {
        target: "SELF",
        effect: {
          id: "RECOIL",
          name: "Recoil",
          type: "DOT",
          remainingTicks: 1,
          stacks: 1,
          tickDamage: Math.round(self.maxHp * 0.05),
        },
      },
    }),
  },

  iron_wall: {
    id: "iron_wall",
    name: "Iron Wall",
    description: "Increases defense by 20 for 3 ticks.",
    energyCost: 3,
    apply: (_self) => ({
      statusEffect: {
        target: "SELF",
        effect: {
          id: "IRON_WALL",
          name: "Iron Wall",
          type: "BUFF",
          remainingTicks: 3,
          stacks: 1,
          modifier: { defense: 20 },
        },
      },
    }),
  },

  // ─── VOLT ─────────────────────────────────────────────────────
  lightning_bolt: {
    id: "lightning_bolt",
    name: "Lightning Bolt",
    description: "Deals 130% ATK damage, ignores 30% of defense.",
    energyCost: 5,
    element: "VOLT",
    apply: (self, enemy) => ({
      damage: Math.max(1, Math.round(self.attack * 1.3 - enemy.defense * 0.7)),
    }),
  },

  static_field: {
    id: "static_field",
    name: "Static Field",
    description: "Applies Paralysis: enemy loses 10 speed for 3 ticks.",
    energyCost: 4,
    element: "VOLT",
    apply: () => ({
      statusEffect: {
        target: "ENEMY",
        effect: {
          id: "PARALYSIS",
          name: "Paralysis",
          type: "DEBUFF",
          remainingTicks: 3,
          stacks: 1,
          modifier: { speed: -10 },
        },
      },
    }),
  },

  // ─── PYRO ─────────────────────────────────────────────────────
  flame_burst: {
    id: "flame_burst",
    name: "Flame Burst",
    description: "Deals ATK damage + applies Burn (4 DOT for 3 ticks).",
    energyCost: 5,
    element: "PYRO",
    apply: (self, enemy) => ({
      damage: Math.max(1, self.attack - enemy.defense),
      statusEffect: {
        target: "ENEMY",
        effect: {
          id: "BURN",
          name: "Burn",
          type: "DOT",
          remainingTicks: 3,
          stacks: 1,
          tickDamage: 4,
        },
      },
    }),
  },

  // ─── CRYO ─────────────────────────────────────────────────────
  blizzard: {
    id: "blizzard",
    name: "Blizzard",
    description: "Deals ATK damage + applies Freeze (enemy loses 15 speed for 2 ticks).",
    energyCost: 6,
    element: "CRYO",
    apply: (self, enemy) => ({
      damage: Math.max(1, self.attack - enemy.defense),
      statusEffect: {
        target: "ENEMY",
        effect: {
          id: "FREEZE",
          name: "Freeze",
          type: "DEBUFF",
          remainingTicks: 2,
          stacks: 1,
          modifier: { speed: -15 },
        },
      },
    }),
  },

  // ─── NANO ─────────────────────────────────────────────────────
  nano_repair: {
    id: "nano_repair",
    name: "Nano Repair",
    description: "Heals 30% of max HP over 3 ticks.",
    energyCost: 5,
    element: "NANO",
    apply: (self) => ({
      statusEffect: {
        target: "SELF",
        effect: {
          id: "NANO_REPAIR",
          name: "Nano Repair",
          type: "HOT",
          remainingTicks: 3,
          stacks: 1,
          tickHeal: Math.round(self.maxHp * 0.1),
        },
      },
    }),
  },

  // ─── VOID ─────────────────────────────────────────────────────
  void_drain: {
    id: "void_drain",
    name: "Void Drain",
    description: "Steals 5 energy from the enemy.",
    energyCost: 3,
    element: "VOID",
    apply: (_, enemy) => {
      const drained = Math.min(enemy.energy, 5);
      enemy.energy -= drained;
      return {};
    },
  },

  // ─── IRON ─────────────────────────────────────────────────────
  iron_crush: {
    id: "iron_crush",
    name: "Iron Crush",
    description: "Deals 170% ATK damage, ignores defense.",
    energyCost: 7,
    element: "IRON",
    apply: (self) => ({
      damage: Math.round(self.attack * 1.7),
    }),
  },
};
