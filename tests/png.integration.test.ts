import { afterEach, describe, expect, it, vi } from 'vitest';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { PNG } from 'pngjs';
import { convertPlanToExcalidraw } from 'plan-viz';
import { PngRenderer } from '../src/render/renderer.js';
import { samplePlan, explainPlan, analyzePlan } from './fixtures/plans.js';
import { PNG_SIGNATURE } from '../src/lib/constants.js';
import { startHttpServer } from '../src/http.js';
import { httpClient, assertScene, client } from './helpers.js';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';

const assets = new URL('../dist/render/assets/', import.meta.url);
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((close) => close()));
});

function assertPng(bytes: Buffer): void {
  expect(bytes.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  const image = PNG.sync.read(bytes);
  expect(image.width).toBeGreaterThan(100);
  expect(image.height).toBeGreaterThan(100);
  let ink = 0;
  for (let index = 0; index < image.data.length; index += 4) {
    if (
      image.data[index]! < 220 ||
      image.data[index + 1]! < 220 ||
      image.data[index + 2]! < 220
    )
      ink++;
  }
  expect(ink).toBeGreaterThan(500);
  expect(ink).toBeLessThan(image.width * image.height * 0.9);
  // Each operator title must contain ink away from the box borders. A valid
  // PNG with only boxes/property labels is not a usable execution plan.
  for (const top of [25, 165, 305]) {
    let labelInk = 0;
    for (let y = top; y < top + 25; y++) {
      for (let x = 55; x < 285; x++) {
        const index = (y * image.width + x) * 4;
        if (image.data[index]! < 160) labelInk++;
      }
    }
    expect(labelInk).toBeGreaterThan(100);
  }
}

describe('real Chromium export (required, never skipped)', () => {
  it('exports valid wide and tall diagrams without clipping the canvas', async () => {
    const renderer = new PngRenderer({ assets });
    cleanups.push(() => renderer.close());
    const source = samplePlan.split('\n').at(-1)!.trim();
    const wide = `UnionExec\n${Array.from({ length: 8 }, () => `  ${source}`).join('\n')}`;
    const tall = [
      ...Array.from(
        { length: 10 },
        (_, i) => `${'  '.repeat(i)}FilterExec: age > 18`,
      ),
      `${'  '.repeat(10)}${source}`,
    ].join('\n');
    for (const [plan, dimension] of [
      [wide, 'width'],
      [tall, 'height'],
    ] as const) {
      const image = PNG.sync.read(
        await renderer.render(convertPlanToExcalidraw(plan)),
      );
      expect(image[dimension]).toBeGreaterThan(1000);
      expect(image.width * image.height).toBeLessThanOrEqual(16_000_000);
    }
  }, 60_000);

  it('exports raw and table plans offline, loads fonts, reuses browser and closes contexts', async () => {
    let browser!: Browser;
    const requests: string[] = [];
    const loadedFonts: string[] = [];
    const contexts: BrowserContext[] = [];
    const launch = vi.fn(async () => {
      browser = await chromium.launch();
      const newContext = browser.newContext.bind(browser);
      vi.spyOn(browser, 'newContext').mockImplementation(async (options) => {
        const context = await newContext(options);
        contexts.push(context);
        context.on('request', (request) => requests.push(request.url()));
        context.on('response', (response) => {
          if (response.url().endsWith('.woff2') && response.status() === 200)
            loadedFonts.push(response.url());
        });
        return context;
      });
      return browser;
    });
    const renderer = new PngRenderer({ launch, assets });
    cleanups.push(() => renderer.close());
    for (const plan of [samplePlan, explainPlan, analyzePlan])
      assertPng(await renderer.render(convertPlanToExcalidraw(plan)));
    expect(launch).toHaveBeenCalledOnce();
    expect(contexts).toHaveLength(3);
    expect(browser.contexts()).toHaveLength(0);
    expect(loadedFonts.some((url) => url.includes('/Nunito/'))).toBe(true);
    expect(loadedFonts.some((url) => url.includes('/Lilita/'))).toBe(true);
    expect(
      requests.every((url) =>
        url.startsWith('http://plan-viz-renderer.local/'),
      ),
    ).toBe(true);
  }, 60_000);

  it('rejects huge diagrams before allocation and recovers after browser crash', async () => {
    let browser!: Browser;
    const launch = vi.fn(async () => {
      browser = await chromium.launch();
      return browser;
    });
    const renderer = new PngRenderer({ launch, assets });
    cleanups.push(() => renderer.close());
    const scene = convertPlanToExcalidraw(samplePlan);
    scene.elements[0]!.width = 1_000_000;
    await expect(renderer.render(scene)).rejects.toMatchObject({
      code: 'IMAGE_TOO_LARGE',
    });
    expect(browser.contexts()).toHaveLength(0);
    await browser.close();
    assertPng(await renderer.render(convertPlanToExcalidraw(samplePlan)));
    expect(launch).toHaveBeenCalledTimes(2);
  }, 60_000);

  it('closes an active context on cancellation', async () => {
    const browser = await chromium.launch();
    const createContext = browser.newContext.bind(browser);
    let created!: () => void;
    const ready = new Promise<void>((resolve) => {
      created = resolve;
    });
    vi.spyOn(browser, 'newContext').mockImplementation(async (options) => {
      const context = await createContext(options);
      const newPage = context.newPage.bind(context);
      vi.spyOn(context, 'newPage').mockImplementation(async () => {
        const page = await newPage();
        await page.route('**/browser.js', () => {
          created();
        });
        return page;
      });
      return context;
    });
    const renderer = new PngRenderer({ launch: async () => browser, assets });
    cleanups.push(() => renderer.close());
    const controller = new AbortController();
    const job = renderer.render(
      convertPlanToExcalidraw(samplePlan),
      controller.signal,
    );
    const check = expect(job).rejects.toMatchObject({ code: 'CANCELLED' });
    await ready;
    controller.abort();
    await check;
    expect(browser.contexts()).toHaveLength(0);
  }, 60_000);

  it('returns real PNG over HTTP and stdio', async () => {
    const renderer = new PngRenderer({ assets });
    const app = await startHttpServer({
      port: 0,
      dependencies: { renderPng: renderer.render },
    });
    cleanups.push(app.close, () => renderer.close());
    const http = await httpClient(app.url);
    const stdio = client();
    try {
      await stdio.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [fileURLToPath(new URL('../dist/stdio.js', import.meta.url))],
          cwd: '/tmp',
        }),
      );
      for (const connection of [http, stdio]) {
        const result = await connection.callTool({
          name: 'visualize',
          arguments: { plan: samplePlan, format: '.png' },
        });
        expect(result.isError).toBe(false);
        const block = result.content.find((item) => item.type === 'image');
        if (!block || block.type !== 'image') throw new Error('Expected image');
        assertPng(Buffer.from(block.data, 'base64'));
        assertScene(
          await connection.callTool({
            name: 'visualize',
            arguments: { plan: samplePlan, format: '.excalidraw' },
          }),
        );
      }
    } finally {
      await http.close();
      await stdio.close();
    }
  }, 60_000);
});
