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

describe('maxFinishingAbove with several rounds left', () => {
  it('halves a bracket once, not once per round', () => {
    // Two rounds out, a 15-point finish needs a gain of 3 from 12: the second
    // round is unconstrained, so the 12s only have to not lose the next one.
    const counts = vector(32, { 12: 4, 9: 16, 6: 24 });
    expect(maxFinishingAbove(counts, 14, points, 2)).toBe(4 + 8);
    // The 6s top out at 12 over two rounds and never reach 15.
    expect(maxFinishingAbove(counts, 14, points, 1)).toBe(2);
  });

  it('widens the net as the rounds left go up', () => {
    const counts = vector(32, { 9: 2, 6: 6, 3: 6, 0: 2 });
    expect(maxFinishingAbove(counts, 11, points, 1)).toBe(1);
    expect(maxFinishingAbove(counts, 11, points, 2)).toBe(5);
    // Three rounds out the 9s and 6s can all draw past 11, half the 3s can win
    // out to 12, and the 0s top out at 9 no matter what.
    expect(maxFinishingAbove(counts, 11, points, 3)).toBe(2 + 6 + 3);
  });

  it('counts the pair-down and the bye, which both beat a flat half-bracket', () => {
    // One player on 6 pairs down into a bracket of two on 3, one of whom byes
    // out to 6 first. Both of the 3s can still clear 5: one wins the pair-down,
    // the other took the bye. A flat ceil(b/2) counts one of them and under-reports
    // the field, which is how a bound meant to be conservative invents a lock.
    const counts = vector(16, { 6: 1, 3: 2 });
    expect(maxFinishingAbove(counts, 5, points, 1, true)).toBe(3);
  });

  it('lets a pair-down add a winner to the bracket it falls into', () => {
    // The odd bracket of three on 12 sends one player down into the four on 9,
    // so five players are paired there and three of them can win, not two.
    const counts = vector(20, { 12: 3, 9: 4, 6: 9 });
    expect(maxFinishingAbove(counts, 11, points, 1)).toBe(3 + 3);
  });
});

describe('isLockedByDraw with several rounds left', () => {
  // 16 players, 5 rounds, top 8: the classic "I am 3-0, can I draw out?".
  const afterThree = vector(20, { 9: 2, 6: 6, 3: 6, 0: 2 });
  const afterTwo = vector(20, { 6: 4, 3: 8, 0: 4 });

  it('lets a 3-0 draw the last two rounds into a top 8', () => {
    expect(isLockedByDraw(afterThree, 9, 8, points, 2)).toBe(true);
  });

  it('does not let the same 3-0 draw out into a top 4', () => {
    // Five players can still finish above 11, which is more than fills a top 4.
    expect(isLockedByDraw(afterThree, 9, 4, points, 2)).toBe(false);
  });

  it('does not lock a 2-0 three rounds out', () => {
    // Everyone from 3 points up can draw their way past 9, so the field behind
    // is nowhere near exhausted yet.
    expect(isLockedByDraw(afterTwo, 6, 8, points, 3)).toBe(false);
  });
});
