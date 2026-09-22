export const TOOL_NAME = 'visualize';
export const SERVER_NAME = 'plan-viz-mcp';
export const FORMATS = ['.excalidraw', '.png'] as const;
export const MIME = {
  '.excalidraw': 'application/json',
  '.png': 'image/png',
} as const;
export const MAX_PLAN_BYTES = 512 * 1024;
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_RESULT_BYTES = 8 * 1024 * 1024;
export const MAX_PIXELS = 16_000_000;
export const MAX_IMAGE_SIDE = 16_384;
export const RENDER_TIMEOUT_MS = 30_000;
export const MAX_QUEUED_RENDERS = 4;
export const CONVERT_TIMEOUT_MS = 5_000;
export const MAX_QUEUED_CONVERSIONS = 4;
export const DEFAULT_PORT = 3333;
export const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
