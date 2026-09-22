#!/usr/bin/env node
import {
  serveStdio,
  StdioServerTransport,
} from '@modelcontextprotocol/server/stdio';
import { createServer } from './create-server.js';
import { MAX_REQUEST_BYTES } from './lib/constants.js';
import { logFailure } from './lib/errors.js';
import { createRuntime } from './runtime.js';

const runtime = createRuntime();
const transport = new StdioServerTransport(process.stdin, process.stdout, {
  maxBufferSize: MAX_REQUEST_BYTES,
});
const handle = serveStdio(() => createServer(runtime.dependencies), {
  transport,
  onerror: logFailure,
});
let closing = false;
async function close(): Promise<void> {
  if (closing) return;
  closing = true;
  await Promise.all([handle.close(), runtime.close()]);
}
for (const event of ['SIGINT', 'SIGTERM'] as const)
  process.once(event, () => {
    void close().catch(logFailure);
  });
process.stdin.once('end', () => {
  void close().catch(logFailure);
});
process.stdin.once('close', () => {
  void close().catch(logFailure);
});
