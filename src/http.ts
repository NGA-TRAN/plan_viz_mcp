import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { pathToFileURL } from 'node:url';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createServer } from './create-server.js';
import { DEFAULT_PORT, MAX_REQUEST_BYTES } from './lib/constants.js';
import { logFailure } from './lib/errors.js';
import type { VisualizeDependencies } from './lib/visualize.js';
import { createRuntime } from './runtime.js';

export async function startHttpServer(
  options: { port?: number; dependencies?: VisualizeDependencies } = {},
) {
  const runtime = options.dependencies ? undefined : createRuntime();
  const dependencies = options.dependencies ?? runtime!.dependencies;
  const handler = createMcpHandler(() => createServer(dependencies), {
    onerror: logFailure,
  });
  const nodeHandler = toNodeHandler(handler, { onerror: logFailure });
  const server = createHttpServer(
    { requestTimeout: 15_000, headersTimeout: 10_000 },
    (req, res) => {
      void handle(req, res).catch(() => {
        if (!res.headersSent) respond(res, 500, 'Internal server error.');
        else res.end();
      });
    },
  );

  async function handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const address = server.address();
    if (!address || typeof address === 'string')
      return respond(res, 503, 'Server unavailable.');
    const hosts = [`127.0.0.1:${address.port}`, `localhost:${address.port}`];
    if (
      !hosts.includes(req.headers.host ?? '') ||
      (req.headers.origin !== undefined &&
        !hosts.map((host) => `http://${host}`).includes(req.headers.origin))
    ) {
      return respond(res, 403, 'Host or Origin is not allowed.');
    }
    if (req.url !== '/mcp') return respond(res, 404, 'Not found.');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return respond(res, 405, 'Use POST for MCP requests.');
    }
    if (
      !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')
    )
      return respond(res, 415, 'Use application/json.');
    if (Number(req.headers['content-length']) > MAX_REQUEST_BYTES)
      return respond(res, 413, 'Request exceeds 4 MiB.');
    // Bound the stream before the SDK adapter buffers it. Pass valid parsed
    // bodies through its supported parsedBody argument; SDK owns MCP dispatch.
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk as string);
      bytes += buffer.length;
      if (bytes > MAX_REQUEST_BYTES) {
        respond(res, 413, 'Request exceeds 4 MiB.');
        return;
      }
      chunks.push(buffer);
    }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return respond(res, 400, 'Invalid JSON.');
    }
    await nodeHandler(req, res, body);
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? DEFAULT_PORT, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No listening address');
  let closing: Promise<void> | undefined;
  return {
    server,
    url: new URL(`http://127.0.0.1:${address.port}/mcp`),
    close: () =>
      (closing ??= (async () => {
        const closed = new Promise<void>((resolve) =>
          server.close(() => resolve()),
        );
        await Promise.allSettled([handler.close(), runtime?.close()]);
        server.closeAllConnections();
        await closed;
      })()),
  };
}

function respond(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be between 1 and 65535.');
  const app = await startHttpServer({ port });
  console.error(`[plan-viz-mcp] Listening on ${app.url}`);
  for (const event of ['SIGINT', 'SIGTERM'] as const)
    process.once(event, () => {
      void app.close().catch(logFailure);
    });
}
