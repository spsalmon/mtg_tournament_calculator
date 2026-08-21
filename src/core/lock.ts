import { lowestOccupied } from './round';
import type { PointValues } from './types';

/**
 * Upper bound on how many players can finish strictly above `threshold` points,
 * given the count vector at the start of a round with `roundsRemaining` rounds
 * left to play (including the one about to be paired).
 *
 * A player on `q` needs to gain `g = threshold + 1 - q` to clear the threshold.
 * The next round is the only one whose pairings the count vector pins down: the
 * field is bracketed, so only so many players can win. After that the field
 * scatters and anyone may face anyone, so the remaining `roundsRemaining - 1`
 * rounds are left unconstrained at `win` points each. That reduces every bracket
 * to what it must gain in the NEXT round alone:
 *
 *   need = g - (roundsRemaining - 1) * win
 *
 *   need <= draw -> all of them. Drawing the next round is enough (need <= 0
 *                   included: they are already clear, and points never decrease).
 *   need <= win  -> only the winners, bounded below.
 *   otherwise    -> nobody, except a bye holder if a bye outruns a win.
 *
 * Leaving the later rounds unconstrained makes this a deliberate over-count —
 * real Swiss re-brackets the winners and halves them again. Over-counting is the
 * safe direction: it can only withhold an intentional draw, never invent one.
 *
 * The winner bound has to survive two things that beat a naive `ceil(b/2)`:
 * pair-downs and byes. Both are deterministic in the count vector, so this walks
 * the brackets top-down exactly as `playRound` does. A bracket of `b` holding an
 * incoming pair-down `c` fields `ceil((b + c) / 2)` possible winners — its own
 * matches, plus the seat facing the player paired down into it, plus the seat it
 * pairs down itself — and passes `(b + c) % 2` onward. The bye comes off the
 * lowest occupied bracket before any of that and is a win nobody had to play
 * for, so its holder is counted separately.
 */
export function maxFinishingAbove(
  counts: Int32Array,
  threshold: number,
  values: PointValues,
  roundsRemaining = 1,
  hasBye = false,
): number {
  const { win, draw, bye } = values;
  const laterRounds = (roundsRemaining - 1) * win;
  const byeBracket = hasBye ? lowestOccupied(counts) : -1;

  let total = 0;
  let carry = 0;
  for (let q = counts.length - 1; q >= 0; q--) {
    const bracket = counts[q] ?? 0;
    if (bracket === 0 && carry === 0) continue;

    const byeHere = q === byeBracket && bracket > 0;
    const paired = byeHere ? bracket - 1 : bracket;
    const pool = paired + carry;
    carry = pool % 2;
    if (bracket === 0) continue;

    const need = threshold + 1 - q - laterRounds;
    let reachable: number;
    if (need <= draw) {
      reachable = bracket;
    } else {
      reachable = need <= win ? Math.ceil(pool / 2) : 0;
      if (byeHere && need <= bye) reachable += 1;
      reachable = Math.min(reachable, bracket);
    }
    total += reachable;
  }
  return total;
}

/**
 * Would a player on `points` be mathematically locked into a top `cut` by
 * drawing every one of their `roundsRemaining` remaining matches?
 *
 * This is the whole intentional-draw rule: a player either is or is not safe to
 * draw out, with no thresholds and no tuning. A 3-0 with two rounds left starts
 * drawing the moment the field behind them can no longer fill the cut.
 *
 * Only players finishing STRICTLY above the drawn-out total are counted —
 * players who finish level are separated by tiebreakers, which v1 does not
 * model. That makes the rule optimistic about IDs inside a large bubble bracket.
 */
export function isLockedByDraw(
  counts: Int32Array,
  points: number,
  cut: number,
  values: PointValues,
  roundsRemaining = 1,
  hasBye = false,
): boolean {
  const drawnOut = points + roundsRemaining * values.draw;
  return maxFinishingAbove(counts, drawnOut, values, roundsRemaining, hasBye) < cut;
}
