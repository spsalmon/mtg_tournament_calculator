import { setInvariantChecks } from '../core/invariants';
import { simulate } from '../core/simulate';
import type { SimConfig } from '../core/types';

// A worker is its own module graph, so the checks main.tsx turns on do not reach
// here — and this is the thread the distributions are actually built on.
setInvariantChecks(import.meta.env.DEV);

// Typed structurally rather than via `/// <reference lib="webworker" />`, which
// collides with the DOM lib this project already loads.
declare const self: {
  onmessage: ((event: MessageEvent<SimConfig>) => void) | null;
  postMessage: (message: unknown) => void;
};

self.onmessage = (event: MessageEvent<SimConfig>) => {
  try {
    self.postMessage({ ok: true as const, result: simulate(event.data) });
  } catch (error) {
    self.postMessage({ ok: false as const, message: (error as Error).message });
  }
};
