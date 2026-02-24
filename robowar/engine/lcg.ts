/**
 * lcg.ts — Linear Congruential Generator for deterministic randomness
 * ROBOWAR V2 — FATİH (Game Engine Specialist)
 *
 * Parameters from Numerical Recipes (Park-Miller style):
 *   a = 1664525, c = 1013904223, m = 2^32
 * SAME SEED = SAME RESULT always. No Math.random() used anywhere.
 *
 * YPY-46 FIX: LCG is now a CLASS with instance-level state instead of a
 * module-level singleton. Each runBattle() call creates its own `new LCG(seed)`
 * instance — concurrent battles no longer corrupt each other's randomness.
 */

const A = 1664525;
const C = 1013904223;
const M = 0x100000000; // 2^32

export class LCG {
  private _state: number;

  constructor(seed: number) {
    // Normalize to unsigned 32-bit integer
    this._state = seed >>> 0;
  }

  /**
   * Advance the LCG and return the next deterministic float in [0, 1).
   */
  next(): number {
    this._state = ((A * this._state + C) >>> 0); // keep lower 32 bits, unsigned
    return this._state / M;
  }

  /**
   * Return next deterministic integer in [min, max] (inclusive).
   */
  nextInt(min: number, max: number): number {
    if (min > max) throw new RangeError(`nextInt: min (${min}) > max (${max})`);
    const range = max - min + 1;
    return min + Math.floor(this.next() * range);
  }

  /**
   * Return a deterministic boolean with given probability (0-1).
   */
  nextBool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Return a deterministic float in [min, max].
   */
  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Alias for nextBool — used by BattleEngine compat layer.
   */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /**
   * Pick a random element from a non-empty array.
   */
  pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }

  /**
   * Snapshot current state (for save/restore in replays).
   */
  getState(): number {
    return this._state;
  }

  /**
   * Restore previously snapshotted state.
   */
  setState(value: number): void {
    this._state = value >>> 0;
  }
}
