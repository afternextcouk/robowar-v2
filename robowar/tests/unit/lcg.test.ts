/**
 * ROBOWAR V2 — Unit Tests: LCG (Linear Congruential Generator)
 * Author: İREM (QA & Simulation Specialist)
 * Jira: YPY-42
 *
 * Run: cd /root/.openclaw/workspace/robowar/engine && npx jest ../tests/unit/lcg.test.ts
 */

import { LCG, generateBattleSeed } from "../../engine/src/core/lcg";

// ─── LCG Constants (from implementation) ─────────────────────────────────────
const A = 1664525;
const C = 1013904223;
const M = 4294967296; // 2^32

// ─── Test Suite: Same Seed = Same Sequence ────────────────────────────────────

describe("LCG — Determinism (same seed = same sequence)", () => {
  test("TC-LCG-001: Same seed produces identical first value", () => {
    const lcg1 = new LCG(0);
    const lcg2 = new LCG(0);
    expect(lcg1.next()).toBe(lcg2.next());
  });

  test("TC-LCG-002: Same seed produces identical sequence of 100 values", () => {
    const lcg1 = new LCG(42);
    const lcg2 = new LCG(42);

    const seq1 = Array.from({ length: 100 }, () => lcg1.next());
    const seq2 = Array.from({ length: 100 }, () => lcg2.next());

    expect(seq1).toEqual(seq2);
  });

  test("TC-LCG-003: Same seed produces identical random() float sequence", () => {
    const lcg1 = new LCG(12345);
    const lcg2 = new LCG(12345);

    const seq1 = Array.from({ length: 50 }, () => lcg1.random());
    const seq2 = Array.from({ length: 50 }, () => lcg2.random());

    expect(seq1).toEqual(seq2);
  });

  test("TC-LCG-004: Same seed produces identical int() sequence", () => {
    const lcg1 = new LCG(999);
    const lcg2 = new LCG(999);

    const seq1 = Array.from({ length: 50 }, () => lcg1.int(0, 100));
    const seq2 = Array.from({ length: 50 }, () => lcg2.int(0, 100));

    expect(seq1).toEqual(seq2);
  });

  test("TC-LCG-005: Same seed produces identical chance() sequence", () => {
    const lcg1 = new LCG(7777);
    const lcg2 = new LCG(7777);

    const seq1 = Array.from({ length: 100 }, () => lcg1.chance(0.5));
    const seq2 = Array.from({ length: 100 }, () => lcg2.chance(0.5));

    expect(seq1).toEqual(seq2);
  });

  test("TC-LCG-006: Same seed produces identical pick() sequence", () => {
    const arr = ["VOLT", "PYRO", "CRYO", "NANO", "VOID", "IRON"];
    const lcg1 = new LCG(1337);
    const lcg2 = new LCG(1337);

    const seq1 = Array.from({ length: 20 }, () => lcg1.pick(arr));
    const seq2 = Array.from({ length: 20 }, () => lcg2.pick(arr));

    expect(seq1).toEqual(seq2);
  });

  test("TC-LCG-007: Same seed produces identical shuffle() sequence", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const lcg1 = new LCG(2048);
    const lcg2 = new LCG(2048);

    const shuffled1 = lcg1.shuffle(arr);
    const shuffled2 = lcg2.shuffle(arr);

    expect(shuffled1).toEqual(shuffled2);
  });

  test("TC-LCG-008: Seed 42 produces exact expected first value", () => {
    const lcg = new LCG(42);
    // X(1) = (1664525 * 42 + 1013904223) >>> 0
    const expected = ((A * 42 + C) >>> 0) % M;
    expect(lcg.next()).toBe(expected);
  });

  test("TC-LCG-009: Seed 0 produces exact expected first value", () => {
    const lcg = new LCG(0);
    // X(1) = (1664525 * 0 + 1013904223) >>> 0 = 1013904223
    const expected = ((A * 0 + C) >>> 0) % M;
    expect(lcg.next()).toBe(expected);
    expect(lcg.next()).not.toBe(0); // Should not be 0
  });

  test("TC-LCG-010: State restoration preserves determinism", () => {
    const lcg1 = new LCG(100);
    // Advance 10 steps
    for (let i = 0; i < 10; i++) lcg1.next();
    const checkpoint = lcg1.getState();

    // Continue from checkpoint with new instance
    const lcg2 = new LCG(0);
    lcg2.setState(checkpoint);

    const seq1 = Array.from({ length: 20 }, () => lcg1.next());
    const seq2 = Array.from({ length: 20 }, () => lcg2.next());

    expect(seq1).toEqual(seq2);
  });
});

