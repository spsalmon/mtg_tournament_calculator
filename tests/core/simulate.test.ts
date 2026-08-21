import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/core/rng';
import {
  cutSlotsByPoints,
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
    // A one-player field trips two independent problems at once: the players-count
    // check (players < 2) and the cut-vs-field check (the default cut of 8 is >= 1).
    // No cut value can isolate the first, since any legal cut (>= 1) is also >= a
    // field of 1 — so this case genuinely yields two problems, not one.
    expect(validateConfig(config({ players: 1 }))).toHaveLength(2);
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

describe('guaranteed can exceed the reachable maximum', () => {
  it('reports a guaranteed line above rounds*win when even a max finish missed the cut', () => {
    const tiny = config({ players: 256, rounds: 4, cut: 8, pDraw: 0.02, runs: 500, seed: 7 });
    const result = simulate(tiny);
    const reachableMax = tiny.rounds * tiny.points.win;
    expect(result.guaranteed).toBeGreaterThan(reachableMax);
    expect(result.guaranteed).toBe(result.maxBestOut + result.increment);
  });

  it('leaves the ordinary golden configuration unaffected', () => {
    const golden = config({ players: 32, rounds: 5, cut: 8, pDraw: 0, runs: 200 });
    const result = simulate(golden);
    expect(result.possible).toBe(9);
    expect(result.guaranteed).toBe(12);
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

  it('draws out from 3-0 with two rounds still to play', () => {
    // 16 players, 5 rounds, top 8. Two players are 3-0 after round 3, and the
    // field behind them can no longer put eight players above 11, so they draw
    // rounds 4 AND 5. Eleven points is three wins and two draws: at pDraw = 0
    // it is unreachable unless a player intentionally drew more than once.
    const small = config({ players: 16, rounds: 5, cut: 8, seed: 5, intentionalDraws: true });
    const withIds = runOnce(small, mulberry32(5));
    const without = runOnce({ ...small, intentionalDraws: false }, mulberry32(5));
    expect(withIds.counts[11]).toBe(2);
    expect(without.counts[11] ?? 0).toBe(0);
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

describe('cutSlotsByPoints', () => {
  function vector(entries: Record<number, number>): Int32Array {
    const size = Math.max(...Object.keys(entries).map(Number)) + 1;
    const counts = new Int32Array(size);
    for (const [p, n] of Object.entries(entries)) counts[Number(p)] = n;
    return counts;
  }

  it('fills the cut from the top down, splitting the bracket that straddles the line', () => {
    const slots = cutSlotsByPoints(vector({ 15: 1, 12: 5, 9: 10 }), 8);
    expect(toObject(slots)).toEqual({ 15: 1, 12: 5, 9: 2 });
  });

  it('hands out exactly `cut` slots', () => {
    const slots = cutSlotsByPoints(vector({ 15: 1, 12: 5, 9: 10, 6: 10, 3: 5, 0: 1 }), 8);
    expect(headcount(slots)).toBe(8);
  });

  it('never seats more players on a total than finished on it', () => {
    const counts = vector({ 12: 3, 9: 4, 6: 20 });
    const slots = cutSlotsByPoints(counts, 8);
    slots.forEach((seated, p) => {
      expect(seated).toBeLessThanOrEqual(counts[p] ?? 0);
    });
  });

  it('seats the whole field when the cut is larger than it', () => {
    const counts = vector({ 12: 3, 9: 4 });
    expect(headcount(cutSlotsByPoints(counts, 32))).toBe(7);
  });
});

describe('simulate standings', () => {
  it('reports the cut chance of every total reached in the golden case', () => {
    const result = simulate(config({ players: 32, rounds: 5, cut: 8, runs: 50 }));
    // Final counts are always {15:1, 12:5, 9:10, 6:10, 3:5, 0:1}: the top six
    // seats are settled, and the last two go to two of the ten players on 9.
    expect(result.standings.map((row) => row.points)).toEqual([15, 12, 9, 6, 3, 0]);
    expect(result.standings.map((row) => row.averagePlayers)).toEqual([1, 5, 10, 10, 5, 1]);
    const chances = result.standings.map((row) => row.cutChance);
    expect(chances[0]).toBeCloseTo(1, 12);
    expect(chances[1]).toBeCloseTo(1, 12);
    expect(chances[2]).toBeCloseTo(0.2, 12);
    expect(chances.slice(3)).toEqual([0, 0, 0]);
  });

  it('never rates a lower total above a higher one', () => {
    const result = simulate(config({ pDraw: 0.05, intentionalDraws: true, runs: 200 }));
    for (let i = 1; i < result.standings.length; i++) {
      expect(result.standings[i]!.cutChance).toBeLessThanOrEqual(result.standings[i - 1]!.cutChance);
    }
  });

  it('accounts for the whole field', () => {
    const result = simulate(config({ players: 57, pDraw: 0.05, runs: 200 }));
    const seated = result.standings.reduce((sum, row) => sum + row.averagePlayers, 0);
    expect(seated).toBeCloseTo(57, 9);
    for (const row of result.standings) {
      expect(row.averagePlayers).toBeGreaterThan(0);
      expect(row.cutChance).toBeGreaterThanOrEqual(0);
      expect(row.cutChance).toBeLessThanOrEqual(1);
    }
  });

  it('seats exactly the cut, run for run', () => {
    const result = simulate(config({ players: 57, pDraw: 0.05, runs: 200 }));
    const seated = result.standings.reduce(
      (sum, row) => sum + row.averagePlayers * row.cutChance,
      0,
    );
    expect(seated).toBeCloseTo(8, 9);
  });
});
