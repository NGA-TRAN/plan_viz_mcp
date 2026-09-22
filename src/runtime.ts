import { PlanConverter } from './lib/converter.js';
import { PngRenderer } from './render/renderer.js';

export function createRuntime() {
  const converter = new PlanConverter();
  const renderer = new PngRenderer();
  return {
    dependencies: { convert: converter.convert, renderPng: renderer.render },
    close: async () => {
      await Promise.all([converter.close(), renderer.close()]);
    },
  };
}
