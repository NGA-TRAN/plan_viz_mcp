import { afterEach, expect, it } from 'vitest';
import { PlanConverter } from '../src/lib/converter.js';
import { samplePlan, explainPlan, analyzePlan } from './fixtures/plans.js';

const instances: PlanConverter[] = [];
afterEach(async () => {
  await Promise.all(instances.splice(0).map((instance) => instance.close()));
});
function converter(timeoutMs?: number) {
  const instance = new PlanConverter({
    timeoutMs,
    workerUrl: new URL('../dist/lib/convert-worker.js', import.meta.url),
  });
  instances.push(instance);
  return instance;
}

it('converts each supported input in a real worker', async () => {
  const instance = converter();
  for (const plan of [samplePlan, explainPlan, analyzePlan]) {
    expect((await instance.convert(plan)).elements.length).toBeGreaterThan(0);
  }
});

it('terminates workers at their deadline and remains usable', async () => {
  const instance = converter(1);
  await expect(instance.convert(samplePlan)).rejects.toMatchObject({
    code: 'CONVERT_TIMEOUT',
  });
  await expect(instance.convert(samplePlan)).rejects.toMatchObject({
    code: 'CONVERT_TIMEOUT',
  });
});

it('cancels work and rejects new work after shutdown', async () => {
  const instance = converter();
  const controller = new AbortController();
  const job = instance.convert(samplePlan, controller.signal);
  const check = expect(job).rejects.toMatchObject({ code: 'CANCELLED' });
  controller.abort();
  await check;
  expect((await instance.convert(samplePlan)).elements.length).toBeGreaterThan(
    0,
  );
  await instance.close();
  await expect(instance.convert(samplePlan)).rejects.toMatchObject({
    code: 'CANCELLED',
  });
});

it('rejects excess conversions without an unbounded worker queue', async () => {
  const instance = converter();
  const controller = new AbortController();
  const jobs = Array.from({ length: 5 }, () =>
    instance.convert(samplePlan, controller.signal),
  );
  const checks = jobs.map((job) =>
    expect(job).rejects.toMatchObject({ code: 'CANCELLED' }),
  );
  await expect(instance.convert(samplePlan)).rejects.toMatchObject({
    code: 'CONVERTER_BUSY',
  });
  controller.abort();
  await Promise.all(checks);
});
