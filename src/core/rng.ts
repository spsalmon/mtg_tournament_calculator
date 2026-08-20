export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
}

export const DEFAULT_SEED = 0x5eed;

/** mulberry32 — small, fast, and good enough for coin flips. Fully deterministic. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/**
 * Number of successes in `n` independent trials of probability `p`.
 *
 * Summing Bernoulli trials is O(n), which is the honest cost here: the worst
 * realistic call is n = 1000 (a 2000-player first round). Inversion-based
 * samplers underflow (1-p)^n to zero at that size and silently return n, and
 * the whole point of this module is that it never silently lies.
 *
 * p === 0 must short-circuit without touching the stream — the draw-free
 * tournament is required to be byte-identical across runs.
 */
export function binomial(rng: Rng, n: number, p: number): number {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  let successes = 0;
  for (let i = 0; i < n; i++) {
    if (rng.next() < p) successes++;
  }
  return successes;
}
