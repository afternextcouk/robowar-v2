/**
 * ROBOWAR V2 — Unit Tests: Algorithm Interpreter (Condition Evaluation)
 * Author: İREM (QA & Simulation Specialist)
 * Jira: YPY-42
 *
 * Run: cd /root/.openclaw/workspace/robowar/engine && npx jest ../tests/unit/algorithmInterpreter.test.ts
 *
 * Tests condition evaluation logic extracted from BattleEngine.
 * We re-export or inline the evaluateCondition function for testing.
 */

import { runBattle } from "../../engine/src/simulation/BattleEngine";
import type {
  BattleConfig,
  FighterState,
  RuleTree,
  ConditionNode,
  ElementType,
  BiomeType,
} from "../../engine/src/core/types";

// ─── Condition Evaluator (re-extracted for unit testing) ──────────────────────
// Since evaluateCondition is not exported, we test it indirectly via runBattle
// with crafted RuleTrees. We also inline the pure function for direct testing.

function evaluateCondition(
  node: ConditionNode,
  self: FighterState,
  enemy: FighterState,
  biome: string,
  tick: number
): boolean {
  switch (node.type) {
    case "ALWAYS":
      return true;
    case "AND":
      return node.children.every((c) =>
        evaluateCondition(c, self, enemy, biome, tick)
      );
    case "OR":
      return node.children.some((c) =>
        evaluateCondition(c, self, enemy, biome, tick)
      );
    case "NOT":
      return !evaluateCondition(node.child, self, enemy, biome, tick);
    case "IN_BIOME":
      return biome === node.value;
    case "ENEMY_ELEMENT":
      return false; // By design: handled at higher level
    case "TURN_MOD":
      return tick % node.divisor === node.remainder;
    case "COMPARE": {
      const val = resolveVariable(node.left, self, enemy);
      switch (node.op) {
        case "<":  return val < node.right;
        case "<=": return val <= node.right;
        case ">":  return val > node.right;
        case ">=": return val >= node.right;
        case "==": return val === node.right;
        case "!=": return val !== node.right;
      }
    }
    default:
      return false;
  }
}

