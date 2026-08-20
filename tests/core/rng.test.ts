import { describe, expect, it } from 'vitest';
import { binomial, mulberry32 } from '../../src/core/rng';

function draw(rng: { next(): number }, n: number): number[] {
  return Array.from({ length: n }, () => rng.next());
}

describe('mulberry32', () => {
  it('is uniform in [0, 1)', () => {
    const values = draw(mulberry32(12345), 5000);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.47);
    expect(mean).toBeLessThan(0.53);
  });

  it('reproduces a stream exactly from the same seed', () => {
    expect(draw(mulberry32(7), 100)).toEqual(draw(mulberry32(7), 100));
  });

  it('produces different streams from different seeds', () => {
    expect(draw(mulberry32(7), 20)).not.toEqual(draw(mulberry32(8), 20));
  });

  it('matches the canonical mulberry32 reference stream', () => {
    // A wrong constant, shift, or divisor would produce plausible-looking but
    // different output that the distribution tests cannot detect. This exact
    // sequence pins the implementation to the canonical mulberry32 algorithm.
    expect(draw(mulberry32(1), 5)).toEqual([
      0.6270739405881613,
      0.002735721180215478,
      0.5274470399599522,
      0.9810509674716741,
      0.9683778982143849,
    ]);
  });
});

describe('binomial', () => {
  it('consumes no randomness when p is zero', () => {
    const rng = mulberry32(99);
    expect(binomial(rng, 500, 0)).toBe(0);
    // The stream must be untouched: the draw-free tournament has to be
    // byte-identical run to run, which only holds if p === 0 short-circuits.
    expect(rng.next()).toBe(mulberry32(99).next());
  });

  it('returns n when p is one', () => {
    expect(binomial(mulberry32(1), 17, 1)).toBe(17);
  });

  it('returns zero for an empty trial count', () => {
    expect(binomial(mulberry32(1), 0, 0.5)).toBe(0);
  });

  it('stays within bounds and lands near n*p', () => {
    const rng = mulberry32(4242);
    let total = 0;
    const trials = 400;
    for (let i = 0; i < trials; i++) {
      const k = binomial(rng, 100, 0.25);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(100);
      total += k;
    }
    expect(total / trials).toBeGreaterThan(23);
    expect(total / trials).toBeLessThan(27);
  });
});
