import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { readFileSync } from 'node:fs';
import {
  MAX_RESULT_BYTES,
  MIME,
  SERVER_NAME,
  TOOL_NAME,
} from './lib/constants.js';
import { logFailure, safeError } from './lib/errors.js';
import { inputSchema, outputSchema } from './lib/schemas.js';
import {
  visualize,
  tooLarge,
  type VisualizeDependencies,
} from './lib/visualize.js';

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

export function createServer(dependencies: VisualizeDependencies): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version });
  server.registerTool(
    TOOL_NAME,
    {
      title: 'Visualize a DataFusion execution plan',
      description:
        'Convert raw DataFusion physical plan or EXPLAIN / EXPLAIN ANALYZE output into an editable Excalidraw scene or PNG image. Does not execute SQL.',
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input, context) => {
      try {
        const output = await visualize(
          input,
          dependencies,
          context.mcpReq.signal,
        );
        const metadata = {
          format: output.format,
          mimeType: MIME[output.format],
        };
        const result: CallToolResult = {
          resultType: 'complete',
          isError: false,
          content:
            output.format === '.excalidraw'
              ? [{ type: 'text', text: output.text }]
              : [{ type: 'image', data: output.data, mimeType: MIME['.png'] }],
          structuredContent: metadata,
        };
        if (output.format === '.excalidraw') {
          const dataUrl = `data:application/json;base64,${Buffer.from(output.text).toString('base64')}`;
          result.content.push({
            type: 'text',
            text: `[Open in Excalidraw](https://excalidraw.com/#url=${encodeURIComponent(dataUrl)})`,
          });
          if (Buffer.byteLength(JSON.stringify(result)) > MAX_RESULT_BYTES)
            result.content.pop();
        }
        if (Buffer.byteLength(JSON.stringify(result)) > MAX_RESULT_BYTES)
          throw tooLarge();
        return result;
      } catch (error) {
        logFailure(error);
        return {
          resultType: 'complete',
          isError: true,
          content: [{ type: 'text', text: safeError(error).message }],
        };
      }
    },
  );
  return server;
}
