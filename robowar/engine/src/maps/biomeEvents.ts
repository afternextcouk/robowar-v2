/**
 * ROBOWAR V2 — Biome Random Events
 *
 * 4 biomes: GRASSLAND, DESERT, SNOWFIELD, CITY
 * Events fire with 5% probability per tick (LCG-controlled).
 */
import type { BiomeEvent, BiomeType, FighterState } from "../core/types";
import type { LCG } from "../core/lcg";

type BiomeEventDef = Omit<BiomeEvent, "applyFn"> & {
  applyFn: (p1: FighterState, p2: FighterState, lcg: LCG) => void;
};

export const BIOME_EVENTS: Record<BiomeType, BiomeEventDef[]> = {
  GRASSLAND: [
    {
      id: "GRASS_HEAL_WIND",
      name: "Healing Breeze",
      description: "A warm breeze restores 5 HP to both fighters.",
      applyFn: (p1, p2) => {
        p1.hp = Math.min(p1.maxHp, p1.hp + 5);
        p2.hp = Math.min(p2.maxHp, p2.hp + 5);
      },
    },
    {
      id: "GRASS_SPEED_BOOST",
      name: "Tailwind",
      description: "A gust grants +10 speed to the slower fighter for 3 ticks.",
      applyFn: (p1, p2) => {
        const target = p1.speed < p2.speed ? p1 : p2;
        target.statusEffects.push({
          id: "TAILWIND",
          name: "Tailwind",
          type: "BUFF",
          remainingTicks: 3,
          stacks: 1,
          modifier: { speed: 10 },
        });
      },
    },
    {
      id: "GRASS_WILD_CHARGE",
      name: "Wild Stampede",
      description: "A stampede deals 8 damage to both fighters.",
      applyFn: (p1, p2) => {
        p1.hp = Math.max(0, p1.hp - 8);
        p2.hp = Math.max(0, p2.hp - 8);
      },
    },
  ],

  DESERT: [
    {
      id: "DESERT_HEAT",
      name: "Scorching Heat",
      description: "Intense heat deals 5 damage to both fighters.",
      applyFn: (p1, p2) => {
        p1.hp = Math.max(0, p1.hp - 5);
        p2.hp = Math.max(0, p2.hp - 5);
      },
    },
    {
      id: "DESERT_SANDSTORM",
      name: "Sandstorm",
      description: "A sandstorm reduces both fighters' defense by 5 for 2 ticks.",
      applyFn: (p1, p2) => {
        for (const f of [p1, p2]) {
          f.statusEffects.push({
            id: "SANDSTORM",
            name: "Sandstorm",
            type: "DEBUFF",
            remainingTicks: 2,
            stacks: 1,
            modifier: { defense: -5 },
          });
        }
      },
    },
    {
      id: "DESERT_MIRAGE",
      name: "Mirage",
      description: "A mirage causes the faster fighter to lose 3 energy.",
      applyFn: (p1, p2) => {
        const target = p1.speed > p2.speed ? p1 : p2;
        target.energy = Math.max(0, target.energy - 3);
      },
    },
    {
      id: "DESERT_OASIS",
      name: "Hidden Oasis",
      description: "An oasis restores 10 energy to both fighters.",
      applyFn: (p1, p2) => {
        p1.energy = Math.min(p1.maxEnergy, p1.energy + 10);
        p2.energy = Math.min(p2.maxEnergy, p2.energy + 10);
      },
    },
  ],

  SNOWFIELD: [
    {
      id: "SNOW_FREEZE",
      name: "Deep Freeze",
      description: "Extreme cold deals 6 damage to both fighters.",
      applyFn: (p1, p2) => {
        p1.hp = Math.max(0, p1.hp - 6);
        p2.hp = Math.max(0, p2.hp - 6);
      },
    },
    {
      id: "SNOW_AVALANCHE",
      name: "Avalanche",
      description: "An avalanche deals 12 damage to a random fighter.",
      applyFn: (p1, p2, lcg) => {
        const target = lcg.chance(0.5) ? p1 : p2;
        target.hp = Math.max(0, target.hp - 12);
      },
    },
    {
      id: "SNOW_CRYO_BOOST",
      name: "Cryo Resonance",
      description: "CRYO robots gain 10 HP from the cold environment.",
      applyFn: (_p1, _p2) => {
        // Applied at BattleEngine level based on element
        // Stub: engine calls this and checks element
      },
    },
    {
      id: "SNOW_SLICK_ICE",
      name: "Black Ice",
      description: "Slippery terrain reduces speed of both fighters by 8 for 1 tick.",
      applyFn: (p1, p2) => {
        for (const f of [p1, p2]) {
          f.statusEffects.push({
            id: "BLACK_ICE",
            name: "Black Ice",
            type: "DEBUFF",
            remainingTicks: 1,
            stacks: 1,
            modifier: { speed: -8 },
          });
        }
      },
    },
  ],

  CITY: [
    {
      id: "CITY_EMP",
      name: "EMP Surge",
      description: "An EMP drains 5 energy from both fighters.",
      applyFn: (p1, p2) => {
        p1.energy = Math.max(0, p1.energy - 5);
        p2.energy = Math.max(0, p2.energy - 5);
      },
    },
    {
      id: "CITY_POWER_UP",
      name: "Power Grid Access",
      description: "Tapping the city grid grants 8 energy to the fighter with less energy.",
      applyFn: (p1, p2) => {
        const target = p1.energy < p2.energy ? p1 : p2;
        target.energy = Math.min(target.maxEnergy, target.energy + 8);
      },
    },
    {
      id: "CITY_TURRET",
      name: "Rogue Turret",
      description: "A rogue city turret fires, dealing 10 damage to a random fighter.",
      applyFn: (p1, p2, lcg) => {
        const target = lcg.chance(0.5) ? p1 : p2;
        target.hp = Math.max(0, target.hp - 10);
      },
    },
    {
      id: "CITY_NANO_SWARM",
      name: "Nano Swarm",
      description: "NANO robots absorb the city's pollution for a 7 HP heal.",
      applyFn: (_p1, _p2) => {
        // Element-conditional — handled in engine
      },
    },
  ],
};
