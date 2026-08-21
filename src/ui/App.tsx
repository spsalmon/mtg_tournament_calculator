import { useState } from 'react';
import type { FormEvent } from 'react';
import CutField from './CutField';
import NumberField from './NumberField';
import Notes from './Notes';
import Results from './Results';
import { runSimulation } from './runSimulation';
import { DEFAULT_SEED } from '../core/rng';
import { validateConfig } from '../core/simulate';
import { prefillFor } from '../core/structure';
import { MTG_PROFILE } from '../data/profiles';
import type { SimConfig, SimResult } from '../core/types';

const RUN_CHOICES = [1_000, 10_000, 50_000] as const;

export default function App() {
  const [players, setPlayers] = useState('64');
  const [rounds, setRounds] = useState('6');
  const [roundsTouched, setRoundsTouched] = useState(false);
  const [cut, setCut] = useState(8);
  const [cutTouched, setCutTouched] = useState(false);
  const [drawPercent, setDrawPercent] = useState('2');
  const [intentionalDraws, setIntentionalDraws] = useState(false);
  const [runs, setRuns] = useState<number>(10_000);

  const [result, setResult] = useState<SimResult | null>(null);
  const [lastConfig, setLastConfig] = useState<SimConfig | null>(null);
  const [problems, setProblems] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);

  function handlePlayersChange(next: string): void {
    setPlayers(next);
    const count = Number(next);
    if (!Number.isInteger(count) || count < 2) return;
    const prefill = prefillFor(MTG_PROFILE, count);
    if (!roundsTouched) setRounds(String(prefill.rounds));
    if (!cutTouched) setCut(prefill.cut);
  }

  function buildConfig(): SimConfig {
    return {
      players: Number(players),
      rounds: Number(rounds),
      cut,
      pDraw: Number(drawPercent) / 100,
      intentionalDraws,
      runs,
      seed: DEFAULT_SEED,
      points: MTG_PROFILE.points,
    };
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const config = buildConfig();
    const found = validateConfig(config);
    setProblems(found);
    if (found.length > 0) return;

    setBusy(true);
    try {
      const simulated = await runSimulation(config);
      setResult(simulated);
      setLastConfig(config);
    } catch (error) {
      setProblems([(error as Error).message]);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 bg-slate-950 px-4 py-8 text-slate-100">
      <header>
        <h1 className="text-2xl font-bold">can I draw?</h1>
        <p className="mt-1 text-sm text-slate-400">
          What does it take to make the cut? Simulates the Swiss rounds and reports the point
          totals that made it.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <NumberField
          id="players"
          label="Number of players"
          value={players}
          onChange={handlePlayersChange}
          min={2}
        />
        <NumberField
          id="rounds"
          label="Number of rounds"
          value={rounds}
          onChange={(next) => {
            setRoundsTouched(true);
            setRounds(next);
          }}
          min={1}
          hint="Prefilled from the field size. Override it if your event differs."
        />
        <CutField
          value={cut}
          onChange={(next) => {
            setCutTouched(true);
            setCut(next);
          }}
        />
        <NumberField
          id="draw-rate"
          label="Unintentional draw rate"
          value={drawPercent}
          onChange={setDrawPercent}
          min={0}
          max={100}
          step={0.5}
          suffix="%"
          hint="Chance that any given match is drawn because time was called."
        />

        <label className="flex items-start gap-3 rounded-lg border border-slate-700 p-3">
          <input
            type="checkbox"
            checked={intentionalDraws}
            onChange={(event) => setIntentionalDraws(event.target.checked)}
            className="mt-1 h-5 w-5"
          />
          <span>
            <span className="font-medium">Include intentional draws</span>
            <span className="mt-1 block text-xs text-slate-400">
              Simulated players draw out every remaining round the moment a draw locks them into
              the cut — a 3-0 with two rounds left draws both.
            </span>
          </span>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-slate-200">Simulation runs</span>
          <select
            value={runs}
            onChange={(event) => setRuns(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-lg text-slate-50"
          >
            {RUN_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {choice.toLocaleString()} runs
              </option>
            ))}
          </select>
        </label>

        {problems.length > 0 && (
          <ul
            role="alert"
            className="rounded-lg border border-red-500/60 bg-red-500/10 p-3 text-sm text-red-200"
          >
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-sky-500 px-4 py-4 text-lg font-semibold text-slate-950 disabled:opacity-60"
        >
          {busy ? 'Simulating…' : 'What does it take?'}
        </button>
      </form>

      {result !== null && lastConfig !== null && <Results result={result} config={lastConfig} />}

      <Notes intentionalDraws={intentionalDraws} />
    </main>
  );
}
