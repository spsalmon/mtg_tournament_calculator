import { describe, expect, it } from 'vitest';
import { simulate } from '../../src/core/simulate';
import { MTG_PROFILE } from '../../src/data/profiles';

describe('simulation cost', () => {
  it('stays inside a sane budget for the largest field in the input space', () => {
    const started = performance.now();
    simulate({
      players: 2000,
      rounds: 10,
      cut: 8,
      pDraw: 0.02,
      intentionalDraws: true,
      runs: 1000,
      seed: 1,
      points: MTG_PROFILE.points,
    });
    const elapsedPerThousandRuns = performance.now() - started;
    // Informational: this is why the UI runs the ensemble in a worker.
    console.log(`2000 players x 10 rounds x 1000 runs: ${elapsedPerThousandRuns.toFixed(0)} ms`);
    expect(elapsedPerThousandRuns).toBeLessThan(20_000);
  }, 60_000);

  it('is instant for the field the site is actually designed for', () => {
    const started = performance.now();
    simulate({
      players: 64,
      rounds: 6,
      cut: 8,
      pDraw: 0.02,
      intentionalDraws: true,
      runs: 10_000,
      seed: 1,
      points: MTG_PROFILE.points,
    });
    expect(performance.now() - started).toBeLessThan(5_000);
  }, 30_000);
});
