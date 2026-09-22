import { build } from 'esbuild';
import { cp, mkdir, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const assets = new URL('dist/render/assets/', root);
await mkdir(assets, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('src/render/browser.ts', root))],
  outfile: fileURLToPath(new URL('browser.js', assets)),
  bundle: true,
  format: 'iife',
  globalName: 'PlanVizRenderer',
  platform: 'browser',
  target: 'chrome120',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.woff2': 'file', '.wasm': 'file' },
  assetNames: '[name]-[hash]',
  legalComments: 'linked',
});
await cp(
  new URL('node_modules/@excalidraw/excalidraw/dist/prod/fonts/', root),
  new URL('fonts/', assets),
  { recursive: true },
);
await chmod(new URL('dist/stdio.js', root), 0o755);
