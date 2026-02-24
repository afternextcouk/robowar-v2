/**
 * ROBOWAR V2 — Battle Simulation Runner (REWRITTEN for combatEngine.ts API)
 * Author: İREM (QA & Simulation Specialist)
 * Jira: YPY-49
 *
 * Re-written to use the canonical runBattle(robot1, robot2, algo1, algo2, seed)
 * signature from combatEngine.ts after YPY-44 / YPY-49 engine updates.
 *
 * Runs 1000 battles between all element pairs using fixed seeds (0–999).
 * Outputs a win rate matrix. Flags any battles exceeding 50 rounds.
 * Proves determinism via seed-42 replay test.
 *
 * Usage:
 *   cd /root/.openclaw/workspace/robowar
 *   npx tsx tests/simulate.ts
 */

import { runBattle } from "../engine/combatEngine";
import {
  Action,
  AlgorithmRule,
  Condition,
  Element,
  RobotStats,
  StatusEffect,
} from "../engine/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ELEMENTS: Element[] = [
  Element.VOLT,
  Element.PYRO,
  Element.CRYO,
  Element.NANO,
  Element.VOID,
  Element.IRON,
];
const BATTLE_COUNT    = 1000;
const MAX_ROUNDS      = 50;
const WIN_RATE_THRESHOLD = 0.65;

// ─── Robot Factory ────────────────────────────────────────────────────────────

function makeRobot(element: Element, side: "P1" | "P2"): RobotStats {
  return {
    id:               `${side}_${element}`,
    name:             `${side}-${element}`,
    hp:               1000,
    atk:              100,
    def:              35,
    spd:              50,
    energyCapacity:   100,
    energyCostPerBattle: 0,
    element,
    superAttack1: {
      name:             "Power Surge",
      damageMultiplier: 2.5,
      energyCost:       50,
      statusEffect:     StatusEffect.STUN,
      statusChance:     0.25,
    },
    superAttack2: {
      name:             "Annihilate",
      damageMultiplier: 3.2,
      energyCost:       80,
    },
    passiveTrait: {
      name:        "Adaptive",
      description: "Baseline combat trait",
      traitType:   "NONE",
      value:       0,
    },
    tier: 3,
  };
}

// ─── Algorithm (smart attacker) ───────────────────────────────────────────────
// Mirrors the intent of the old SMART_RULES: heal when low, super when available,
// burst on advantage, else heavy attack.

