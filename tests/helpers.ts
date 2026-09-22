import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { expect } from 'vitest';
import { PNG_SIGNATURE } from '../src/lib/constants.js';

// A fake image is enough for transport tests; real decoding lives in test:png.
export const fakePng = Buffer.concat([
  PNG_SIGNATURE,
  Buffer.from('fake-test-data'),
]);
export function client(modern = true): Client {
  return new Client(
    { name: 'plan-viz-test', version: '1.0.0' },
    modern ? { versionNegotiation: { mode: { pin: '2026-07-28' } } } : {},
  );
}
export async function httpClient(url: URL, modern = true) {
  const connection = client(modern);
  await connection.connect(new StreamableHTTPClientTransport(url));
  return connection;
}
export function assertScene(result: CallToolResult): void {
  expect(result.isError).toBe(false);
  expect(result.structuredContent).toEqual({
    format: '.excalidraw',
    mimeType: 'application/json',
  });
  const block = result.content.find((item) => item.type === 'text');
  if (!block || block.type !== 'text') throw new Error('Expected scene text');
  const scene = JSON.parse(block.text);
  expect(scene.type).toBe('excalidraw');
  expect(scene.elements.length).toBeGreaterThan(0);
  expect(
    scene.elements
      .filter((element: { type: string }) => element.type === 'text')
      .map((element: { text: string }) => element.text),
  ).toEqual(
    expect.arrayContaining(['ProjectionExec', 'FilterExec', 'DataSourceExec']),
  );
}
