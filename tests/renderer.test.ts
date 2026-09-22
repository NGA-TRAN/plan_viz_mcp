import { expect, it, vi } from 'vitest';
import type { Browser } from 'playwright';
import { PngRenderer } from '../src/render/renderer.js';
import { convertPlanToExcalidraw } from 'plan-viz';
import { samplePlan } from './fixtures/plans.js';

const scene = convertPlanToExcalidraw(samplePlan);

it('does not launch until used; missing browser is actionable and retried', async () => {
  const launch = vi.fn(async () => {
    throw new Error('missing binary /private/path');
  });
  const renderer = new PngRenderer({ launch });
  expect(launch).not.toHaveBeenCalled();
  await expect(renderer.render(scene)).rejects.toMatchObject({
    code: 'BROWSER_UNAVAILABLE',
  });
  await expect(renderer.render(scene)).rejects.toThrow(
    'playwright install chromium',
  );
  expect(launch).toHaveBeenCalledTimes(2);
  await renderer.close();
  await expect(renderer.render(scene)).rejects.toMatchObject({
    code: 'CANCELLED',
  });
});

it('bounds queue length, cancels queued jobs, and closes a late browser on shutdown', async () => {
  let resolveLaunch!: (browser: Browser) => void;
  const launch = vi.fn(
    () =>
      new Promise<Browser>((resolve) => {
        resolveLaunch = resolve;
      }),
  );
  const renderer = new PngRenderer({ launch, maxQueued: 1 });
  const controller = new AbortController();
  const first = renderer.render(scene);
  const firstCheck = expect(first).rejects.toMatchObject({ code: 'CANCELLED' });
  await Promise.resolve();
  const queued = renderer.render(scene, controller.signal);
  const queuedCheck = expect(queued).rejects.toMatchObject({
    code: 'CANCELLED',
  });
  await expect(renderer.render(scene)).rejects.toMatchObject({
    code: 'RENDER_BUSY',
  });
  controller.abort();
  await queuedCheck;
  const closing = renderer.close();
  const close = vi.fn(async () => {});
  resolveLaunch({ close } as unknown as Browser);
  await closing;
  await firstCheck;
  expect(close).toHaveBeenCalledOnce();
});

it('includes queue wait in the render deadline', async () => {
  let rejectLaunch!: (error: Error) => void;
  const renderer = new PngRenderer({
    timeoutMs: 30,
    launch: () =>
      new Promise<Browser>((_, reject) => {
        rejectLaunch = reject;
      }),
  });
  const first = renderer.render(scene);
  const second = renderer.render(scene);
  await Promise.all([
    expect(first).rejects.toMatchObject({ code: 'RENDER_TIMEOUT' }),
    expect(second).rejects.toMatchObject({ code: 'RENDER_TIMEOUT' }),
  ]);
  rejectLaunch(new Error('launch ended'));
  await renderer.close();
});
