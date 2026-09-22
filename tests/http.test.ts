import { afterEach, describe, expect, it } from 'vitest';
import { request } from 'node:http';
import { startHttpServer } from '../src/http.js';
import { MAX_REQUEST_BYTES } from '../src/lib/constants.js';
import { assertScene, fakePng, httpClient } from './helpers.js';
import { samplePlan } from './fixtures/plans.js';

describe('local HTTP transport', () => {
  const cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((close) => close()));
  });
  async function start() {
    const app = await startHttpServer({
      port: 0,
      dependencies: { renderPng: async () => fakePng },
    });
    cleanups.push(app.close);
    return app;
  }

  it.each([true, false])(
    'serves concurrent requests on loopback with modern=%s',
    async (modern) => {
      const app = await start();
      expect(app.server.address()).toMatchObject({ address: '127.0.0.1' });
      const connection = await httpClient(app.url, modern);
      try {
        expect((await connection.listTools()).tools.length).toBe(1);
        const results = await Promise.all(
          [1, 2, 3].map(() =>
            connection.callTool({
              name: 'visualize',
              arguments: { plan: samplePlan, format: '.excalidraw' },
            }),
          ),
        );
        results.forEach(assertScene);
        const png = await connection.callTool({
          name: 'visualize',
          arguments: { plan: samplePlan, format: '.png' },
        });
        expect(png.content[0]?.type).toBe('image');
      } finally {
        await connection.close();
      }
    },
  );

  it('guards host, origin, method, route, body size, and JSON', async () => {
    const { url } = await start();
    const badHostStatus = await new Promise<number | undefined>(
      (resolve, reject) => {
        const req = request(
          url,
          { method: 'POST', headers: { Host: 'evil.example' } },
          (res) => {
            res.resume();
            resolve(res.statusCode);
          },
        );
        req.on('error', reject);
        req.end();
      },
    );
    expect(badHostStatus).toBe(403);
    for (const origin of [
      'https://evil.example',
      'null',
      'http://localhost:1',
    ]) {
      expect(
        (await fetch(url, { method: 'POST', headers: { Origin: origin } }))
          .status,
      ).toBe(403);
    }
    expect((await fetch(url)).status).toBe(405);
    expect((await fetch(new URL('/other', url))).status).toBe(404);
    expect((await fetch(url, { method: 'POST', body: '{}' })).status).toBe(415);
    expect(
      (
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'x'.repeat(MAX_REQUEST_BYTES + 1),
        })
      ).status,
    ).toBe(413);
  });

  it('limits chunked bodies with no content length', async () => {
    const { url } = await start();
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked',
          },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on('error', reject);
      for (let i = 0; i < 65; i++) req.write('x'.repeat(65536));
      req.end();
    });
    expect(status).toBe(413);
  });
});
