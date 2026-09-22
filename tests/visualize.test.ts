import { describe, expect, it, vi } from 'vitest';
import { convertPlanToExcalidraw } from 'plan-viz';
import { inputSchema, outputSchema } from '../src/lib/schemas.js';
import { MAX_PLAN_BYTES, MAX_RESULT_BYTES } from '../src/lib/constants.js';
import { visualize } from '../src/lib/visualize.js';
import { samplePlan, explainPlan, analyzePlan } from './fixtures/plans.js';
import { fakePng } from './helpers.js';

describe('visualize', () => {
  it.each([
    '',
    '   ',
    'x'.repeat(MAX_PLAN_BYTES + 1),
    'é'.repeat(MAX_PLAN_BYTES / 2 + 1),
  ])(
    'rejects blank or oversized plans before conversion (%#)',
    async (plan) => {
      const convert = vi.fn();
      await expect(
        visualize({ plan, format: '.png' }, { convert, renderPng: vi.fn() }),
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      expect(convert).not.toHaveBeenCalled();
    },
  );

  it('validates exact UTF-8 boundary and rejects absent/unknown format', () => {
    expect(
      inputSchema.safeParse({
        plan: 'é'.repeat(MAX_PLAN_BYTES / 2),
        format: '.excalidraw',
      }).success,
    ).toBe(true);
    expect(inputSchema.safeParse({ plan: samplePlan }).success).toBe(false);
    expect(
      inputSchema.safeParse({ plan: samplePlan, format: '.svg' }).success,
    ).toBe(false);
    expect(
      outputSchema.safeParse({ format: '.png', mimeType: 'application/json' })
        .success,
    ).toBe(false);
  });

  it.each([samplePlan, explainPlan, analyzePlan])(
    'converts real supported input (%#)',
    async (plan) => {
      const renderPng = vi.fn();
      const result = await visualize(
        { plan, format: '.excalidraw' },
        { renderPng },
      );
      expect(result.format).toBe('.excalidraw');
      if (result.format !== '.excalidraw') throw new Error('Wrong format');
      expect(JSON.parse(result.text).elements.length).toBeGreaterThan(0);
      expect(renderPng).not.toHaveBeenCalled();
    },
  );

  it('preserves indentation and sends the single converted scene to the renderer', async () => {
    const scene = convertPlanToExcalidraw(samplePlan);
    const convert = vi.fn(() => scene);
    const renderPng = vi.fn(async () => fakePng);
    const result = await visualize(
      { plan: samplePlan, format: '.png' },
      { convert, renderPng },
    );
    expect(convert).toHaveBeenCalledExactlyOnceWith(samplePlan, undefined);
    expect(renderPng).toHaveBeenCalledExactlyOnceWith(scene, undefined);
    expect(result).toEqual({
      format: '.png',
      data: fakePng.toString('base64'),
    });
  });

  it('does not render when conversion throws or returns an empty scene', async () => {
    const renderPng = vi.fn();
    await expect(
      visualize(
        { plan: samplePlan, format: '.png' },
        {
          convert: () => {
            throw new Error('private plan');
          },
          renderPng,
        },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_PLAN' });
    await expect(
      visualize(
        { plan: samplePlan, format: '.png' },
        {
          convert: () => ({
            ...convertPlanToExcalidraw(samplePlan),
            elements: [],
          }),
          renderPng,
        },
      ),
    ).rejects.toMatchObject({ code: 'EMPTY_SCENE' });
    expect(renderPng).not.toHaveBeenCalled();
  });

  it('sanitizes renderer errors and rejects invalid PNG bytes', async () => {
    await expect(
      visualize(
        { plan: samplePlan, format: '.png' },
        {
          renderPng: async () => {
            throw new Error('private details');
          },
        },
      ),
    ).rejects.toMatchObject({ code: 'RENDER_FAILED' });
    await expect(
      visualize(
        { plan: samplePlan, format: '.png' },
        { renderPng: async () => Buffer.from('not PNG') },
      ),
    ).rejects.toMatchObject({ code: 'RENDER_FAILED' });
  });

  it('rejects expanded results and honours pre-cancellation', async () => {
    const scene = convertPlanToExcalidraw(samplePlan);
    scene.source = 'x'.repeat(MAX_RESULT_BYTES);
    await expect(
      visualize(
        { plan: samplePlan, format: '.excalidraw' },
        { convert: () => scene, renderPng: vi.fn() },
      ),
    ).rejects.toMatchObject({ code: 'RESULT_TOO_LARGE' });
    await expect(
      visualize(
        { plan: samplePlan, format: '.png' },
        { renderPng: vi.fn() },
        AbortSignal.abort(),
      ),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});
