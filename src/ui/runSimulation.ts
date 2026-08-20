import type { SimConfig, SimResult } from '../core/types';

type WorkerReply = { ok: true; result: SimResult } | { ok: false; message: string };

/** Runs one ensemble off the main thread so a large field never freezes the page. */
export function runSimulation(config: SimConfig): Promise<SimResult> {
  return new Promise<SimResult>((resolve, reject) => {
    const worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.message));
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'The simulation worker failed.'));
    };

    worker.postMessage(config);
  });
}
