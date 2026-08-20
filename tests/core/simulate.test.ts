import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/core/rng';
import {
  empiricalDistribution,
  massAtOrBelow,
  percentile,
  pointIncrement,
  pointsAtRank,
  runOnce,
  simulate,
  validateConfig,
} from '../../src/core/simulate';
import { MTG_PROFILE } from '../../src/data/profiles';
import type { SimConfig } from '../../src/core/types';

const points = MTG_PROFILE.points;

function config(overrides: Partial<SimConfig> = {}): SimConfig {
  return {
    players: 64,
    rounds: 6,
    cut: 8,
    pDraw: 0,
    intentionalDraws: false,
    runs: 100,
    seed: 1,
    points,
    ...overrides,
  };
}

function toObject(counts: Int32Array): Record<number, number> {
  const out: Record<number, number> = {};
  counts.forEach((n, p) => {
    if (n > 0) out[p] = n;
  });
  return out;
}

function totalPoints(counts: Int32Array): number {
  let total = 0;
  counts.forEach((n, p) => {
    total += n * p;
  });
  return total;
}

function headcount(counts: Int32Array): number {
  let total = 0;
  counts.forEach((n) => {
    total += n;
  });
  return total;
}

describe('validateConfig', () => {
  it('accepts a sane configuration', () => {
    expect(validateConfig(config())).toEqual([]);
  });

  it('rejects a cut that is not smaller than the field', () => {
    expect(validateConfig(config({ players: 8, cut: 8 }))).toHaveLength(1);
  });

  it('rejects out-of-range and non-integer inputs', () => {
    expect(validateConfig(config({ players: 1 }))).toHaveLength(1);
    expect(validateConfig(config({ rounds: 0 }))).toHaveLength(1);
    expect(validateConfig(config({ pDraw: 1.5 }))).toHaveLength(1);
    expect(validateConfig(config({ runs: 0 }))).toHaveLength(1);
    expect(validateConfig(config({ players: 12.5 }))).toHaveLength(1);
  });
});

describe('pointsAtRank', () => {
  it('reads the total held by the player at a given rank', () => {
    const counts = new Int32Array(16);
    counts[15] = 1;
    counts[12] = 5;
    counts[9] = 10;
    expect(pointsAtRank(counts, 1)).toBe(15);
    expect(pointsAtRank(counts, 6)).toBe(12);
    expect(pointsAtRank(counts, 7)).toBe(9);
    expect(pointsAtRank(counts, 16)).toBe(9);
  });
});

describe('pointIncrement', () => {
  it('is a full win when no draw can happen', () => {
    expect(pointIncrement(config({ pDraw: 0, intentionalDraws: false }))).toBe(3);
  });

  it('is one point as soon as any draw is possible', () => {
    expect(pointIncrement(config({ pDraw: 0.02 }))).toBe(1);
    expect(pointIncrement(config({ pDraw: 0, intentionalDraws: true }))).toBe(1);
  });
});

describe('percentile', () => {
  it('uses nearest-rank', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i);
    expect(percentile(sorted, 0.01)).toBe(0);
    expect(percentile(sorted, 0.5)).toBe(49);
    expect(percentile(sorted, 0.99)).toBe(98);
    expect(percentile(sorted, 1)).toBe(99);
  });
});

describe('empiricalDistribution', () => {
  it('is keyed by integer point totals and sums to one', () => {
    const distribution = empiricalDistribution([9, 9, 12, 15]);
    expect(distribution.get(9)).toBeCloseTo(0.5, 12);
    let mass = 0;
    for (const p of distribution.values()) mass += p;
    expect(Math.abs(mass - 1)).toBeLessThanOrEqual(1e-12);
  });

  it('accumulates mass at or below a threshold', () => {
    const distribution = empiricalDistribution([9, 9, 12, 15]);
    expect(massAtOrBelow(distribution, 12)).toBeCloseTo(0.75, 12);
  });
});

describe('golden case: 32 players, 5 rounds, top 8, no draws', () => {
  const golden = config({ players: 32, rounds: 5, cut: 8, runs: 200 });

  it('produces the known final standings', () => {
    const run = runOnce(golden, mulberry32(golden.seed));
    expect(toObject(run.counts)).toEqual({ 0: 1, 3: 5, 6: 10, 9: 10, 12: 5, 15: 1 });
  });

  it('puts X-1 in the cut and X-2 on the bubble', () => {
    const result = simulate(golden);
    expect(result.possible).toBe(9);
    expect(result.guaranteed).toBe(12);
  });
});

describe('determinism', () => {
  it('has exactly zero variance when no draw can happen and N = 2^R', () => {
    const deterministic = config({ players: 32, rounds: 5, cut: 8, runs: 200 });
    const rng = mulberry32(deterministic.seed);
    const first = Array.from(runOnce(deterministic, rng).counts);
    for (let i = 1; i < deterministic.runs; i++) {
      expect(Array.from(runOnce(deterministic, rng).counts)).toEqual(first);
    }
  });

  it('reproduces an entire ensemble from the same seed', () => {
    const noisy = config({ players: 129, pDraw: 0.07, intentionalDraws: true, runs: 300, seed: 42 });
    expect(simulate(noisy)).toEqual(simulate({ ...noisy, seed: 42 }));
  });

  it('produces a different ensemble from a different seed', () => {
    const noisy = config({ players: 129, pDraw: 0.07, runs: 300 });
    expect(simulate({ ...noisy, seed: 1 })).not.toEqual(simulate({ ...noisy, seed: 2 }));
  });
});

