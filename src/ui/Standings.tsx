import { useState } from 'react';
import { formatPercent, formatPlayers, formatPoints } from '../core/format';
import type { SimConfig, StandingRow } from '../core/types';

interface StandingsProps {
  readonly standings: readonly StandingRow[];
  readonly config: SimConfig;
}

/**
 * How many rows are worth showing at a table: everything down to and including the
 * first total that never made the cut. The rest are all zeroes and live behind the
 * toggle — the first miss is the informative one.
 */
export function visibleRowCount(standings: readonly StandingRow[]): number {
  const firstMiss = standings.findIndex((row) => row.cutChance === 0);
  if (firstMiss === -1) return standings.length;
  return Math.max(1, firstMiss + 1);
}

export default function Standings({ standings, config }: StandingsProps) {
  const [showAll, setShowAll] = useState(false);
  const live = visibleRowCount(standings);
  const rows = showAll ? standings : standings.slice(0, live);
  const hidden = standings.length - live;

  return (
    <div className="rounded-xl border border-slate-700 p-4">
      <h2 className="text-sm font-semibold text-slate-300">Every finish, and what it was worth</h2>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-medium text-slate-400">
            <th scope="col" className="pb-1">Final total</th>
            <th scope="col" className="pb-1">Made the cut</th>
            <th scope="col" className="pb-1 text-right">Players</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.points} className="border-t border-slate-800">
              <td className="whitespace-nowrap py-2 pr-3">
                {formatPoints(row.points, config.rounds, config.points)}
              </td>
              <td className="py-2 pr-3">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2 w-full min-w-8 max-w-24 rounded-full bg-slate-800"
                  >
                    <span
                      className="block h-2 rounded-full bg-emerald-400"
                      style={{ width: `${row.cutChance * 100}%` }}
                    />
                  </span>
                  <span className="tabular-nums">{formatPercent(row.cutChance)}</span>
                </div>
              </td>
              <td className="py-2 text-right tabular-nums text-slate-400">
                {formatPlayers(row.averagePlayers)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300"
        >
          {showAll ? 'Show fewer totals' : `Show ${hidden} more ${hidden === 1 ? 'total' : 'totals'}`}
        </button>
      )}

      <p className="mt-3 text-sm text-slate-400">
        Of every simulated player who finished on a total, the share that made the cut, with the
        average size of that bracket. A total straddling the cut line only gets the seats that are
        left — which of those players take them is decided by tiebreakers this tool does not model.
      </p>
    </div>
  );
}
