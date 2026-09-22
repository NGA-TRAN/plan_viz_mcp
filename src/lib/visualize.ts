import { convertPlanToExcalidraw } from 'plan-viz';
import { MAX_RESULT_BYTES, PNG_SIGNATURE } from './constants.js';
import { VisualizeError } from './errors.js';
import { inputSchema } from './schemas.js';

export type Scene = ReturnType<typeof convertPlanToExcalidraw>;
export type PngRenderer = (
  scene: Scene,
  signal?: AbortSignal,
) => Promise<Buffer>;
export interface VisualizeDependencies {
  convert?: (plan: string, signal?: AbortSignal) => Scene | Promise<Scene>;
  renderPng: PngRenderer;
}
export type Visualization =
  { format: '.excalidraw'; text: string } | { format: '.png'; data: string };

export async function visualize(
  input: unknown,
  dependencies: VisualizeDependencies,
  signal?: AbortSignal,
): Promise<Visualization> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    throw new VisualizeError(
      'INVALID_INPUT',
      'Provide a nonblank plan of at most 512 KiB and format ".excalidraw" or ".png".',
    );
  }
  if (signal?.aborted)
    throw new VisualizeError('CANCELLED', 'Visualization cancelled.');
  let scene: Scene;
  try {
    scene = dependencies.convert
      ? await dependencies.convert(parsed.data.plan, signal)
      : convertPlanToExcalidraw(parsed.data.plan);
  } catch (error) {
    if (error instanceof VisualizeError) throw error;
    throw new VisualizeError(
      'INVALID_PLAN',
      'Could not convert this plan. Provide DataFusion physical plan or EXPLAIN output.',
    );
  }
  if (!scene || !Array.isArray(scene.elements) || scene.elements.length === 0) {
    throw new VisualizeError(
      'EMPTY_SCENE',
      'The plan produced no diagram elements.',
    );
  }
  if (signal?.aborted)
    throw new VisualizeError('CANCELLED', 'Visualization cancelled.');
  if (parsed.data.format === '.excalidraw') {
    const text = JSON.stringify(scene, null, 2);
    if (Buffer.byteLength(text) > MAX_RESULT_BYTES) throw tooLarge();
    return { format: '.excalidraw', text };
  }
  let png: Buffer;
  try {
    png = await dependencies.renderPng(scene, signal);
  } catch (error) {
    if (error instanceof VisualizeError) throw error;
    throw new VisualizeError(
      'RENDER_FAILED',
      'PNG rendering failed. Try a smaller plan or request ".excalidraw".',
    );
  }
  if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new VisualizeError(
      'RENDER_FAILED',
      'The renderer did not produce a valid PNG.',
    );
  }
  if (Math.ceil(png.length / 3) * 4 > MAX_RESULT_BYTES) throw tooLarge();
  return { format: '.png', data: png.toString('base64') };
}

export function tooLarge(): VisualizeError {
  return new VisualizeError(
    'RESULT_TOO_LARGE',
    'The result exceeds 8 MiB. Submit a smaller plan.',
  );
}