// ─── Test Suite: Different Seeds = Different Sequences ───────────────────────

describe("LCG — Different seeds produce different sequences", () => {
  test("TC-LCG-011: Seeds 0 and 1 produce different first values", () => {
    const lcg0 = new LCG(0);
    const lcg1 = new LCG(1);
    expect(lcg0.next()).not.toBe(lcg1.next());
  });

  test("TC-LCG-012: Seeds 42 and 43 produce different sequences", () => {
    const lcg42 = new LCG(42);
    const lcg43 = new LCG(43);

    const seq42 = Array.from({ length: 10 }, () => lcg42.next());
    const seq43 = Array.from({ length: 10 }, () => lcg43.next());

    expect(seq42).not.toEqual(seq43);
  });

  test("TC-LCG-013: Seeds 999 and 1000 produce different sequences", () => {
    const lcgA = new LCG(999);
    const lcgB = new LCG(1000);

    const seqA = Array.from({ length: 10 }, () => lcgA.next());
    const seqB = Array.from({ length: 10 }, () => lcgB.next());

    expect(seqA).not.toEqual(seqB);
  });

  test("TC-LCG-014: All 6 element seeds produce unique sequences", () => {
    const seeds = [100, 200, 300, 400, 500, 600];
    const sequences = seeds.map((seed) => {
      const lcg = new LCG(seed);
      return Array.from({ length: 10 }, () => lcg.next()).join(",");
    });

    const uniqueSequences = new Set(sequences);
    expect(uniqueSequences.size).toBe(seeds.length);
  });

  test("TC-LCG-015: Large seed values work correctly", () => {
    const lcg1 = new LCG(4294967295); // Max 32-bit unsigned
    const lcg2 = new LCG(4294967294);

    expect(lcg1.next()).not.toBe(lcg2.next());
  });
});

// ─── Test Suite: Value Distribution ──────────────────────────────────────────

