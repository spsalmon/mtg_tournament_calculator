import { check, checkHeadcount, checkMass } from './invariants';
import { isLockedByDraw } from './lock';
import { playRound } from './round';
import { mulberry32, type Rng } from './rng';
import type { RunResult, SimConfig, SimResult } from './types';

export function validateConfig(config: SimConfig): string[] {
  const problems: string[] = [];
  if (!Number.isInteger(config.players) || config.players < 2) {
    problems.push('Players must be a whole number of at least 2.');
  }
  if (!Number.isInteger(config.rounds) || config.rounds < 1) {
    problems.push('Rounds must be a whole number of at least 1.');
  }
  if (!Number.isInteger(config.cut) || config.cut < 1) {
    problems.push('Top cut must be a whole number of at least 1.');
  } else if (config.cut >= config.players) {
    problems.push('Top cut must be smaller than the field — otherwise everybody makes it.');
  }
  if (!(config.pDraw >= 0 && config.pDraw <= 1)) {
    problems.push('Draw rate must be between 0% and 100%.');
  }
  if (!Number.isInteger(config.runs) || config.runs < 1) {
    problems.push('Run count must be a whole number of at least 1.');
  }
  return problems;
}

/** Points held by the player standing at `rank`, counting down from the top. */
export function pointsAtRank(counts: Int32Array, rank: number): number {
  let seen = 0;
  for (let p = counts.length - 1; p >= 0; p--) {
    seen += counts[p] ?? 0;
    if (seen >= rank) return p;
  }
  return 0;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

/**
 * Smallest step between two reachable point totals. When no draw can happen every
 * total is a multiple of a win; once draws are possible the reachable totals are
 * spaced by gcd(win, draw). Derived, never hard-coded.
 */
export function pointIncrement(config: SimConfig): number {
  const drawsPossible = config.pDraw > 0 || config.intentionalDraws;
  return drawsPossible ? gcd(config.points.win, config.points.draw) : config.points.win;
}

/** Nearest-rank percentile of an ascending array. */
export function percentile(sortedAscending: readonly number[], q: number): number {
  if (sortedAscending.length === 0) return Number.NaN;
  const rank = Math.ceil(q * sortedAscending.length) - 1;
  const index = Math.min(sortedAscending.length - 1, Math.max(0, rank));
  return sortedAscending[index] ?? Number.NaN;
}

/**
 * Empirical distribution over integer point totals. Keys are integers by
 * construction and the mass is asserted to sum to 1 — a float key silently
 * leaking mass is the exact bug this project has hit before.
 */
export function empiricalDistribution(values: readonly number[]): Map<number, number> {
  const tally = new Map<number, number>();
  for (const value of values) {
    check(Number.isInteger(value), `distribution key ${value} is not an integer`);
    tally.set(value, (tally.get(value) ?? 0) + 1);
  }
  const distribution = new Map<number, number>();
  let mass = 0;
  for (const [key, count] of tally) {
    const probability = count / values.length;
    distribution.set(key, probability);
    mass += probability;
  }
  if (values.length > 0) checkMass(mass, 'empirical distribution');
  return distribution;
}

export function massAtOrBelow(distribution: ReadonlyMap<number, number>, threshold: number): number {
  let mass = 0;
  for (const [key, probability] of distribution) {
    if (key <= threshold) mass += probability;
  }
  return mass;
}

/** Play one whole tournament and measure the cut line. */
export function runOnce(config: SimConfig, rng: Rng): RunResult {
  const { win, draw, bye } = config.points;
  const size = config.rounds * Math.max(win, draw, bye) + 1;
  let counts: Int32Array = new Int32Array(size);
  counts[0] = config.players;

  const hasBye = config.players % 2 === 1;
  let decisive = 0;
  let drawn = 0;
  let byes = 0;

  for (let round = 1; round <= config.rounds; round++) {
    const before = counts;
    // v1 only checks locks one round out, where "locked" is exactly decidable.
    const idCheck =
      config.intentionalDraws && round === config.rounds
        ? (p: number) => isLockedByDraw(before, p, config.cut, config.points)
        : undefined;

    const outcome = playRound(before, rng, {
      pDraw: config.pDraw,
      points: config.points,
      hasBye,
      idCheck,
    });

    counts = outcome.counts;
    decisive += outcome.decisive;
    drawn += outcome.drawn;
    byes += outcome.byes;
    checkHeadcount(counts, config.players, `after round ${round}`);
  }

  return {
    counts,
    worstIn: pointsAtRank(counts, config.cut),
    bestOut: pointsAtRank(counts, config.cut + 1),
    decisive,
    drawn,
    byes,
  };
}

/**
 * Run the ensemble and reduce it to the two headline numbers.
 *
 * These are extrema, not proofs: `guaranteed` means "never observed to fail in
 * `runs` runs", and both numbers drift monotonically with the run count. The
 * percentile companions are what a player should actually plan around.
 */
export function simulate(config: SimConfig): SimResult {
  const problems = validateConfig(config);
  if (problems.length > 0) throw new Error(`invalid configuration: ${problems.join(' ')}`);

  const rng = mulberry32(config.seed);
  const worstIns: number[] = new Array<number>(config.runs);
  const bestOuts: number[] = new Array<number>(config.runs);
  let possible = Number.POSITIVE_INFINITY;
  let maxBestOut = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < config.runs; i++) {
    const run = runOnce(config, rng);
    worstIns[i] = run.worstIn;
    bestOuts[i] = run.bestOut;
    if (run.worstIn < possible) possible = run.worstIn;
    if (run.bestOut > maxBestOut) maxBestOut = run.bestOut;
  }

  const increment = pointIncrement(config);
  const ceiling = config.rounds * config.points.win;
  const sortedWorst = [...worstIns].sort((a, b) => a - b);
  const sortedBest = [...bestOuts].sort((a, b) => a - b);
  const worstInDistribution = empiricalDistribution(worstIns);

  return {
    runs: config.runs,
    increment,
    possible,
    possibleProbability: massAtOrBelow(worstInDistribution, possible),
    guaranteed: Math.min(maxBestOut + increment, ceiling),
    robustPossible: percentile(sortedWorst, 0.01),
    robustGuaranteed: Math.min(percentile(sortedBest, 0.99) + increment, ceiling),
    maxBestOut,
  };
}
