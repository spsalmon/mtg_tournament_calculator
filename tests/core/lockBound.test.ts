import { describe, expect, it } from 'vitest';
import { maxFinishingAbove } from '../../src/core/lock';
import { lowestOccupied } from '../../src/core/round';
import { MTG_PROFILE } from '../../src/data/profiles';

const points = MTG_PROFILE.points;
const key = (counts: readonly number[]) => counts.join(',');

/**
 * Every count vector reachable by playing one whole round, with an adversary
 * choosing every result: which matches are drawn, and who wins the rest.
 * Mirrors playRound's bracket walk, branching where playRound rolls dice.
 */
function nextStates(counts: readonly number[], hasBye: boolean): number[][] {
  const out = new Map<string, number[]>();
  const start = counts.slice();
  const seed: number[] = new Array<number>(counts.length).fill(0);

  if (hasBye) {
    const low = lowestOccupied(Int32Array.from(start));
    if (low >= 0) {
      start[low] = (start[low] ?? 0) - 1;
      seed[low + points.bye] = (seed[low + points.bye] ?? 0) + 1;
    }
  }

  const walk = (p: number, acc: number[], carry: number | null): void => {
    if (p < 0) {
      if (carry === null) out.set(key(acc), acc.slice());
      return;
    }
    const here = start[p] ?? 0;
    // an empty bracket passes any pending pair-down straight through
    if (here === 0) {
      walk(p - 1, acc, carry);
      return;
    }

    const playBracket = (remaining: number, base: number[]): void => {
      let carryOut: number | null = null;
      if (remaining % 2 === 1) {
        carryOut = p;
        remaining -= 1;
      }
      const matches = remaining / 2;
      for (let drawn = 0; drawn <= matches; drawn++) {
        const a = base.slice();
        a[p + points.draw] = (a[p + points.draw] ?? 0) + 2 * drawn;
        a[p + points.win] = (a[p + points.win] ?? 0) + (matches - drawn);
        a[p] = (a[p] ?? 0) + (matches - drawn);
        walk(p - 1, a, carryOut);
      }
    };

    if (carry === null) {
      playBracket(here, acc);
      return;
    }
    const pairDown: ReadonlyArray<readonly [number, number]> = [
      [carry + points.draw, p + points.draw],
      [carry + points.win, p],
      [carry, p + points.win],
    ];
    for (const [a, b] of pairDown) {
      const next = acc.slice();
      next[a] = (next[a] ?? 0) + 1;
      next[b] = (next[b] ?? 0) + 1;
      playBracket(here - 1, next);
    }
  };

  walk(counts.length - 1, seed, null);
  return [...out.values()];
}

function reachableAfter(counts: readonly number[], rounds: number, hasBye: boolean): number[][] {
  let frontier: number[][] = [counts.slice()];
  for (let i = 0; i < rounds; i++) {
    const seen = new Map<string, number[]>();
    for (const state of frontier) {
      for (const next of nextStates(state, hasBye)) seen.set(key(next), next);
    }
    frontier = [...seen.values()];
  }
  return frontier;
}

function compositions(n: number, slots: number): number[][] {
  if (slots === 1) return [[n]];
  const out: number[][] = [];
  for (let i = 0; i <= n; i++) {
    for (const rest of compositions(n - i, slots - 1)) out.push([i, ...rest]);
  }
  return out;
}

/**
 * The whole intentional-draw rule rests on maxFinishingAbove never under-counting:
 * an under-count sends a player into a draw that does not actually lock them in.
 * Exhaustive small fields are the only honest way to check that, so this plays
 * every legal continuation of every bracket shape and compares.
 *
 * A flat ceil(b/2) per bracket — the shape this started as — fails this test on
 * 317 of the cases below, all of them pair-downs and byes.
 */
describe('maxFinishingAbove is never beaten by a real continuation', () => {
  it.each([1, 2])('holds over every %i-round continuation of every small field', (rounds) => {
    const size = 3 * (rounds + 2) + 1;
    let checked = 0;
    const failures: string[] = [];

    for (let n = 2; n <= 7; n++) {
      for (const shape of compositions(n, 5)) {
        const start: number[] = new Array<number>(size).fill(0);
        // brackets 0,1,3,4,6 — a mix of win-spaced and draw-spaced totals
        [0, 1, 3, 4, 6].forEach((q, i) => {
          start[q] = shape[i] ?? 0;
        });
        const hasBye = n % 2 === 1;
        const finals = reachableAfter(start, rounds, hasBye);

        for (let threshold = 0; threshold < size - 1; threshold++) {
          let actual = 0;
          for (const final of finals) {
            let above = 0;
            for (let q = threshold + 1; q < size; q++) above += final[q] ?? 0;
            if (above > actual) actual = above;
          }
          const bound = maxFinishingAbove(Int32Array.from(start), threshold, points, rounds, hasBye);
          checked++;
          if (bound < actual) {
            failures.push(`${key(start)} @${threshold}: bound ${bound} < actual ${actual}`);
          }
        }
      }
    }

    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThan(1000);
  });
});
