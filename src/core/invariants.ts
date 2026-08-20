/**
 * Opt-in assertions. Off by default so the published bundle pays nothing;
 * `main.tsx` turns them on in dev builds and the test setup turns them on always.
 * Lives here rather than behind `import.meta.env` so that core stays bundler-agnostic.
 */
let enabled = false;

export function setInvariantChecks(on: boolean): void {
  enabled = on;
}

export function invariantChecksEnabled(): boolean {
  return enabled;
}

export function check(condition: boolean, message: string): void {
  if (enabled && !condition) throw new Error(`invariant violated: ${message}`);
}

/** A float-key bug once leaked probability mass on this project. This is the check that catches it. */
export const MASS_TOLERANCE = 1e-12;

export function checkMass(mass: number, label: string): void {
  check(
    Math.abs(mass - 1) <= MASS_TOLERANCE,
    `${label}: distribution mass ${mass} differs from 1 by more than ${MASS_TOLERANCE}`,
  );
}

export function sumCounts(counts: Int32Array): number {
  let total = 0;
  for (let i = 0; i < counts.length; i++) total += counts[i] ?? 0;
  return total;
}

export function checkHeadcount(counts: Int32Array, expected: number, label: string): void {
  if (!enabled) return;
  const total = sumCounts(counts);
  check(total === expected, `${label}: count vector holds ${total} players, expected ${expected}`);
}
