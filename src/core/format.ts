import type { PointValues } from './types';

export interface TournamentRecord {
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

/**
 * The record with the fewest draws that reaches exactly `points` in `rounds` matches,
 * or null when no such record exists (14 points is unreachable in five rounds).
 *
 * Maximising wins minimises `wins + draws`, so the first solution found is also the
 * one most likely to fit inside the round count. Assumes a loss is worth zero.
 */
export function recordFor(points: number, rounds: number, values: PointValues): TournamentRecord | null {
  const { win, draw, loss } = values;
  if (win <= 0 || draw <= 0 || loss !== 0) return null;
  if (!Number.isInteger(points) || !Number.isInteger(rounds)) return null;
  if (points < 0 || rounds < 0) return null;

  for (let wins = Math.floor(points / win); wins >= 0; wins--) {
    const remainder = points - wins * win;
    if (remainder % draw !== 0) continue;
    const draws = remainder / draw;
    const losses = rounds - wins - draws;
    if (losses >= 0) return { wins, losses, draws };
  }
  return null;
}

export function formatRecord(record: TournamentRecord): string {
  return record.draws === 0
    ? `${record.wins}-${record.losses}`
    : `${record.wins}-${record.losses}-${record.draws}`;
}

/** "13 pts (4-1-1)", or a bare "14 pts" when no record in `rounds` matches reaches it. */
export function formatPoints(points: number, rounds: number, values: PointValues): string {
  const unit = points === 1 ? 'pt' : 'pts';
  const record = recordFor(points, rounds, values);
  return record === null ? `${points} ${unit}` : `${points} ${unit} (${formatRecord(record)})`;
}
