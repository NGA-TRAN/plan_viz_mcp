import { Worker } from 'node:worker_threads';
import { BoundedGate } from './gate.js';
import { cancellationError, VisualizeError } from './errors.js';
import { CONVERT_TIMEOUT_MS, MAX_QUEUED_CONVERSIONS } from './constants.js';
import { tooLarge, type Scene } from './visualize.js';

export class PlanConverter {
  private readonly gate = new BoundedGate(
    MAX_QUEUED_CONVERSIONS,
    'CONVERTER_BUSY',
  );
  private readonly shutdown = new AbortController();
  private active = new Set<Promise<Scene>>();

  constructor(
    private readonly options: { timeoutMs?: number; workerUrl?: URL } = {},
  ) {}

  convert = (plan: string, signal?: AbortSignal): Promise<Scene> => {
    const job = this.run(plan, signal);
    this.active.add(job);
    void job.finally(() => this.active.delete(job)).catch(() => {});
    return job;
  };

  private async run(plan: string, caller?: AbortSignal): Promise<Scene> {
    const deadline = new AbortController();
    const timer = setTimeout(
      () =>
        deadline.abort(
          new VisualizeError(
            'CONVERT_TIMEOUT',
            'Plan conversion exceeded 5 seconds. Submit a smaller plan.',
          ),
        ),
      this.options.timeoutMs ?? CONVERT_TIMEOUT_MS,
    );
    const signal = AbortSignal.any([
      deadline.signal,
      this.shutdown.signal,
      ...(caller ? [caller] : []),
    ]);
    let release: (() => void) | undefined;
    let worker: Worker | undefined;
    let abort: (() => void) | undefined;
    try {
      release = await this.gate.acquire(signal);
      if (signal.aborted) throw cancellationError(signal);
      worker = new Worker(
        this.options.workerUrl ??
          new URL('./convert-worker.js', import.meta.url),
        {
          workerData: plan,
          // The worker is a compiled file, independent of host eval/loaders.
          execArgv: [],
          resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
          stdout: true,
          stderr: true,
        },
      );
      worker.stdout.resume();
      worker.stderr.resume();
      const running = worker;
      return await new Promise<Scene>((resolve, reject) => {
        abort = () => reject(cancellationError(signal));
        signal.addEventListener('abort', abort, { once: true });
        running.once(
          'message',
          (
            result: { ok: true; scene: Scene } | { ok: false; code: string },
          ) => {
            if (result.ok) resolve(result.scene);
            else
              reject(
                result.code === 'RESULT_TOO_LARGE'
                  ? tooLarge()
                  : new VisualizeError(
                      'INVALID_PLAN',
                      'Could not convert this DataFusion plan.',
                    ),
              );
          },
        );
        running.once('error', () =>
          reject(
            new VisualizeError(
              'CONVERT_FAILED',
              'Plan conversion failed or exceeded available memory. Submit a smaller plan.',
            ),
          ),
        );
        running.once('exit', () =>
          reject(
            new VisualizeError(
              'CONVERT_FAILED',
              'Plan conversion ended before producing a scene.',
            ),
          ),
        );
      });
    } finally {
      clearTimeout(timer);
      if (abort) signal.removeEventListener('abort', abort);
      await worker?.terminate();
      release?.();
    }
  }

  async close(): Promise<void> {
    this.shutdown.abort();
    await Promise.allSettled(this.active);
  }
}
