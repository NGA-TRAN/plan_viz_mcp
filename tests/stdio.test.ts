import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';
import { it, expect } from 'vitest';
import { client, assertScene } from './helpers.js';
import { samplePlan } from './fixtures/plans.js';

it.each([true, false])(
  'runs built stdio executable with modern=%s and clean stdout',
  async (modern) => {
    const connection = client(modern);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL('../dist/stdio.js', import.meta.url))],
      stderr: 'pipe',
      cwd: '/tmp',
    });
    const errors: unknown[] = [];
    connection.onerror = (error) => errors.push(error);
    try {
      await connection.connect(transport);
      expect(
        (await connection.listTools()).tools.map((tool) => tool.name),
      ).toEqual(['visualize']);
      assertScene(
        await connection.callTool({
          name: 'visualize',
          arguments: { plan: samplePlan, format: '.excalidraw' },
        }),
      );
      expect(errors).toEqual([]);
    } finally {
      await connection.close();
    }
  },
);
