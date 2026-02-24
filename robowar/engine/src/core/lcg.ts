/**
 * ROBOWAR V2 — Deterministic Linear Congruential Generator (LCG)
 *
 * Parameters (Numerical Recipes):
 *   X(n+1) = (a * X(n) + c) mod m
 *   a = 1664525
 *   c = 1013904223
 *   m = 2^32
 *
 * The same seed always produces the same battle. Replays are 100% deterministic.
 */

const A = 1664525;
const C = 1013904223;
const M = 4294967296; // 2^32

export class LCG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0; // ensure unsigned 32-bit
  }

  /** Advance the generator and return a raw unsigned 32-bit integer. */
  next(): number {
    this.state = ((A * this.state + C) >>> 0) % M;
    return this.state;
  }

  /** Return a float in [0, 1). */
  random(): number {
    return this.next() / M;
  }

  /** Return an integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /** Return true with the given probability (0–1). */
  chance(probability: number): boolean {
    return this.random() < probability;
  }

  /** Pick a random item from an array. */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Shuffle an array (Fisher-Yates, in-place). */
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Get current state for checkpointing. */
  getState(): number {
    return this.state;
  }

  /** Restore state from checkpoint. */
  setState(state: number): void {
    this.state = state >>> 0;
  }
}

/** Generate a battle seed from player IDs + timestamp (deterministic). */
export function generateBattleSeed(player1Id: string, player2Id: string, timestamp: number): number {
  let hash = timestamp;
  const combined = player1Id + player2Id;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) >>> 0;
  }
  return hash;
}