const SMART_ALGO: AlgorithmRule[] = [
  {
    priority:       10,
    condition:      Condition.MY_HP_BELOW,
    conditionValue: 25,
    action:         Action.HEALING_ROUTINE,
  },
  {
    priority: 8,
    condition: Condition.MY_SUPER_AVAILABLE,
    action:    Action.USE_SUPER_ATTACK_1,
  },
  {
    priority: 6,
    condition: Condition.ENEMY_ELEMENT_DISADVANTAGE,
    action:    Action.ELEMENT_BURST,
  },
  {
    priority: 4,
    condition: Condition.ENEMY_HP_DROPPING_FAST,
    action:    Action.USE_HEAVY_ATTACK,
  },
  {
    priority: 3,
    condition: Condition.ENEMY_LAST_MOVE_WAS_HEAVY_ATTACK,
    action:    Action.PARTIAL_DEFENSE,
  },
  {
    // Fallback — always fires (MY_HP_ABOVE 0 is always true in a live battle)
    priority:       1,
    condition:      Condition.MY_HP_ABOVE,
    conditionValue: 0,
    action:         Action.USE_MEDIUM_ATTACK,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map winnerId ("P1_VOLT" | "P2_CRYO" | null) to "P1" | "P2" | "DRAW" */
function resolveWinner(winnerId: string | null, p1Id: string, p2Id: string): "P1" | "P2" | "DRAW" {
  if (!winnerId) return "DRAW";
  if (winnerId === p1Id) return "P1";
  if (winnerId === p2Id) return "P2";
  return "DRAW";
}

// ─── Win Rate Matrix ──────────────────────────────────────────────────────────

interface MatchupResult {
  p1Wins: number;
  p2Wins: number;
  draws:  number;
  total:  number;
  longBattles: number; // battles that hit MAX_ROUNDS
}

type WinMatrix = Record<string, Record<string, MatchupResult>>;

// ─── Determinism Proof ────────────────────────────────────────────────────────

function testDeterminism(): void {
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  DETERMINISM PROOF — Seed 42 (VOLT vs CRYO)");
  console.log("═══════════════════════════════════════════════════");

  const r1a = makeRobot(Element.VOLT, "P1");
  const r2a = makeRobot(Element.CRYO, "P2");
  const r1b = makeRobot(Element.VOLT, "P1");
  const r2b = makeRobot(Element.CRYO, "P2");

  const result1 = runBattle(r1a, r2a, SMART_ALGO, SMART_ALGO, 42);
  const result2 = runBattle(r1b, r2b, SMART_ALGO, SMART_ALGO, 42);

  const isDeterministic =
    result1.winnerId === result2.winnerId &&
    result1.rounds   === result2.rounds   &&
    Math.abs(result1.robot1FinalHpPct - result2.robot1FinalHpPct) < 0.001 &&
    Math.abs(result1.robot2FinalHpPct - result2.robot2FinalHpPct) < 0.001;

  if (isDeterministic) {
    console.log("✅ PASS: Both runs are IDENTICAL");
  } else {
    console.log("❌ FAIL: Runs differ — ENGINE IS NOT DETERMINISTIC!");
    console.log(`   Run1 winner: ${result1.winnerId}  rounds: ${result1.rounds}`);
    console.log(`   Run2 winner: ${result2.winnerId}  rounds: ${result2.rounds}`);
    process.exit(1);
  }

  const w1 = resolveWinner(result1.winnerId, r1a.id, r2a.id);
  console.log(`   Seed:           42`);
  console.log(`   Winner:         ${w1} (id=${result1.winnerId ?? "draw"})`);
  console.log(`   Rounds:         ${result1.rounds}`);
  console.log(`   P1 final HP%:   ${result1.robot1FinalHpPct.toFixed(1)}%`);
  console.log(`   P2 final HP%:   ${result1.robot2FinalHpPct.toFixed(1)}%`);
}

// ─── Main Simulation ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║   ROBOWAR V2 — Battle Simulation Runner (YPY-49 RE-RUN)  ║");
  console.log("║   Author: İREM (QA & Simulation Specialist)               ║");
  console.log("║   Battles per matchup: 1000 | Seeds: 0–999                ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  // Step 1: Determinism proof
  testDeterminism();

  // Step 2: Run simulation matrix
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  RUNNING SIMULATION MATRIX (36 matchups × 1000)");
  console.log("═══════════════════════════════════════════════════\n");

  const winMatrix: WinMatrix = {};
  let totalBattles = 0;

  // Initialize matrix
  for (const p1e of ELEMENTS) {
    winMatrix[p1e] = {};
    for (const p2e of ELEMENTS) {
      winMatrix[p1e][p2e] = { p1Wins: 0, p2Wins: 0, draws: 0, total: 0, longBattles: 0 };
    }
  }

  // Run all matchups
  for (const p1Element of ELEMENTS) {
    for (const p2Element of ELEMENTS) {
      const matchup = winMatrix[p1Element][p2Element];
      process.stdout.write(`  ${p1Element.padEnd(4)} vs ${p2Element.padEnd(4)}: `);

      for (let seed = 0; seed < BATTLE_COUNT; seed++) {
        const r1 = makeRobot(p1Element, "P1");
        const r2 = makeRobot(p2Element, "P2");
        const result = runBattle(r1, r2, SMART_ALGO, SMART_ALGO, seed);

        matchup.total++;
        totalBattles++;

        const winner = resolveWinner(result.winnerId, r1.id, r2.id);
        if (winner === "P1")   matchup.p1Wins++;
        else if (winner === "P2") matchup.p2Wins++;
        else                      matchup.draws++;

        if (result.rounds >= MAX_ROUNDS) {
          matchup.longBattles++;
        }
      }

      const p1WinRate  = matchup.p1Wins / matchup.total;
      const p2WinRate  = matchup.p2Wins / matchup.total;
      const drawRate   = matchup.draws   / matchup.total;
      const flag = p1WinRate > WIN_RATE_THRESHOLD || p2WinRate > WIN_RATE_THRESHOLD
        ? " ⚠️  IMBALANCED"
        : "";

      console.log(
        `P1 ${(p1WinRate * 100).toFixed(1).padStart(5)}%` +
        ` | P2 ${(p2WinRate * 100).toFixed(1).padStart(5)}%` +
        ` | Draw ${(drawRate * 100).toFixed(1).padStart(5)}%` +
        ` | MaxRd ${matchup.longBattles}${flag}`
      );
    }
  }

  // Step 3: Print win rate matrix (P1 perspective)
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  WIN RATE MATRIX (P1 win % vs each P2 element)");
  console.log("═══════════════════════════════════════════════════\n");

  const pad = 7;
  process.stdout.write("P1\\P2   ");
  for (const e of ELEMENTS) {
    process.stdout.write(e.padStart(pad));
  }
  console.log();
  console.log("─".repeat(8 + pad * ELEMENTS.length));

  for (const p1 of ELEMENTS) {
    process.stdout.write(p1.padEnd(8));
    for (const p2 of ELEMENTS) {
      const m = winMatrix[p1][p2];
      const rate = m.total > 0 ? ((m.p1Wins / m.total) * 100).toFixed(1) : "—";
      const flag = m.total > 0 && m.p1Wins / m.total > WIN_RATE_THRESHOLD ? "*" : " ";
      process.stdout.write(`${flag}${rate.padStart(pad - 1)}`);
    }
    console.log();
  }
  console.log("\n  * = exceeds 65% threshold (potential balance issue)");

  // Step 4: Balance analysis
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  BALANCE ANALYSIS");
  console.log("═══════════════════════════════════════════════════\n");

  let balanceOk = true;
  for (const p1 of ELEMENTS) {
    for (const p2 of ELEMENTS) {
      if (p1 === p2) continue;
      const m = winMatrix[p1][p2];
      const p1Rate = m.p1Wins / m.total;
      const p2Rate = m.p2Wins / m.total;
      if (p1Rate > WIN_RATE_THRESHOLD) {
        console.log(`  ⚠️  IMBALANCE: ${p1} beats ${p2} at ${(p1Rate * 100).toFixed(1)}%`);
        balanceOk = false;
      }
      if (p2Rate > WIN_RATE_THRESHOLD) {
        console.log(`  ⚠️  IMBALANCE: ${p2} (as P2) beats ${p1} (as P1) at ${(p2Rate * 100).toFixed(1)}%`);
        balanceOk = false;
      }
    }
  }

  if (balanceOk) {
    console.log("  ✅ All matchups within balance threshold (≤65% win rate)");
  } else {
    console.log("\n  ❌ Balance issues detected — review element matrix");
  }

  // Step 5: Overall P1 vs P2 position bias (excluding mirror matchups)
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  P1 vs P2 POSITION BIAS (excluding mirrors)");
  console.log("═══════════════════════════════════════════════════\n");

  let totalP1Wins = 0, totalP2Wins = 0, totalDraws = 0, totalNonMirror = 0;
  for (const p1 of ELEMENTS) {
    for (const p2 of ELEMENTS) {
      if (p1 === p2) continue;
      const m = winMatrix[p1][p2];
      totalP1Wins    += m.p1Wins;
      totalP2Wins    += m.p2Wins;
      totalDraws     += m.draws;
      totalNonMirror += m.total;
    }
  }
  const overallP1Rate = totalP1Wins / totalNonMirror;
  const overallP2Rate = totalP2Wins / totalNonMirror;
  const overallDrawRate = totalDraws / totalNonMirror;
  const biasOk = overallP1Rate >= 0.45 && overallP1Rate <= 0.55;

  console.log(`  P1 overall win rate:  ${(overallP1Rate * 100).toFixed(2)}%`);
  console.log(`  P2 overall win rate:  ${(overallP2Rate * 100).toFixed(2)}%`);
  console.log(`  Draw rate:            ${(overallDrawRate * 100).toFixed(2)}%`);
  console.log(`  Position bias check:  ${biasOk ? "✅ OK (45–55%)" : "⚠️  OUT OF RANGE"}`);

  // Step 6: Long battle report
  let totalLong = 0;
  for (const p1 of ELEMENTS) {
    for (const p2 of ELEMENTS) {
      totalLong += winMatrix[p1][p2].longBattles;
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  LONG BATTLE REPORT (battles reaching round ${MAX_ROUNDS})`);
  console.log("═══════════════════════════════════════════════════\n");
  if (totalLong === 0) {
    console.log("  ✅ No battles reached max rounds");
  } else {
    console.log(`  ⚠️  ${totalLong} battle(s) reached round ${MAX_ROUNDS} (decided by HP%)`);
    for (const p1 of ELEMENTS) {
      for (const p2 of ELEMENTS) {
        const n = winMatrix[p1][p2].longBattles;
        if (n > 0) {
          console.log(`     ${p1} vs ${p2}: ${n} long battle(s)`);
        }
      }
    }
  }

  // Step 7: Summary
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  SIMULATION SUMMARY");
  console.log("═══════════════════════════════════════════════════\n");
  console.log(`  Total battles:          ${totalBattles.toLocaleString()}`);
  console.log(`  Matchups tested:        ${ELEMENTS.length * ELEMENTS.length} (${ELEMENTS.length}×${ELEMENTS.length})`);
  console.log(`  Seeds used:             0–${BATTLE_COUNT - 1}`);
  console.log(`  Long battles (=50 rds): ${totalLong}`);
  console.log(`  Balance status:         ${balanceOk ? "✅ OK" : "⚠️  ISSUES FOUND"}`);
  console.log(`  P1/P2 bias:             ${biasOk ? "✅ OK" : "⚠️  ISSUES FOUND"}`);
  console.log(`  Determinism:            ✅ VERIFIED (seed 42)`);
  console.log();
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
