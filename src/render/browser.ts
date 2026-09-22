import { exportToBlob, restoreElements } from '@excalidraw/excalidraw';
import type { Scene } from '../lib/visualize.js';

// This is the only boundary between plan-viz's scene types and Excalidraw's
// versioned element types. plan-viz omits the reverse text binding on some
// containers; Excalidraw's import repair makes those labels visible on export.
export async function renderScene(
  scene: Scene,
  limits: { pixels: number; side: number },
): Promise<string> {
  const elements = restoreElements(
    scene.elements as unknown as Parameters<typeof restoreElements>[0],
    null,
    { repairBindings: true },
  );
  const blob = await exportToBlob({
    elements,
    appState: {
      ...scene.appState,
      exportBackground: true,
      exportWithDarkMode: false,
      exportEmbedScene: false,
    },
    files: null,
    mimeType: 'image/png',
    exportPadding: 20,
    getDimensions: (width: number, height: number) => {
      if (
        !Number.isFinite(width * height) ||
        width <= 0 ||
        height <= 0 ||
        width * height > limits.pixels ||
        width > limits.side ||
        height > limits.side
      ) {
        throw new Error('IMAGE_TOO_LARGE');
      }
      return { width, height, scale: 1 };
    },
  });
  if (!blob) throw new Error('EMPTY_PNG');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('PNG_READ_FAILED'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(blob);
  });
}
