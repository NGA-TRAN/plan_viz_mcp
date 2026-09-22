import { readFile } from 'node:fs/promises';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import {
  MAX_IMAGE_SIDE,
  MAX_PIXELS,
  MAX_QUEUED_RENDERS,
  RENDER_TIMEOUT_MS,
} from '../lib/constants.js';
import {
  VisualizeError,
  cancellationError as cancelled,
} from '../lib/errors.js';
import { BoundedGate } from '../lib/gate.js';
import type { Scene } from '../lib/visualize.js';

const ORIGIN = 'http://plan-viz-renderer.local';
const ASSETS = new URL('./assets/', import.meta.url);
const HTML =
  '<!doctype html><meta charset="utf-8"><script>window.EXCALIDRAW_ASSET_PATH="/";</script><script src="/browser.js"></script>';

export interface RendererOptions {
  timeoutMs?: number;
  maxQueued?: number;
  launch?: () => Promise<Browser>;
  assets?: URL;
}

/** One browser, one active export, bounded queue; no scene caching. */
export class PngRenderer {
  private browser?: Promise<Browser>;
  private stopped = false;
  private gate: BoundedGate;
  private shutdown = new AbortController();
  private active = new Set<Promise<Buffer>>();
  private closePromise?: Promise<void>;

  constructor(private readonly options: RendererOptions = {}) {
    this.gate = new BoundedGate(
      options.maxQueued ?? MAX_QUEUED_RENDERS,
      'RENDER_BUSY',
    );
  }

  render = (scene: Scene, signal?: AbortSignal): Promise<Buffer> => {
    const job = this.run(scene, signal);
    this.active.add(job);
    void job.finally(() => this.active.delete(job)).catch(() => {});
    return job;
  };

  private getBrowser(): Promise<Browser> {
    this.browser ??= (
      this.options.launch ??
      (() => chromium.launch({ timeout: RENDER_TIMEOUT_MS }))
    )()
      .then(async (browser) => {
        if (this.stopped) {
          await browser.close();
          throw new VisualizeError('CANCELLED', 'Renderer is shutting down.');
        }
        browser.on('disconnected', () => {
          this.browser = undefined;
        });
        return browser;
      })
      .catch((error: unknown) => {
        this.browser = undefined;
        if (error instanceof VisualizeError) throw error;
        throw new VisualizeError(
          'BROWSER_UNAVAILABLE',
          'Chromium could not start. Run "npx playwright install chromium" using this package’s Playwright version.',
        );
      });
    return this.browser;
  }

  private async run(scene: Scene, caller?: AbortSignal): Promise<Buffer> {
    if (this.stopped)
      throw new VisualizeError('CANCELLED', 'Renderer is shutting down.');
    const deadline = new AbortController();
    const timer = setTimeout(
      () =>
        deadline.abort(
          new VisualizeError(
            'RENDER_TIMEOUT',
            'PNG rendering timed out. Try a smaller plan.',
          ),
        ),
      this.options.timeoutMs ?? RENDER_TIMEOUT_MS,
    );
    const signal = AbortSignal.any([
      deadline.signal,
      this.shutdown.signal,
      ...(caller ? [caller] : []),
    ]);
    let release: (() => void) | undefined;
    let context: BrowserContext | undefined;
    let contextClosing: Promise<void> | undefined;
    const closeContext = () =>
      (contextClosing ??= context?.close().catch(() => {}));
    const abort = () => {
      void closeContext();
    };
    signal.addEventListener('abort', abort, { once: true });
    try {
      release = await this.gate.acquire(signal);
      const browser = await abortable(this.getBrowser(), signal);
      // Close a context even if cancellation races its creation.
      context = await browser.newContext({
        serviceWorkers: 'block',
        acceptDownloads: false,
      });
      if (signal.aborted) throw cancelled(signal);
      const assets = this.options.assets ?? ASSETS;
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== ORIGIN) return route.abort();
        if (url.pathname === '/')
          return route.fulfill({ contentType: 'text/html', body: HTML });
        // Only generated bundles and font assets are addressable, with no traversal.
        if (
          !/^\/(?:[\w.-]+\.(?:js|wasm)|fonts\/[\w/-]+\.woff2)$/.test(
            url.pathname,
          )
        )
          return route.abort();
        try {
          const body = await readFile(new URL(`.${url.pathname}`, assets));
          const contentType = url.pathname.endsWith('.woff2')
            ? 'font/woff2'
            : url.pathname.endsWith('.wasm')
              ? 'application/wasm'
              : 'application/javascript';
          await route.fulfill({ body, contentType });
        } catch {
          await route.abort();
        }
      });
      const page = await context.newPage();
      await page.goto(`${ORIGIN}/`);
      const data = await page.evaluate(
        async ({ scene, pixels, side }) => {
          const renderer = (
            window as unknown as {
              PlanVizRenderer: {
                renderScene: (
                  scene: unknown,
                  limits: { pixels: number; side: number },
                ) => Promise<string>;
              };
            }
          ).PlanVizRenderer;
          return renderer.renderScene(scene, { pixels, side });
        },
        { scene, pixels: MAX_PIXELS, side: MAX_IMAGE_SIDE },
      );
      if (signal.aborted) throw cancelled(signal);
      return Buffer.from(data, 'base64');
    } catch (error) {
      if (signal.aborted) throw cancelled(signal);
      if (error instanceof Error && error.message.includes('IMAGE_TOO_LARGE')) {
        throw new VisualizeError(
          'IMAGE_TOO_LARGE',
          'Diagram exceeds PNG dimensions (16 megapixels or 16384 pixels per side). Request ".excalidraw" or use a smaller plan.',
        );
      }
      if (error instanceof VisualizeError) throw error;
      throw new VisualizeError(
        'RENDER_FAILED',
        'PNG export failed. Try ".excalidraw" or a smaller plan.',
      );
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      await closeContext();
      release?.();
    }
  }

  close(): Promise<void> {
    this.closePromise ??= (async () => {
      this.stopped = true;
      this.shutdown.abort();
      await Promise.allSettled(this.active);
      const browser = await this.browser?.catch(() => undefined);
      await browser?.close();
    })();
    return this.closePromise;
  }
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(cancelled(signal));
  return new Promise((resolve, reject) => {
    const abort = () => reject(cancelled(signal));
    signal.addEventListener('abort', abort, { once: true });
    operation
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}