describe('conservation', () => {
  const cases: SimConfig[] = [
    config({ players: 64, rounds: 6, pDraw: 0 }),
    config({ players: 33, rounds: 6, pDraw: 0.05 }),
    config({ players: 129, rounds: 8, cut: 8, pDraw: 0.2, intentionalDraws: true }),
    config({ players: 7, rounds: 3, cut: 4, pDraw: 0.5 }),
  ];

  it('keeps every player in the field and every point accounted for', () => {
    for (const testCase of cases) {
      const rng = mulberry32(testCase.seed);
      for (let i = 0; i < 20; i++) {
        const run = runOnce(testCase, rng);
        expect(headcount(run.counts)).toBe(testCase.players);
        expect(totalPoints(run.counts)).toBe(
          points.win * run.decisive + 2 * points.draw * run.drawn + points.bye * run.byes,
        );
        // Every player takes exactly one result per round: a match seat or a bye.
        expect(2 * (run.decisive + run.drawn) + run.byes).toBe(testCase.players * testCase.rounds);
      }
    }
  });
});

describe('odd fields', () => {
  it('awards exactly one bye per round', () => {
    const odd = config({ players: 33, rounds: 6, pDraw: 0.05 });
    const rng = mulberry32(odd.seed);
    for (let i = 0; i < 20; i++) {
      expect(runOnce(odd, rng).byes).toBe(odd.rounds);
    }
  });

  it('awards no byes at all for an even field', () => {
    const even = config({ players: 34, rounds: 6, pDraw: 0.05 });
    expect(runOnce(even, mulberry32(1)).byes).toBe(0);
  });
});

describe('monotonicity', () => {
  const base = config({ players: 64, rounds: 6, cut: 8, pDraw: 0.05, seed: 11 });

  it('never reports a guaranteed line below the possible line', () => {
    for (const runs of [10, 100, 1000]) {
      const result = simulate({ ...base, runs });
      expect(result.guaranteed).toBeGreaterThanOrEqual(result.possible);
    }
  });

  it('moves the extrema in only one direction as runs increase', () => {
    let previous = simulate({ ...base, runs: 10 });
    for (const runs of [100, 1000, 5000]) {
      const current = simulate({ ...base, runs });
      expect(current.guaranteed).toBeGreaterThanOrEqual(previous.guaranteed);
      expect(current.possible).toBeLessThanOrEqual(previous.possible);
      previous = current;
    }
  });
});

describe('draws raise the bar', () => {
  it('never lowers the highest total seen missing the cut', () => {
    const base = config({ players: 64, rounds: 6, cut: 8, runs: 2000, seed: 5 });
    const sweep = [0, 0.02, 0.05, 0.1];
    let previous = Number.NEGATIVE_INFINITY;
    for (const pDraw of sweep) {
      const result = simulate({ ...base, pDraw });
      expect(result.maxBestOut).toBeGreaterThanOrEqual(previous);
      previous = result.maxBestOut;
    }
  });

  it('never lowers the guaranteed line among draw-enabled configurations', () => {
    const base = config({ players: 64, rounds: 6, cut: 8, runs: 2000, seed: 5 });
    let previous = Number.NEGATIVE_INFINITY;
    for (const pDraw of [0.02, 0.05, 0.1]) {
      const result = simulate({ ...base, pDraw });
      expect(result.guaranteed).toBeGreaterThanOrEqual(previous);
      previous = result.guaranteed;
    }
  });
});

describe('intentional draws', () => {
  const base = config({ players: 64, rounds: 6, cut: 8, pDraw: 0, runs: 50, seed: 3 });

  it('reproduces the 64-player final round exactly, with and without IDs', () => {
    const without = runOnce({ ...base, intentionalDraws: false }, mulberry32(base.seed));
    expect(toObject(without.counts)).toEqual({ 0: 1, 3: 6, 6: 15, 9: 20, 12: 15, 15: 6, 18: 1 });

    const withIds = runOnce({ ...base, intentionalDraws: true }, mulberry32(base.seed));
    expect(toObject(withIds.counts)).toEqual({ 0: 1, 3: 6, 6: 15, 9: 20, 12: 10, 13: 10, 16: 2 });
  });

  it('puts at least as many players on the lock threshold as playing it out would', () => {
    const withIds = runOnce({ ...base, intentionalDraws: true }, mulberry32(base.seed));
    const without = runOnce({ ...base, intentionalDraws: false }, mulberry32(base.seed));
    const threshold = withIds.worstIn;
    expect(withIds.counts[threshold] ?? 0).toBeGreaterThanOrEqual(without.counts[threshold] ?? 0);
  });

  it('shifts both lines the way IDs actually shift them', () => {
    const without = simulate({ ...base, intentionalDraws: false });
    const withIds = simulate({ ...base, intentionalDraws: true });
    expect(without.possible).toBe(12);
    expect(without.guaranteed).toBe(15);
    expect(withIds.possible).toBe(13);
    // 13 + 1: the increment drops from a full win to a single point once draws
    // are possible, which is why `guaranteed` can fall while `possible` rises.
    expect(withIds.guaranteed).toBe(14);
  });
});
