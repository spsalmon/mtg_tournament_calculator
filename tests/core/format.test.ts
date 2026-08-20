import { describe, expect, it } from 'vitest';
import { formatPoints, formatRecord, recordFor } from '../../src/core/format';
import { MTG_PROFILE } from '../../src/data/profiles';

const points = MTG_PROFILE.points;

describe('recordFor', () => {
  it('picks the record with the fewest draws', () => {
    expect(recordFor(13, 6, points)).toEqual({ wins: 4, losses: 1, draws: 1 });
    expect(recordFor(12, 6, points)).toEqual({ wins: 4, losses: 2, draws: 0 });
    expect(recordFor(15, 5, points)).toEqual({ wins: 5, losses: 0, draws: 0 });
    expect(recordFor(9, 5, points)).toEqual({ wins: 3, losses: 2, draws: 0 });
    expect(recordFor(16, 6, points)).toEqual({ wins: 5, losses: 0, draws: 1 });
    expect(recordFor(0, 3, points)).toEqual({ wins: 0, losses: 3, draws: 0 });
    expect(recordFor(1, 3, points)).toEqual({ wins: 0, losses: 2, draws: 1 });
  });

  it('returns null for totals no record can reach', () => {
    // 14 points in five rounds would need 4 wins + 2 draws — that is six matches.
    expect(recordFor(14, 5, points)).toBeNull();
    expect(recordFor(16, 5, points)).toBeNull();
  });
});

describe('formatRecord', () => {
  it('drops the draw component when there are no draws', () => {
    expect(formatRecord({ wins: 4, losses: 2, draws: 0 })).toBe('4-2');
    expect(formatRecord({ wins: 4, losses: 1, draws: 1 })).toBe('4-1-1');
  });
});

describe('formatPoints', () => {
  it('pairs the total with its record', () => {
    expect(formatPoints(13, 6, points)).toBe('13 pts (4-1-1)');
    expect(formatPoints(1, 3, points)).toBe('1 pt (0-2-1)');
  });

  it('prints the bare total when no record reaches it', () => {
    expect(formatPoints(14, 5, points)).toBe('14 pts');
  });
});
