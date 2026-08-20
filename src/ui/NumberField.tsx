interface NumberFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly suffix?: string;
  readonly hint?: string;
}

export default function NumberField(props: NumberFieldProps) {
  const { id, label, value, onChange, min, max, step, suffix, hint } = props;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-200">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-lg text-slate-50 focus:border-sky-400 focus:outline-none"
        />
        {suffix !== undefined && <span className="shrink-0 text-slate-400">{suffix}</span>}
      </div>
      {hint !== undefined && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
