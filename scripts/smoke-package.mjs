import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { PNG } from 'pngjs';
import { samplePlan } from '../tests/fixtures/plans.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'plan-viz-package-'));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this script with npm run test:package.');
const npm = (...args) =>
  execFileSync(process.execPath, [npmCli, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
const [packed] = JSON.parse(
  npm('pack', '--ignore-scripts', '--json', '--pack-destination', directory),
);
assert(
  packed.files.some((file) => file.path === 'dist/render/assets/browser.js'),
);
assert(packed.files.some((file) => file.path.includes('fonts/Nunito/')));
assert(
  !packed.files.some((file) => /^(?:tests|\.codex|src)\//.test(file.path)),
);
npm(
  'install',
  '--prefix',
  directory,
  '--ignore-scripts',
  '--omit=dev',
  '--no-audit',
  '--no-fund',
  join(directory, packed.filename),
);
const entry = join(directory, 'node_modules/plan-viz-mcp/dist/stdio.js');
const makeClient = () =>
  new Client(
    { name: 'package-smoke', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );

async function verify(connection) {
  assert.deepEqual(
    (await connection.listTools()).tools.map((tool) => tool.name),
    ['visualize'],
  );
  for (const format of ['.excalidraw', '.png']) {
    const result = await connection.callTool({
      name: 'visualize',
      arguments: { plan: samplePlan, format },
    });
    assert.equal(result.isError, false);
    if (format === '.png') {
      const image = PNG.sync.read(
        Buffer.from(
          result.content.find((block) => block.type === 'image').data,
          'base64',
        ),
      );
      assert(image.width > 100 && image.height > 100);
    } else {
      const scene = JSON.parse(
        result.content.find((block) => block.type === 'text').text,
      );
      assert(scene.elements.length > 0);
    }
  }
}

const stdio = makeClient();
try {
  await stdio.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [entry],
      cwd: directory,
    }),
  );
  await verify(stdio);
} finally {
  await stdio.close();
}

const { startHttpServer } = await import(
  pathToFileURL(join(directory, 'node_modules/plan-viz-mcp/dist/http.js')).href
);
const app = await startHttpServer({ port: 0 });
const http = makeClient();
try {
  await http.connect(new StreamableHTTPClientTransport(app.url));
  await verify(http);
} finally {
  await http.close();
  await app.close();
}
console.error(
  `Packed package passed stdio + HTTP checks for both formats. Artifact: ${join(directory, packed.filename)}`,
);
