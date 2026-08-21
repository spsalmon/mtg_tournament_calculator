import { describe, expect, it } from 'vitest';
import { prefillFor } from '../../src/core/structure';
import { MTG_PROFILE } from '../../src/data/profiles';

describe('prefillFor', () => {
  it('reads rounds and cut straight off the MTR table', () => {
    expect(prefillFor(MTG_PROFILE, 64)).toEqual({ rounds: 6, cut: 8 });
    expect(prefillFor(MTG_PROFILE, 33)).toEqual({ rounds: 6, cut: 8 });
    expect(prefillFor(MTG_PROFILE, 32)).toEqual({ rounds: 5, cut: 8 });
    expect(prefillFor(MTG_PROFILE, 16)).toEqual({ rounds: 5, cut: 4 });
  });

  it('uses the open-ended top row above the table', () => {
    expect(prefillFor(MTG_PROFILE, 2000)).toEqual({ rounds: 10, cut: 8 });
  });

  it('falls back to a power-of-two bracket below the smallest row', () => {
    expect(prefillFor(MTG_PROFILE, 8)).toEqual({ rounds: 3, cut: 4 });
    expect(prefillFor(MTG_PROFILE, 3)).toEqual({ rounds: 2, cut: 2 });
    expect(prefillFor(MTG_PROFILE, 2)).toEqual({ rounds: 1, cut: 1 });
  });
});

describe('MTG_PROFILE', () => {
  it('carries MTG match point values', () => {
    expect(MTG_PROFILE.points).toEqual({ win: 3, draw: 1, loss: 0, bye: 3 });
  });

  it('has a contiguous, ascending structure table', () => {
    // Contiguity, not the starting point: the table may legitimately begin anywhere.
    let previousMax = (MTG_PROFILE.structure[0]?.min ?? 1) - 1;
    for (const row of MTG_PROFILE.structure) {
      expect(row.min).toBe(previousMax + 1);
      previousMax = row.max ?? Number.POSITIVE_INFINITY;
    }
    expect(previousMax).toBe(Number.POSITIVE_INFINITY);
  });
});
