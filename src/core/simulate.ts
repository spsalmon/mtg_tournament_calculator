import { check, checkHeadcount, checkMass } from './invariants';
import { isLockedByDraw } from './lock';
import { playRound } from './round';
import { mulberry32, type Rng } from './rng';
import type { RunResult, SimConfig, SimResult, StandingRow } from './types';

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

/**
 * How many players on each point total landed inside the top `cut`, for one run.
 *
 * Seats fill from the top down, so the bracket straddling the cut line gets only
 * the slots left over — twelve players on 12 points with five seats remaining seat
 * five of them. Which five is a tiebreaker question, and v1 does not model those.
 */
export function cutSlotsByPoints(counts: Int32Array, cut: number): Int32Array {
  const slots = new Int32Array(counts.length);
  let remaining = cut;
  for (let p = counts.length - 1; p >= 0 && remaining > 0; p--) {
    const seated = Math.min(counts[p] ?? 0, remaining);
    slots[p] = seated;
    remaining -= seated;
  }
  return slots;
}

/** Length of a count vector: one slot per total from zero up to the best finish possible. */
export function countVectorSize(config: SimConfig): number {
  const { win, draw, bye } = config.points;
  return config.rounds * Math.max(win, draw, bye) + 1;
}

/** Play one whole tournament and measure the cut line. */
export function runOnce(config: SimConfig, rng: Rng): RunResult {
  let counts: Int32Array = new Int32Array(countVectorSize(config));
  counts[0] = config.players;

  const hasBye = config.players % 2 === 1;
  let decisive = 0;
  let drawn = 0;
  let byes = 0;

  for (let round = 1; round <= config.rounds; round++) {
    const before = counts;
    // Checked every round, not just the last: a player who can draw out the rest
    // of the event starts drawing the moment that becomes true.
    const remaining = config.rounds - round + 1;
    const idCheck = config.intentionalDraws
      ? (p: number) => isLockedByDraw(before, p, config.cut, config.points, remaining, hasBye)
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
  // Indexed by integer point total — never by a float, per the numerical hygiene rule.
  const size = countVectorSize(config);
  const finished = new Float64Array(size);
  const seated = new Float64Array(size);
  const seats = Math.min(config.cut, config.players);

  for (let i = 0; i < config.runs; i++) {
    const run = runOnce(config, rng);
    worstIns[i] = run.worstIn;
    bestOuts[i] = run.bestOut;
    if (run.worstIn < possible) possible = run.worstIn;
    if (run.bestOut > maxBestOut) maxBestOut = run.bestOut;

    const slots = cutSlotsByPoints(run.counts, config.cut);
    let handedOut = 0;
    for (let p = 0; p < size; p++) {
      const slot = slots[p] ?? 0;
      finished[p] = (finished[p] ?? 0) + (run.counts[p] ?? 0);
      seated[p] = (seated[p] ?? 0) + slot;
      handedOut += slot;
    }
    check(handedOut === seats, `run ${i} seated ${handedOut} players, expected ${seats}`);
  }

  const increment = pointIncrement(config);
  const sortedWorst = [...worstIns].sort((a, b) => a - b);
  const sortedBest = [...bestOuts].sort((a, b) => a - b);
  const worstInDistribution = empiricalDistribution(worstIns);

  const standings: StandingRow[] = [];
  for (let p = size - 1; p >= 0; p--) {
    const players = finished[p] ?? 0;
    if (players === 0) continue;
    standings.push({
      points: p,
      averagePlayers: players / config.runs,
      cutChance: (seated[p] ?? 0) / players,
    });
  }

  return {
    runs: config.runs,
    increment,
    possible,
    possibleProbability: massAtOrBelow(worstInDistribution, possible),
    guaranteed: maxBestOut + increment,
    robustPossible: percentile(sortedWorst, 0.01),
    robustGuaranteed: percentile(sortedBest, 0.99) + increment,
    maxBestOut,
    standings,
  };
}
