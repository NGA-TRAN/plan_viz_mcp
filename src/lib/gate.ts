import { cancellationError, VisualizeError } from './errors.js';

/** Serializes expensive work and rejects excess or cancelled waiting jobs. */
export class BoundedGate {
  private busy = false;
  private queue: { start: () => void }[] = [];

  constructor(
    private readonly maxQueued: number,
    private readonly busyCode: string,
  ) {}

  acquire(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) return Promise.reject(cancellationError(signal));
    if (!this.busy) {
      this.busy = true;
      return Promise.resolve(() => this.release());
    }
    if (this.queue.length >= this.maxQueued) {
      return Promise.reject(
        new VisualizeError(
          this.busyCode,
          'Visualization service is busy. Retry after another request completes.',
        ),
      );
    }
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.queue = this.queue.filter((entry) => entry !== waiter);
        reject(cancellationError(signal));
      };
      const waiter = {
        start: () => {
          signal.removeEventListener('abort', abort);
          resolve(() => this.release());
        },
      };
      signal.addEventListener('abort', abort, { once: true });
      this.queue.push(waiter);
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) next.start();
    else this.busy = false;
  }
}
