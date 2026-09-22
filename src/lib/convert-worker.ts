import { parentPort, workerData } from 'node:worker_threads';
import { convertPlanToExcalidraw } from 'plan-viz';
import { MAX_RESULT_BYTES } from './constants.js';

try {
  const scene = convertPlanToExcalidraw(workerData as string);
  // Bound the scene before cloning it back into the server process.
  if (Buffer.byteLength(JSON.stringify(scene)) > MAX_RESULT_BYTES) {
    parentPort?.postMessage({ ok: false, code: 'RESULT_TOO_LARGE' });
  } else {
    parentPort?.postMessage({ ok: true, scene });
  }
} catch {
  parentPort?.postMessage({ ok: false, code: 'INVALID_PLAN' });
}
