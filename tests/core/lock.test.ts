import { describe, expect, it } from 'vitest';
import { isLockedByDraw, maxFinishingAbove } from '../../src/core/lock';
import { MTG_PROFILE } from '../../src/data/profiles';

const points = MTG_PROFILE.points;

function vector(size: number, entries: Record<number, number>): Int32Array {
  const counts = new Int32Array(size);
  for (const [key, value] of Object.entries(entries)) counts[Number(key)] = value;
  return counts;
}

describe('maxFinishingAbove', () => {
  it('counts everyone already clear of the threshold', () => {
    // Eight players on 15 all finish above 10 no matter what happens.
    expect(maxFinishingAbove(vector(32, { 15: 8 }), 10, points)).toBe(8);
  });

  it('counts a whole bracket when a draw is enough to clear the threshold', () => {
    // On 10 points, a draw reaches 11 > 10, and every seat can draw.
    expect(maxFinishingAbove(vector(32, { 10: 6 }), 10, points)).toBe(6);
  });

  it('counts at most half a bracket when only a win clears the threshold', () => {
    // On 9, only a win (12) clears 10. At most ceil(b/2) of a bracket can win.
    expect(maxFinishingAbove(vector(32, { 9: 7 }), 10, points)).toBe(4);
    expect(maxFinishingAbove(vector(32, { 9: 20 }), 10, points)).toBe(10);
  });

  it('ignores brackets that cannot reach the threshold at all', () => {
    expect(maxFinishingAbove(vector(32, { 6: 40 }), 10, points)).toBe(0);
  });

  it('adds the cases together', () => {
    const counts = vector(32, { 15: 2, 12: 10, 9: 20, 6: 20 });
    // threshold 13: 15s clear outright (2), 12s clear with a win only (ceil(10/2)=5),
    // 9s top out at 12 and never clear it (0).
    expect(maxFinishingAbove(counts, 13, points)).toBe(7);
  });
});

describe('isLockedByDraw', () => {
  const afterFiveRounds = vector(32, { 15: 2, 12: 10, 9: 20, 6: 20, 3: 10, 0: 2 });

  it('locks the undefeated bracket of a 64-player top 8', () => {
    expect(isLockedByDraw(afterFiveRounds, 15, 8, points)).toBe(true);
  });

  it('locks the one-loss bracket under the strictly-above rule', () => {
    // Ten players draw into a ten-way tie for six slots. The spec's rule counts
    // only players finishing STRICTLY above, so it calls this locked. See the
    // "Deviations" section: this is tie-blind by design in v1.
    expect(isLockedByDraw(afterFiveRounds, 12, 8, points)).toBe(true);
  });

  it('does not lock the two-loss bracket', () => {
    expect(isLockedByDraw(afterFiveRounds, 9, 8, points)).toBe(false);
  });

  it('locks nobody when the cut is a single slot', () => {
    expect(isLockedByDraw(afterFiveRounds, 15, 1, points)).toBe(false);
  });
});
