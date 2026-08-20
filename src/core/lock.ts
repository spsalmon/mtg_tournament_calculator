import type { PointValues } from './types';

/**
 * Upper bound on how many players can finish strictly above `threshold` points,
 * given the count vector at the start of the final round.
 *
 * Four cases per bracket, and getting them wrong in either direction breaks the
 * ID rule — undercount and players ID into a cut they will miss, overcount and
 * nobody ever draws:
 *   q > threshold          -> all b. Points never decrease; a loss cannot drop them.
 *   q + draw > threshold   -> all b. A draw is enough, and every seat can draw.
 *   q + win  > threshold   -> ceil(b/2). Only winners clear it, and a bracket of
 *                             size b has at most floor(b/2) winners plus the
 *                             pair-down player, i.e. ceil(b/2).
 *   otherwise              -> 0.
 */
export function maxFinishingAbove(counts: Int32Array, threshold: number, values: PointValues): number {
  const { win, draw } = values;
  let total = 0;
  for (let q = 0; q < counts.length; q++) {
    const bracket = counts[q] ?? 0;
    if (bracket === 0) continue;
    if (q > threshold || q + draw > threshold) total += bracket;
    else if (q + win > threshold) total += Math.ceil(bracket / 2);
  }
  return total;
}

/**
 * Would a player on `points` be mathematically locked into a top `cut` by taking
 * a draw in the final round?
 *
 * v1 counts only players finishing STRICTLY above the drawn total — players who
 * finish level are separated by tiebreakers, which v1 does not model. This makes
 * the rule optimistic about IDs inside a large bubble bracket.
 */
export function isLockedByDraw(
  counts: Int32Array,
  points: number,
  cut: number,
  values: PointValues,
): boolean {
  return maxFinishingAbove(counts, points + values.draw, values) < cut;
}
