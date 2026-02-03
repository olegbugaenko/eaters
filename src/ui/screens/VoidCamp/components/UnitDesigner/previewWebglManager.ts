import { setupWebGLScene } from "@ui/screens/Scene/hooks/useWebGLSceneSetup";
import type { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";

type PreviewEntry = {
  gl: WebGL2RenderingContext;
  webglRenderer: ReturnType<typeof setupWebGLScene>["webglRenderer"];
  cleanup: () => void;
  refCount: number;
  disposeTimeoutId: number | null;
};

const previews = new Map<string, PreviewEntry>();
const DISPOSE_DELAY_MS = 200;

export const acquirePreviewWebgl = (
  previewId: string,
  canvas: HTMLCanvasElement,
  scene: SceneObjectManager,
  options: Parameters<typeof setupWebGLScene>[2]
) => {
  const existing = previews.get(previewId);
  if (existing) {
    existing.refCount += 1;
    if (existing.disposeTimeoutId !== null) {
      window.clearTimeout(existing.disposeTimeoutId);
      existing.disposeTimeoutId = null;
    }
    return existing;
  }

  const setup = setupWebGLScene(canvas, scene, options);
  const entry: PreviewEntry = {
    gl: setup.gl,
    webglRenderer: setup.webglRenderer,
    cleanup: setup.cleanup,
    refCount: 1,
    disposeTimeoutId: null,
  };
  previews.set(previewId, entry);
  return entry;
};

export const releasePreviewWebgl = (previewId: string) => {
  const entry = previews.get(previewId);
  if (!entry) {
    return;
  }

  entry.refCount = Math.max(0, entry.refCount - 1);
  if (entry.refCount > 0) {
    return;
  }

  if (entry.disposeTimeoutId !== null) {
    window.clearTimeout(entry.disposeTimeoutId);
  }

  entry.disposeTimeoutId = window.setTimeout(() => {
    const current = previews.get(previewId);
    if (!current || current.refCount > 0) {
      return;
    }
    current.cleanup();
    current.gl.getExtension("WEBGL_lose_context")?.loseContext();
    previews.delete(previewId);
  }, DISPOSE_DELAY_MS);
};