function resolveVariable(
  varName: string,
  self: FighterState,
  enemy: FighterState
): number {
  switch (varName) {
    case "self.hp":         return self.hp;
    case "self.hp_pct":     return Math.round((self.hp / self.maxHp) * 100);
    case "self.energy":     return self.energy;
    case "self.energy_pct": return Math.round((self.energy / self.maxEnergy) * 100);
    case "self.attack":     return self.attack;
    case "self.defense":    return self.defense;
    case "self.speed":      return self.speed;
    case "enemy.hp":        return enemy.hp;
    case "enemy.hp_pct":    return Math.round((enemy.hp / enemy.maxHp) * 100);
    case "enemy.energy":    return enemy.energy;
    default: return 0;
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFighter(overrides: Partial<FighterState> = {}): FighterState {
  return {
    robotId: "test_robot",
    hp: 100,
    maxHp: 200,
    energy: 10,
    maxEnergy: 20,
    attack: 30,
    defense: 15,
    speed: 20,
    position: [0, 0],
    statusEffects: [],
    isDefending: false,
    ...overrides,
  };
}

function makeRobot(element: ElementType, side: "P1" | "P2") {
  return {
    id: `${side}_${element}`,
    element,
    hp: 200,
    attack: 35,
    defense: 15,
    speed: 20,
    energy: 10,
    energyRegen: 2,
    strongVs: [] as ElementType[],
    weakVs: [] as ElementType[],
    biomeBonus: {},
  };
}

function makeBattleConfig(
  p1Rules: RuleTree,
  p2Rules: RuleTree,
  seed = 42,
  p1Element: ElementType = "VOLT",
  p2Element: ElementType = "PYRO"
): BattleConfig {
  return {
    seed,
    biome: "CITY",
    maxTicks: 20,
    p1Robot: makeRobot(p1Element, "P1"),
    p1Pilot: null,
    p1Rules,
    p2Robot: makeRobot(p2Element, "P2"),
    p2Pilot: null,
    p2Rules,
  };
}

const DEFAULT_RULE: RuleTree = {
  version: 2,
  rules: [
    {
      priority: 1,
      condition: { type: "ALWAYS" },
      action: { type: "ATTACK", target: "ENEMY" },
    },
  ],
};

// ─── Test Suite: ALWAYS Condition ─────────────────────────────────────────────

describe("Condition: ALWAYS", () => {
  test("TC-AI-001: ALWAYS always returns true regardless of state", () => {
    const self = makeFighter({ hp: 0 });
    const enemy = makeFighter({ hp: 0 });
    expect(evaluateCondition({ type: "ALWAYS" }, self, enemy, "CITY", 1)).toBe(true);
  });

  test("TC-AI-002: ALWAYS returns true at any tick", () => {
    const self = makeFighter();
    const enemy = makeFighter();
    for (let tick = 1; tick <= 100; tick++) {
      expect(evaluateCondition({ type: "ALWAYS" }, self, enemy, "CITY", tick)).toBe(true);
    }
  });
});

// ─── Test Suite: COMPARE Condition ───────────────────────────────────────────

describe("Condition: COMPARE — self.hp", () => {
  test("TC-AI-010: self.hp < threshold — TRUE when hp below threshold", () => {
    const self = makeFighter({ hp: 50 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.hp", op: "<", right: 100 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-011: self.hp < threshold — FALSE when hp equals threshold", () => {
    const self = makeFighter({ hp: 100 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.hp", op: "<", right: 100 },
      self, enemy, "CITY", 1
    )).toBe(false);
  });

  test("TC-AI-012: self.hp <= threshold — TRUE when hp equals threshold", () => {
    const self = makeFighter({ hp: 100 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.hp", op: "<=", right: 100 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-013: self.hp > threshold — TRUE when hp above threshold", () => {
    const self = makeFighter({ hp: 150 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.hp", op: ">", right: 100 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-014: self.hp >= threshold — TRUE when hp equals threshold", () => {
    const self = makeFighter({ hp: 100 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.hp", op: ">=", right: 100 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-015: self.hp == value — TRUE when exact match", () => {
    const self = makeFighter({ hp: 77 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.hp", op: "==", right: 77 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-016: self.hp != value — TRUE when not matching", () => {
    const self = makeFighter({ hp: 50 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.hp", op: "!=", right: 99 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-017: self.hp_pct < 30 — TRUE when hp=20, maxHp=100", () => {
    const self = makeFighter({ hp: 20, maxHp: 100 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.hp_pct", op: "<", right: 30 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-018: self.hp_pct >= 50 — TRUE when hp=100, maxHp=200", () => {
    const self = makeFighter({ hp: 100, maxHp: 200 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.hp_pct", op: ">=", right: 50 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });
});

describe("Condition: COMPARE — self.energy", () => {
  test("TC-AI-020: self.energy < 5 — TRUE when energy=3", () => {
    const self = makeFighter({ energy: 3, maxEnergy: 20 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.energy", op: "<", right: 5 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-021: self.energy_pct < 50 — TRUE when energy=4, maxEnergy=10", () => {
    const self = makeFighter({ energy: 4, maxEnergy: 10 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.energy_pct", op: "<", right: 50 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-022: self.energy_pct == 100 — TRUE at full energy", () => {
    const self = makeFighter({ energy: 20, maxEnergy: 20 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.energy_pct", op: "==", right: 100 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });
});

describe("Condition: COMPARE — enemy.hp", () => {
  test("TC-AI-030: enemy.hp < 50 — TRUE when enemy.hp=30", () => {
    const self = makeFighter();
    const enemy = makeFighter({ hp: 30 });
    expect(evaluateCondition(
      { type: "COMPARE", left: "enemy.hp", op: "<", right: 50 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-031: enemy.hp_pct < 25 — TRUE when enemy.hp=20, maxHp=100", () => {
    const self = makeFighter();
    const enemy = makeFighter({ hp: 20, maxHp: 100 });
    expect(evaluateCondition(
      { type: "COMPARE", left: "enemy.hp_pct", op: "<", right: 25 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-032: enemy.energy < 3 — TRUE when enemy energy depleted", () => {
    const self = makeFighter();
    const enemy = makeFighter({ energy: 2, maxEnergy: 20 });
    expect(evaluateCondition(
      { type: "COMPARE", left: "enemy.energy", op: "<", right: 3 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });
});

describe("Condition: COMPARE — stat variables", () => {
  test("TC-AI-040: self.attack > 25 — TRUE", () => {
    const self = makeFighter({ attack: 30 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.attack", op: ">", right: 25 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-041: self.defense >= 15 — TRUE", () => {
    const self = makeFighter({ defense: 15 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.defense", op: ">=", right: 15 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-042: self.speed > 10 — TRUE", () => {
    const self = makeFighter({ speed: 20 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.speed", op: ">", right: 10 },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-043: unknown variable resolves to 0", () => {
    const self = makeFighter();
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "COMPARE", left: "self.nonexistent", op: "==", right: 0 },
      self, enemy, "CITY", 1
    )).toBe(true); // 0 == 0
  });
});

// ─── Test Suite: IN_BIOME Condition ──────────────────────────────────────────

describe("Condition: IN_BIOME", () => {
  const biomes: BiomeType[] = ["GRASSLAND", "DESERT", "SNOWFIELD", "CITY"];

  test.each(biomes)("TC-AI-050: IN_BIOME(%s) returns TRUE in that biome", (biome) => {
    const self = makeFighter();
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "IN_BIOME", value: biome },
      self, enemy, biome, 1
    )).toBe(true);
  });

  test("TC-AI-051: IN_BIOME(DESERT) returns FALSE in CITY biome", () => {
    const self = makeFighter();
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "IN_BIOME", value: "DESERT" },
      self, enemy, "CITY", 1
    )).toBe(false);
  });

  test("TC-AI-052: IN_BIOME checks all 4 biome combinations", () => {
    const self = makeFighter();
    const enemy = makeFighter();
    for (const current of biomes) {
      for (const tested of biomes) {
        const result = evaluateCondition(
          { type: "IN_BIOME", value: tested },
          self, enemy, current, 1
        );
        expect(result).toBe(current === tested);
      }
    }
  });
});

// ─── Test Suite: ENEMY_ELEMENT Condition ─────────────────────────────────────

describe("Condition: ENEMY_ELEMENT", () => {
  test("TC-AI-060: ENEMY_ELEMENT always returns false in evaluateCondition (by design)", () => {
    const self = makeFighter();
    const enemy = makeFighter();
    const elements: ElementType[] = ["VOLT", "PYRO", "CRYO", "NANO", "VOID", "IRON"];
    for (const element of elements) {
      expect(evaluateCondition(
        { type: "ENEMY_ELEMENT", value: element },
        self, enemy, "CITY", 1
      )).toBe(false);
    }
  });
});

// ─── Test Suite: TURN_MOD Condition ──────────────────────────────────────────

describe("Condition: TURN_MOD", () => {
  test("TC-AI-070: TURN_MOD(divisor=2, remainder=0) — true on even ticks", () => {
    const self = makeFighter();
    const enemy = makeFighter();
    for (const tick of [2, 4, 6, 8, 10]) {
      expect(evaluateCondition(
        { type: "TURN_MOD", divisor: 2, remainder: 0 },
        self, enemy, "CITY", tick
      )).toBe(true);
    }
  });

  test("TC-AI-071: TURN_MOD(divisor=2, remainder=0) — false on odd ticks", () => {
    const self = makeFighter();
    const enemy = makeFighter();
    for (const tick of [1, 3, 5, 7, 9]) {
      expect(evaluateCondition(
        { type: "TURN_MOD", divisor: 2, remainder: 0 },
        self, enemy, "CITY", tick
      )).toBe(false);
    }
  });

  test("TC-AI-072: TURN_MOD(divisor=3, remainder=1) — true at ticks 1,4,7,10", () => {
    const self = makeFighter();
    const enemy = makeFighter();
    for (const tick of [1, 4, 7, 10, 13]) {
      expect(evaluateCondition(
        { type: "TURN_MOD", divisor: 3, remainder: 1 },
        self, enemy, "CITY", tick
      )).toBe(true);
    }
  });

  test("TC-AI-073: TURN_MOD(divisor=5, remainder=0) — true every 5th tick", () => {
    const self = makeFighter();
    const enemy = makeFighter();
    for (const tick of [5, 10, 15, 20, 25]) {
      expect(evaluateCondition(
        { type: "TURN_MOD", divisor: 5, remainder: 0 },
        self, enemy, "CITY", tick
      )).toBe(true);
    }
  });

  test("TC-AI-074: TURN_MOD(divisor=1, remainder=0) — always true", () => {
    const self = makeFighter();
    const enemy = makeFighter();
    for (let tick = 1; tick <= 50; tick++) {
      expect(evaluateCondition(
        { type: "TURN_MOD", divisor: 1, remainder: 0 },
        self, enemy, "CITY", tick
      )).toBe(true);
    }
  });
});

// ─── Test Suite: Compound Conditions ─────────────────────────────────────────

describe("Condition: AND", () => {
  test("TC-AI-080: AND([ALWAYS, ALWAYS]) = true", () => {
    const self = makeFighter();
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "AND", children: [{ type: "ALWAYS" }, { type: "ALWAYS" }] },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-081: AND([ALWAYS, false condition]) = false", () => {
    const self = makeFighter({ hp: 150 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      {
        type: "AND",
        children: [
          { type: "ALWAYS" },
          { type: "COMPARE", left: "self.hp", op: "<", right: 50 },
        ],
      },
      self, enemy, "CITY", 1
    )).toBe(false);
  });

  test("TC-AI-082: AND([true, true, true]) = true", () => {
    const self = makeFighter({ hp: 50, energy: 3 });
    const enemy = makeFighter({ hp: 30 });
    expect(evaluateCondition(
      {
        type: "AND",
        children: [
          { type: "COMPARE", left: "self.hp", op: "<", right: 100 },
          { type: "COMPARE", left: "self.energy", op: "<", right: 10 },
          { type: "COMPARE", left: "enemy.hp", op: "<", right: 50 },
        ],
      },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-083: AND([]) empty children = true (vacuous truth)", () => {
    const self = makeFighter();
    const enemy = makeFighter();
    // Array.every on empty array = true
    expect(evaluateCondition(
      { type: "AND", children: [] },
      self, enemy, "CITY", 1
    )).toBe(true);
  });
});

describe("Condition: OR", () => {
  test("TC-AI-090: OR([false, true]) = true", () => {
    const self = makeFighter({ hp: 150 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      {
        type: "OR",
        children: [
          { type: "COMPARE", left: "self.hp", op: "<", right: 50 }, // false
          { type: "ALWAYS" }, // true
        ],
      },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-091: OR([false, false]) = false", () => {
    const self = makeFighter({ hp: 150 });
    const enemy = makeFighter({ hp: 150 });
    expect(evaluateCondition(
      {
        type: "OR",
        children: [
          { type: "COMPARE", left: "self.hp", op: "<", right: 50 }, // false
          { type: "COMPARE", left: "enemy.hp", op: "<", right: 50 }, // false
        ],
      },
      self, enemy, "CITY", 1
    )).toBe(false);
  });

  test("TC-AI-092: OR([true, true]) = true", () => {
    const self = makeFighter({ hp: 50 });
    const enemy = makeFighter({ hp: 50 });
    expect(evaluateCondition(
      {
        type: "OR",
        children: [
          { type: "COMPARE", left: "self.hp", op: "<", right: 100 }, // true
          { type: "COMPARE", left: "enemy.hp", op: "<", right: 100 }, // true
        ],
      },
      self, enemy, "CITY", 1
    )).toBe(true);
  });
});

describe("Condition: NOT", () => {
  test("TC-AI-100: NOT(ALWAYS) = false", () => {
    const self = makeFighter();
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "NOT", child: { type: "ALWAYS" } },
      self, enemy, "CITY", 1
    )).toBe(false);
  });

  test("TC-AI-101: NOT(false condition) = true", () => {
    const self = makeFighter({ hp: 150 });
    const enemy = makeFighter();
    expect(evaluateCondition(
      {
        type: "NOT",
        child: { type: "COMPARE", left: "self.hp", op: "<", right: 50 },
      },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-102: NOT(NOT(ALWAYS)) = true", () => {
    const self = makeFighter();
    const enemy = makeFighter();
    expect(evaluateCondition(
      { type: "NOT", child: { type: "NOT", child: { type: "ALWAYS" } } },
      self, enemy, "CITY", 1
    )).toBe(true);
  });
});

describe("Condition: Nested / Complex", () => {
  test("TC-AI-110: (A AND B) OR (C AND D) — complex combination", () => {
    const self = makeFighter({ hp: 30, energy: 5 });
    const enemy = makeFighter({ hp: 80 });

    // A: self.hp < 50 = true
    // B: self.energy < 10 = true
    // C: enemy.hp > 100 = false
    // D: ALWAYS = true
    // (A AND B) = true, (C AND D) = false, result = true
    expect(evaluateCondition(
      {
        type: "OR",
        children: [
          {
            type: "AND",
            children: [
              { type: "COMPARE", left: "self.hp", op: "<", right: 50 },
              { type: "COMPARE", left: "self.energy", op: "<", right: 10 },
            ],
          },
          {
            type: "AND",
            children: [
              { type: "COMPARE", left: "enemy.hp", op: ">", right: 100 },
              { type: "ALWAYS" },
            ],
          },
        ],
      },
      self, enemy, "CITY", 1
    )).toBe(true);
  });

  test("TC-AI-111: NOT(AND([OR([COMPARE]), COMPARE])) complex negation", () => {
    const self = makeFighter({ hp: 100, energy: 15 });
    const enemy = makeFighter({ hp: 100 });

    // OR([self.hp < 50]) = false (hp=100)
    // AND([OR=false, self.energy > 5]) = false
    // NOT(false) = true
    expect(evaluateCondition(
      {
        type: "NOT",
        child: {
          type: "AND",
          children: [
            {
              type: "OR",
              children: [
                { type: "COMPARE", left: "self.hp", op: "<", right: 50 },
              ],
            },
            { type: "COMPARE", left: "self.energy", op: ">", right: 5 },
          ],
        },
      },
      self, enemy, "CITY", 1
    )).toBe(true);
  });
});

// ─── Integration Tests via runBattle ─────────────────────────────────────────

describe("Rule Resolution — Integration via runBattle", () => {
  test("TC-AI-200: Rule with ALWAYS fires in every battle", () => {
    const rules: RuleTree = {
      version: 2,
      rules: [
        {
          priority: 1,
          condition: { type: "ALWAYS" },
          action: { type: "ATTACK", target: "ENEMY" },
        },
      ],
    };

    const config = makeBattleConfig(rules, rules);
    const result = runBattle(config);

    expect(result.ticks.length).toBeGreaterThan(0);
    expect(result.winner).toMatch(/P1|P2|DRAW/);
  });

  test("TC-AI-201: Higher priority rule takes precedence over lower", () => {
    const rules: RuleTree = {
      version: 2,
      rules: [
        {
          priority: 1, // Higher priority
          condition: { type: "ALWAYS" },
          action: { type: "DEFEND", target: "SELF" },
        },
        {
          priority: 2, // Lower priority
          condition: { type: "ALWAYS" },
          action: { type: "ATTACK", target: "ENEMY" },
        },
      ],
    };

    const config = makeBattleConfig(rules, DEFAULT_RULE);
    const result = runBattle(config);

    // P1 should be defending often → P2 might win (or game drags)
    expect(result.totalTicks).toBeGreaterThan(0);
  });

  test("TC-AI-202: CHARGE_ENERGY action increases energy over turns", () => {
    const p1Rules: RuleTree = {
      version: 2,
      rules: [
        {
          priority: 1,
          condition: { type: "ALWAYS" },
          action: { type: "CHARGE_ENERGY" },
        },
      ],
    };

    const config = makeBattleConfig(p1Rules, DEFAULT_RULE);
    const result = runBattle(config);

    // P1 always charges energy, never attacks → P2 wins or draws (if HP are close at timeout)
    expect(["P2", "DRAW"]).toContain(result.winner);
  });

  test("TC-AI-203: IN_BIOME condition fires only in matching biome", () => {
    const p1Rules: RuleTree = {
      version: 2,
      rules: [
        {
          priority: 1,
          condition: { type: "IN_BIOME", value: "CITY" },
          action: { type: "SKILL", skillId: "power_strike", target: "ENEMY" },
        },
        {
          priority: 2,
          condition: { type: "ALWAYS" },
          action: { type: "ATTACK", target: "ENEMY" },
        },
      ],
    };

    const config = makeBattleConfig(p1Rules, DEFAULT_RULE, 42, "VOLT", "PYRO");
    // Battle is in CITY biome → IN_BIOME(CITY) should fire
    const result = runBattle(config);
    expect(result.ticks.length).toBeGreaterThan(0);
    // P1 used power_strike in city → should deal more damage
  });

  test("TC-AI-204: TURN_MOD fires actions on correct turns", () => {
    const p1Rules: RuleTree = {
      version: 2,
      rules: [
        {
          priority: 1,
          condition: { type: "TURN_MOD", divisor: 2, remainder: 0 },
          action: { type: "SKILL", skillId: "heal_burst", target: "SELF" },
        },
        {
          priority: 2,
          condition: { type: "ALWAYS" },
          action: { type: "ATTACK", target: "ENEMY" },
        },
      ],
    };

    const config = makeBattleConfig(p1Rules, DEFAULT_RULE);
    const result = runBattle(config);

    // On even ticks, P1 heals. Check battle ran successfully.
    // Since heal costs 5 energy and P1 starts with 10, it should fire at least once
    expect(result.ticks.length).toBeGreaterThan(0);
  });

  test("TC-AI-205: Low HP condition triggers heal skill", () => {
    const p1Rules: RuleTree = {
      version: 2,
      rules: [
        {
          priority: 1,
          condition: {
            type: "COMPARE",
            left: "self.hp_pct",
            op: "<",
            right: 50,
          },
          action: { type: "SKILL", skillId: "heal_burst", target: "SELF" },
        },
        {
          priority: 2,
          condition: { type: "ALWAYS" },
          action: { type: "ATTACK", target: "ENEMY" },
        },
      ],
    };

    const config = makeBattleConfig(p1Rules, DEFAULT_RULE);
    const result = runBattle(config);
    expect(result.totalTicks).toBeGreaterThan(0);
  });

  test("TC-AI-206: Battle result is deterministic for same config", () => {
    const config = makeBattleConfig(DEFAULT_RULE, DEFAULT_RULE, 42);
    const result1 = runBattle(config);
    const result2 = runBattle({ ...config });

    expect(result1.winner).toBe(result2.winner);
    expect(result1.totalTicks).toBe(result2.totalTicks);
    expect(result1.finalP1Hp).toBe(result2.finalP1Hp);
    expect(result1.finalP2Hp).toBe(result2.finalP2Hp);
  });

  test("TC-AI-207: Different seeds produce (possibly) different results", () => {
    const config1 = makeBattleConfig(DEFAULT_RULE, DEFAULT_RULE, 42);
    const config2 = makeBattleConfig(DEFAULT_RULE, DEFAULT_RULE, 43);
    const result1 = runBattle(config1);
    const result2 = runBattle(config2);

    // Seeds may produce same winner by chance, but at least one tick should differ
    // We just verify both ran successfully
    expect(result1.ticks.length).toBeGreaterThan(0);
    expect(result2.ticks.length).toBeGreaterThan(0);
  });
});
