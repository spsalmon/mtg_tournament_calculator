import { describe, expect, it } from 'vitest';
import { lowestOccupied, playRound } from '../../src/core/round';
import { mulberry32 } from '../../src/core/rng';
import { sumCounts } from '../../src/core/invariants';
import { MTG_PROFILE } from '../../src/data/profiles';

const points = MTG_PROFILE.points;

function vector(size: number, entries: Record<number, number>): Int32Array {
  const counts = new Int32Array(size);
  for (const [key, value] of Object.entries(entries)) counts[Number(key)] = value;
  return counts;
}

function toObject(counts: Int32Array): Record<number, number> {
  const out: Record<number, number> = {};
  counts.forEach((n, p) => {
    if (n > 0) out[p] = n;
  });
  return out;
}

describe('lowestOccupied', () => {
  it('finds the lowest bracket holding anyone', () => {
    expect(lowestOccupied(vector(10, { 3: 2, 6: 1 }))).toBe(3);
    expect(lowestOccupied(vector(10, {}))).toBe(-1);
  });
});

describe('playRound', () => {
  const rng = () => mulberry32(1);

  it('splits a clean power-of-two field exactly in half', () => {
    const out = playRound(vector(16, { 0: 32 }), rng(), { pDraw: 0, points, hasBye: false });
    expect(toObject(out.counts)).toEqual({ 3: 16, 0: 16 });
    expect(out).toMatchObject({ decisive: 16, drawn: 0, byes: 0 });
  });

  it('splits every bracket independently on the second round', () => {
    const out = playRound(vector(16, { 3: 16, 0: 16 }), rng(), { pDraw: 0, points, hasBye: false });
    expect(toObject(out.counts)).toEqual({ 6: 8, 3: 16, 0: 8 });
    expect(out.decisive).toBe(16);
  });

  it('moves two players up one point for every drawn match', () => {
    const out = playRound(vector(16, { 0: 32 }), rng(), { pDraw: 1, points, hasBye: false });
    expect(toObject(out.counts)).toEqual({ 1: 32 });
    expect(out).toMatchObject({ decisive: 0, drawn: 16 });
  });

  it('gives the odd player out a bye from the lowest bracket', () => {
    const out = playRound(vector(16, { 0: 33 }), rng(), { pDraw: 0, points, hasBye: true });
    expect(toObject(out.counts)).toEqual({ 3: 17, 0: 16 });
    expect(out.byes).toBe(1);
    expect(sumCounts(out.counts)).toBe(33);
  });

  it('resolves a pair-down match across two point totals', () => {
    // Three players on 3 and one on 0: one 3-point player pairs down.
    const out = playRound(vector(16, { 3: 3, 0: 1 }), rng(), { pDraw: 0, points, hasBye: false });
    const result = toObject(out.counts);
    const carriedPlayerWon = { 6: 2, 3: 1, 0: 1 };
    const carriedPlayerLost = { 6: 1, 3: 3 };
    expect([carriedPlayerWon, carriedPlayerLost]).toContainEqual(result);
    expect(sumCounts(out.counts)).toBe(4);
    expect(out.decisive).toBe(2);
  });

  it('carries a lone player past empty brackets', () => {
    // One player on 6, nobody on 5..1, three on 0. The 6-point player pairs all
    // the way down into the 0 bracket, and both matches there are decisive.
    const out = playRound(vector(16, { 6: 1, 0: 3 }), rng(), { pDraw: 0, points, hasBye: false });
    expect(sumCounts(out.counts)).toBe(4);
    expect(out.decisive).toBe(2);
    expect(out.drawn).toBe(0);
  });

  it('conserves headcount for every field size and draw rate', () => {
    for (const players of [2, 3, 7, 16, 17, 64, 129]) {
      for (const pDraw of [0, 0.02, 0.5, 1]) {
        const out = playRound(vector(64, { 0: players }), rng(), {
          pDraw,
          points,
          hasBye: players % 2 === 1,
        });
        expect(sumCounts(out.counts)).toBe(players);
        expect(2 * (out.decisive + out.drawn) + out.byes).toBe(players);
      }
    }
  });

  it('does not mutate the input vector', () => {
    const input = vector(16, { 0: 8 });
    playRound(input, rng(), { pDraw: 0.5, points, hasBye: false });
    expect(toObject(input)).toEqual({ 0: 8 });
  });
});
