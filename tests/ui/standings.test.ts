import { describe, expect, it } from 'vitest';
import { visibleRowCount } from '../../src/ui/Standings';
import type { StandingRow } from '../../src/core/types';

function rows(...chances: number[]): StandingRow[] {
  return chances.map((cutChance, i) => ({
    points: chances.length - i,
    averagePlayers: 1,
    cutChance,
  }));
}

describe('visibleRowCount', () => {
  it('stops at the first total that never made the cut, keeping it on screen', () => {
    expect(visibleRowCount(rows(1, 1, 0.51, 0.04, 0, 0, 0))).toBe(5);
  });

  it('shows everything when every total had a chance', () => {
    expect(visibleRowCount(rows(1, 0.5, 0.001))).toBe(3);
  });

  it('always leaves at least one row', () => {
    expect(visibleRowCount(rows(0, 0))).toBe(1);
    expect(visibleRowCount([])).toBe(0);
  });
});
