import { check } from './invariants';
import { binomial, type Rng } from './rng';
import type { PointValues } from './types';

export interface RoundOptions {
  /** Per-match probability that the match is drawn because time was called. */
  readonly pDraw: number;
  readonly points: PointValues;
  /** True when the field is odd and one player must receive a bye this round. */
  readonly hasBye: boolean;
  /**
   * When supplied, a pairing becomes an intentional draw if every seat in it
   * passes this check. Called with each seat's current point total.
   */
  readonly idCheck?: ((points: number) => boolean) | undefined;
}

export interface RoundOutcome {
  readonly counts: Int32Array;
  readonly decisive: number;
  readonly drawn: number;
  readonly byes: number;
}

/** Index of the lowest bracket holding at least one player, or -1 if the field is empty. */
export function lowestOccupied(counts: Int32Array): number {
  for (let p = 0; p < counts.length; p++) {
    if ((counts[p] ?? 0) > 0) return p;
  }
  return -1;
}

/**
 * Play one round of Swiss on a count vector and return a fresh vector.
 * `counts` is never mutated.
 */
export function playRound(counts: Int32Array, rng: Rng, opts: RoundOptions): RoundOutcome {
  const { win, draw, bye } = opts.points;
  const next = new Int32Array(counts.length);
  const pool = Int32Array.from(counts);

  let decisive = 0;
  let drawn = 0;
  let byes = 0;

  // The bye comes off the bottom of the standings first, leaving an even field
  // to pair, which is what guarantees the carry chain closes at the end.
  if (opts.hasBye) {
    const lowest = lowestOccupied(pool);
    if (lowest >= 0) {
      pool[lowest] = (pool[lowest] ?? 0) - 1;
      check(lowest + bye < next.length, `bye from ${lowest} overflows the count vector`);
      next[lowest + bye] = (next[lowest + bye] ?? 0) + 1;
      byes = 1;
    }
  }

  let carryPending = false;
  let carryPoints = 0;

  for (let p = pool.length - 1; p >= 0; p--) {
    let here = pool[p] ?? 0;
    if (here === 0 && !carryPending) continue;

    if (carryPending && here > 0) {
      here -= 1;
      const bothLocked =
        opts.idCheck !== undefined && opts.idCheck(carryPoints) && opts.idCheck(p);
      if (bothLocked || (opts.pDraw > 0 && rng.next() < opts.pDraw)) {
        check(carryPoints + draw < next.length, `draw from ${carryPoints} overflows the count vector`);
        check(p + draw < next.length, `draw from ${p} overflows the count vector`);
        next[carryPoints + draw] = (next[carryPoints + draw] ?? 0) + 1;
        next[p + draw] = (next[p + draw] ?? 0) + 1;
        drawn += 1;
      } else if (rng.next() < 0.5) {
        check(carryPoints + win < next.length, `win from ${carryPoints} overflows the count vector`);
        next[carryPoints + win] = (next[carryPoints + win] ?? 0) + 1;
        next[p] = (next[p] ?? 0) + 1;
        decisive += 1;
      } else {
        next[carryPoints] = (next[carryPoints] ?? 0) + 1;
        check(p + win < next.length, `win from ${p} overflows the count vector`);
        next[p + win] = (next[p + win] ?? 0) + 1;
        decisive += 1;
      }
      carryPending = false;
    }

    if (here === 0) continue;

    if (here % 2 === 1) {
      carryPending = true;
      carryPoints = p;
      here -= 1;
    }

    const matches = here / 2;
    if (matches === 0) continue;

    // A whole bracket sits on identical points, so it either IDs or it does not.
    const bracketIds = opts.idCheck !== undefined && opts.idCheck(p);
    const draws = bracketIds ? matches : binomial(rng, matches, opts.pDraw);
    const decided = matches - draws;

    check(p + win < next.length, `win from ${p} overflows the count vector`);
    next[p + win] = (next[p + win] ?? 0) + decided;
    next[p] = (next[p] ?? 0) + decided;
    check(p + draw < next.length, `draw from ${p} overflows the count vector`);
    next[p + draw] = (next[p + draw] ?? 0) + 2 * draws;

    decisive += decided;
    drawn += draws;
  }

  check(!carryPending, 'a player was left unpaired at the end of the round');

  return { counts: next, decisive, drawn, byes };
}
