import Standings from './Standings';
import { formatPercent, formatPoints } from '../core/format';
import type { SimConfig, SimResult } from '../core/types';

interface ResultsProps {
  readonly result: SimResult;
  readonly config: SimConfig;
}

export default function Results({ result, config }: ResultsProps) {
  const { rounds, points } = config;
  const runLabel = `${result.runs.toLocaleString()} runs`;
  const reachableMax = rounds * points.win;
  const noGuarantee = result.guaranteed > reachableMax;
  const noRobustGuarantee = result.robustGuaranteed > reachableMax;

  return (
    <section aria-live="polite" className="flex flex-col gap-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {result.runs.toLocaleString()} simulated tournaments
      </p>

      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-300">
          {noGuarantee
            ? `Guaranteed — no total cleared the cut in ${runLabel}`
            : `Guaranteed — never missed the cut in ${runLabel}`}
        </h2>
        {noGuarantee ? (
          <p className="mt-1 text-xl font-semibold text-sky-300">
            No total guaranteed the cut in these runs — even a maximum finish missed at least once.
          </p>
        ) : (
          <p className="mt-1 text-4xl font-bold text-sky-300">
            {formatPoints(result.guaranteed, rounds, points)}
          </p>
        )}
        {noGuarantee ? (
          <p className="mt-2 text-sm text-slate-400">
            At least one simulated player finished on the highest total this format can produce and
            still missed the cut, over {runLabel}. That is an observed extremum, not a proof — more
            runs can only reinforce it, not rescue a guarantee.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-400">
            No simulated player finished on this many points and missed. That is an observed
            extremum over {runLabel}, not a proof — more runs can only push this number up.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-300">
          Possible — made the cut in at least one of {runLabel}
        </h2>
        <p className="mt-1 text-4xl font-bold text-emerald-300">
          {formatPoints(result.possible, rounds, points)}
        </p>
        <p className="mt-2 text-sm text-slate-400">
          At or above the cut line in {formatPercent(result.possibleProbability)} of runs. At the
          line itself, tiebreakers decide — and this tool does not model them.
        </p>
      </div>

      <Standings standings={result.standings} config={config} />

      <div className="rounded-xl border border-slate-700 p-4">
        <h2 className="text-sm font-semibold text-slate-300">Plan around these instead</h2>
        <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-400">
              One step above the 99th-percentile total that missed
            </dt>
            <dd className="text-xl font-semibold">
              {noRobustGuarantee
                ? 'No total cleared 99% of runs'
                : formatPoints(result.robustGuaranteed, rounds, points)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">1st percentile of the worst total that made it</dt>
            <dd className="text-xl font-semibold">
              {formatPoints(result.robustPossible, rounds, points)}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-sm text-slate-400">
          The two headline numbers are extrema, so they drift with the run count. These two do not.
        </p>
      </div>
    </section>
  );
}
