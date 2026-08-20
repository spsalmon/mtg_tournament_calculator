const PRESETS = [4, 8, 16, 32] as const;

interface CutFieldProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
}

export default function CutField({ value, onChange }: CutFieldProps) {
  const isPreset = PRESETS.some((preset) => preset === value);
  return (
    <div>
      <span className="block text-sm font-medium text-slate-200">Top cut size</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={value === preset}
            onClick={() => onChange(preset)}
            className={
              value === preset
                ? 'rounded-lg bg-sky-500 px-4 py-3 text-lg font-semibold text-slate-950'
                : 'rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-lg text-slate-100'
            }
          >
            Top {preset}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={!isPreset}
          onClick={() => onChange(value)}
          className={
            isPreset
              ? 'rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-lg text-slate-100'
              : 'rounded-lg bg-sky-500 px-4 py-3 text-lg font-semibold text-slate-950'
          }
        >
          Custom
        </button>
      </div>
      {!isPreset && (
        <input
          aria-label="Custom top cut size"
          type="number"
          inputMode="numeric"
          min={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-lg text-slate-50 focus:border-sky-400 focus:outline-none"
        />
      )}
    </div>
  );
}