describe("LCG — Value range & distribution", () => {
  test("TC-LCG-016: random() always returns value in [0, 1)", () => {
    const lcg = new LCG(42);
    for (let i = 0; i < 10000; i++) {
      const val = lcg.random();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  test("TC-LCG-017: int(min, max) always returns within range", () => {
    const lcg = new LCG(42);
    for (let i = 0; i < 1000; i++) {
      const val = lcg.int(5, 15);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(15);
    }
  });

  test("TC-LCG-018: int(n, n) always returns n", () => {
    const lcg = new LCG(42);
    for (let i = 0; i < 100; i++) {
      expect(lcg.int(7, 7)).toBe(7);
    }
  });

  test("TC-LCG-019: chance(0) always returns false", () => {
    const lcg = new LCG(42);
    for (let i = 0; i < 100; i++) {
      expect(lcg.chance(0)).toBe(false);
    }
  });

  test("TC-LCG-020: chance(1) always returns true", () => {
    const lcg = new LCG(42);
    for (let i = 0; i < 100; i++) {
      expect(lcg.chance(1)).toBe(true);
    }
  });

  test("TC-LCG-021: chance(0.5) produces ~50% true over 10000 samples", () => {
    const lcg = new LCG(42);
    let trueCount = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) {
      if (lcg.chance(0.5)) trueCount++;
    }
    const rate = trueCount / N;
    expect(rate).toBeGreaterThan(0.45);
    expect(rate).toBeLessThan(0.55);
  });

  test("TC-LCG-022: chance(0.05) produces ~5% true over 10000 samples", () => {
    const lcg = new LCG(42);
    let trueCount = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) {
      if (lcg.chance(0.05)) trueCount++;
    }
    const rate = trueCount / N;
    expect(rate).toBeGreaterThan(0.03);
    expect(rate).toBeLessThan(0.07);
  });

  test("TC-LCG-023: pick() returns items from the array only", () => {
    const arr = ["VOLT", "PYRO", "CRYO", "NANO", "VOID", "IRON"];
    const lcg = new LCG(42);
    for (let i = 0; i < 1000; i++) {
      const picked = lcg.pick(arr);
      expect(arr).toContain(picked);
    }
  });

  test("TC-LCG-024: shuffle() returns same elements in different order", () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const lcg = new LCG(42);
    const shuffled = lcg.shuffle(original);

    // Same elements
    expect(shuffled.sort()).toEqual([...original].sort());
    // Original unchanged
    expect(original).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test("TC-LCG-025: next() returns unsigned 32-bit integers only", () => {
    const lcg = new LCG(42);
    for (let i = 0; i < 1000; i++) {
      const val = lcg.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(M);
      expect(Number.isInteger(val)).toBe(true);
    }
  });
});

// ─── Test Suite: State Management ────────────────────────────────────────────

describe("LCG — State management", () => {
  test("TC-LCG-026: getState() returns current state", () => {
    const lcg = new LCG(42);
    lcg.next();
    const state = lcg.getState();
    expect(typeof state).toBe("number");
    expect(state).toBeGreaterThanOrEqual(0);
    expect(state).toBeLessThan(M);
  });

  test("TC-LCG-027: setState() restores to exact position", () => {
    const lcg = new LCG(42);
    for (let i = 0; i < 5; i++) lcg.next();

    const state = lcg.getState();
    const nextAfterState = lcg.next(); // peek

    // Restore
    lcg.setState(state);
    expect(lcg.next()).toBe(nextAfterState);
  });

  test("TC-LCG-028: Multiple getState() calls return same value without advancing", () => {
    const lcg = new LCG(42);
    lcg.next();
    const s1 = lcg.getState();
    const s2 = lcg.getState();
    expect(s1).toBe(s2);
  });

  test("TC-LCG-029: setState() with out-of-range value is handled via unsigned cast", () => {
    const lcg = new LCG(0);
    // Negative number gets cast to unsigned
    lcg.setState(-1);
    const state = lcg.getState();
    expect(state).toBeGreaterThanOrEqual(0);
  });
});

// ─── Test Suite: generateBattleSeed ──────────────────────────────────────────

describe("generateBattleSeed — Determinism & uniqueness", () => {
  test("TC-LCG-030: Same inputs produce same seed", () => {
    const seed1 = generateBattleSeed("player1", "player2", 1000000);
    const seed2 = generateBattleSeed("player1", "player2", 1000000);
    expect(seed1).toBe(seed2);
  });

  test("TC-LCG-031: Different timestamps produce different seeds", () => {
    const seed1 = generateBattleSeed("player1", "player2", 1000000);
    const seed2 = generateBattleSeed("player1", "player2", 1000001);
    expect(seed1).not.toBe(seed2);
  });

  test("TC-LCG-032: Different player IDs produce different seeds", () => {
    const seed1 = generateBattleSeed("alice", "bob", 1000000);
    const seed2 = generateBattleSeed("charlie", "bob", 1000000);
    expect(seed1).not.toBe(seed2);
  });

  test("TC-LCG-033: Generated seed is valid unsigned 32-bit integer", () => {
    const seed = generateBattleSeed("player1", "player2", Date.now());
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(M);
    expect(Number.isInteger(seed)).toBe(true);
  });
});
