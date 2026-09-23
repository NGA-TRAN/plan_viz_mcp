// Build first. Optional module paths allow comparisons with a saved build/version.
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const { PngRenderer } = await import(
  process.env.RENDERER_MODULE
    ? pathToFileURL(process.env.RENDERER_MODULE).href
    : '../dist/render/renderer.js'
);
const { convertPlanToExcalidraw } = await import(
  process.env.CONVERTER_MODULE
    ? pathToFileURL(process.env.CONVERTER_MODULE).href
    : 'plan-viz'
);
const source = 'DataSourceExec: file_groups={1 groups: [[data.parquet]]}';
const plans = {
  sample: `ProjectionExec: expr=[id, name, age]\n  FilterExec: age > 18\n    ${source}`,
  wide: `UnionExec\n${Array.from({ length: 8 }, () => `  ${source}`).join('\n')}`,
  tall: [
    ...Array.from(
      { length: 10 },
      (_, i) => `${'  '.repeat(i)}FilterExec: age > 18`,
    ),
    `${'  '.repeat(10)}${source}`,
  ].join('\n'),
};
const rounds = Number(process.env.BENCH_ROUNDS ?? 5);
if (!Number.isInteger(rounds) || rounds < 2)
  throw new Error('Use at least 2 rounds');
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};
const rows = [];
for (const [name, plan] of Object.entries(plans)) {
  let phases = {};
  const time = async (name, run) => {
    const start = performance.now();
    try {
      return await run();
    } finally {
      phases[name] = (phases[name] ?? 0) + performance.now() - start;
    }
  };
  const renderer = new PngRenderer({
    launch: async () => {
      const browser = await time('launch', () => chromium.launch());
      const newContext = browser.newContext.bind(browser);
      browser.newContext = (...args) =>
        time('context', async () => {
          const context = await newContext(...args);
          const newPage = context.newPage.bind(context);
          context.newPage = (...args) =>
            time('page', async () => {
              const page = await newPage(...args);
              for (const method of ['goto', 'evaluate']) {
                const original = page[method].bind(page);
                page[method] = (...args) =>
                  time(method, () => original(...args));
              }
              return page;
            });
          const close = context.close.bind(context);
          context.close = (...args) => time('close', () => close(...args));
          return context;
        });
      return browser;
    },
  });
  try {
    for (let round = 0; round < rounds; round++) {
      phases = {};
      const start = performance.now();
      const scene = convertPlanToExcalidraw(plan);
      const conversion = performance.now() - start;
      const png = await renderer.render(scene);
      const total = performance.now() - start;
      const image = PNG.sync.read(png);
      rows.push({
        plan: name,
        round,
        conversion,
        total,
        ...phases,
        bytes: png.length,
        dimensions: `${image.width}x${image.height}`,
      });
    }
  } finally {
    await renderer.close();
  }
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      rounds,
      rows,
      summary: Object.keys(plans).map((plan) => {
        const matching = rows.filter((row) => row.plan === plan);
        return {
          plan,
          coldMs: matching[0].total,
          warmMedianMs: median(matching.slice(1).map((row) => row.total)),
        };
      }),
    },
    null,
    2,
  ),
);
