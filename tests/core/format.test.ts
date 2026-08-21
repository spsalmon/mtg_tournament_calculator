import { describe, expect, it } from 'vitest';
import {
  formatPercent,
  formatPlayers,
  formatPoints,
  formatRecord,
  recordFor,
} from '../../src/core/format';
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

describe('formatPercent', () => {
  it('prints whole numbers from ten percent up', () => {
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0.42)).toBe('42%');
    expect(formatPercent(0.1)).toBe('10%');
  });

  it('keeps one decimal below ten percent', () => {
    expect(formatPercent(0.043)).toBe('4.3%');
    expect(formatPercent(0.0025)).toBe('0.3%');
  });

  it('never rounds a real chance down to nothing', () => {
    expect(formatPercent(0.0002)).toBe('<0.1%');
  });

  it('prints an impossible outcome as a flat zero', () => {
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('formatPlayers', () => {
  it('keeps one decimal on an average bracket size', () => {
    expect(formatPlayers(13.34)).toBe('13.3');
    expect(formatPlayers(1)).toBe('1.0');
  });

  it('never rounds a bracket somebody reached down to nothing', () => {
    expect(formatPlayers(0.02)).toBe('<0.1');
  });

  it('prints an empty bracket as a flat zero', () => {
    expect(formatPlayers(0)).toBe('0');
  });
});
