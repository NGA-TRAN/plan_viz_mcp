import { createMcpHandler } from '@modelcontextprotocol/server';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/create-server.js';
import { samplePlan, explainPlan, analyzePlan } from './fixtures/plans.js';
import { assertScene, client, fakePng } from './helpers.js';

describe('MCP contract through the SDK', () => {
  const cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((close) => close()));
  });
  async function connect(modern = true, fail = false) {
    const handler = createMcpHandler(() =>
      createServer({
        renderPng: async () => {
          if (fail) throw new Error('secret plan');
          return fakePng;
        },
      }),
    );
    const connection = client(modern);
    const transport = new StreamableHTTPClientTransport(
      new URL('http://localhost/mcp'),
      {
        fetch: (input, init) => handler.fetch(new Request(input, init)),
      },
    );
    cleanups.push(async () => {
      await connection.close();
      await handler.close();
    });
    await connection.connect(transport);
    return connection;
  }

  it.each([true, false])(
    'lists one tool and converts through modern=%s',
    async (modern) => {
      const connection = await connect(modern);
      const tools = await connection.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(['visualize']);
      expect(tools.tools[0]?.inputSchema.required).toEqual(['plan', 'format']);
      expect(tools.tools[0]?.annotations).toMatchObject({
        readOnlyHint: true,
        openWorldHint: false,
      });
      for (const plan of [samplePlan, explainPlan, analyzePlan]) {
        const result = await connection.callTool({
          name: 'visualize',
          arguments: { plan, format: '.excalidraw' },
        });
        assertScene(result);
        const [scene, link] = result.content.filter(
          (block) => block.type === 'text',
        );
        const [, dataUrl] = link!.text.match(
          /^\[Open in Excalidraw\]\(https:\/\/excalidraw\.com\/#url=(.+)\)$/,
        )!;
        expect(await (await fetch(decodeURIComponent(dataUrl!))).text()).toBe(
          scene!.text,
        );
      }
      const png = await connection.callTool({
        name: 'visualize',
        arguments: { plan: samplePlan, format: '.png' },
      });
      expect(png.content).toEqual([
        {
          type: 'image',
          mimeType: 'image/png',
          data: fakePng.toString('base64'),
        },
      ]);
    },
  );

  it('keeps large scenes available when the link exceeds the result limit', async () => {
    const connection = await connect();
    const result = await connection.callTool({
      name: 'visualize',
      arguments: {
        plan:
          'UnionExec\n' +
          '  DataSourceExec: partitions=1, partition_sizes=[1]\n'.repeat(1000),
        format: '.excalidraw',
      },
    });
    expect(result.isError).toBe(false);
    expect(result.content).toHaveLength(1);
  });

  it('reports tool argument errors without an image', async () => {
    const connection = await connect();
    for (const args of [
      { plan: ' ', format: '.png' },
      { plan: samplePlan },
      { plan: samplePlan, format: '.svg' },
    ]) {
      const result = await connection.callTool({
        name: 'visualize',
        arguments: args,
      });
      expect(result.isError).toBe(true);
      expect(result.content.every((block) => block.type === 'text')).toBe(true);
    }
  });

  it('does not expose renderer exceptions', async () => {
    const connection = await connect(true, true);
    const result = await connection.callTool({
      name: 'visualize',
      arguments: { plan: samplePlan, format: '.png' },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain('secret plan');
    expect(result.structuredContent).toBeUndefined();
  });
});
