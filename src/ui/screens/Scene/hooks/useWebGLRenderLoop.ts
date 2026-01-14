import type { SceneUiApi } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { WebGLSceneRenderer } from "@ui/renderers/utils/WebGLSceneRenderer";
import { setSceneTimelineTimeMs } from "@ui/renderers/primitives/utils/sceneTimeline";
import type { SceneCameraState } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

/**
 * Callback called before scene update (flushChanges, applyChanges, syncBuffers)
 */
export type BeforeUpdateCallback = (
  timestamp: number,
  scene: SceneUiApi
) => void;

/**
 * Callback called after applyChanges but before syncBuffers
 * Useful for applying interpolated positions or other per-frame updates
 */
export type AfterApplyChangesCallback = (
  timestamp: number,
  scene: SceneUiApi,
  cameraState: SceneCameraState
) => void;

/**
 * Callback called after scene update but before rendering
 */
export type AfterUpdateCallback = (
  timestamp: number,
  scene: SceneUiApi,
  cameraState: SceneCameraState
) => void;

/**
 * Callback called after base scene render but before effects
 */
export type BeforeEffectsCallback = (
  timestamp: number,
  gl: WebGL2RenderingContext,
  cameraState: SceneCameraState
) => void;

/**
 * Callback called after all rendering is complete
 */
export type AfterRenderCallback = (
  timestamp: number,
  gl: WebGL2RenderingContext,
  cameraState: SceneCameraState
) => void;

export interface CreateWebGLRenderLoopOptions {
  /** WebGL renderer instance */
  webglRenderer: WebGLSceneRenderer;
  /** Scene object manager */
  scene: SceneUiApi;
  /** WebGL context */
  gl: WebGL2RenderingContext;
  /** Optional callback before scene update */
  beforeUpdate?: BeforeUpdateCallback;
  /** Optional callback after applyChanges but before syncBuffers */
  afterApplyChanges?: AfterApplyChangesCallback;
  /** Optional callback after scene update */
  afterUpdate?: AfterUpdateCallback;
  /** Optional callback before effects rendering */
  beforeEffects?: BeforeEffectsCallback;
  /** Optional callback after all rendering */
  afterRender?: AfterRenderCallback;
}

export interface WebGLRenderLoop {
  /** Start the render loop */
  start: () => void;
  /** Stop the render loop */
  stop: () => void;
}

/**
 * Creates a shared WebGL render loop that handles common rendering logic.
 * 
 * Common steps:
 * 1. setSceneTimelineTimeMs(timestamp)
 * 2. beforeUpdate callback (if provided)
 * 3. scene.flushChanges()
 * 4. webglRenderer.getObjectsRenderer().applyChanges(changes)
 * 5. afterApplyChanges callback (if provided) - useful for interpolated positions
 * 6. webglRenderer.syncBuffers()
 * 7. afterUpdate callback (if provided)
 * 8. webglRenderer.render(cameraState)
 * 9. beforeEffects callback (if provided)
 * 10. afterRender callback (if provided)
 * 
 * @param options - Configuration options for the render loop
 * @returns Object with start() and stop() methods to control the render loop
 */
export const createWebGLRenderLoop = (
  options: CreateWebGLRenderLoopOptions
): WebGLRenderLoop => {
  const {
    webglRenderer,
    scene,
    gl,
    beforeUpdate,
    afterApplyChanges,
    afterUpdate,
    beforeEffects,
    afterRender,
  } = options;

  let frameId: number | null = null;
  let lastTimestamp: number | null = null;

  const render = (timestamp: number) => {
    const frameDeltaMs =
      lastTimestamp === null ? 0 : Math.max(0, timestamp - lastTimestamp);
    lastTimestamp = timestamp;
    // Step 1: Update timeline
    setSceneTimelineTimeMs(timestamp);

    // Step 2: Before update callback
    if (beforeUpdate) {
      beforeUpdate(timestamp, scene);
    }

    // Step 3-4: Update scene and apply changes
    const cameraState = scene.getCamera();
    const changes = scene.flushChanges();
    webglRenderer.getObjectsRenderer().applyChanges(changes, frameDeltaMs);

    // Step 5: After applyChanges callback (useful for interpolated positions)
    if (afterApplyChanges) {
      afterApplyChanges(timestamp, scene, cameraState);
    }

    // Step 6: Sync buffers
    webglRenderer.syncBuffers(frameDeltaMs);

    // Step 7: After update callback
    if (afterUpdate) {
      afterUpdate(timestamp, scene, cameraState);
    }

    // Step 7: Render base scene
    webglRenderer.render(cameraState);

    // Step 8: Before effects callback
    if (beforeEffects) {
      beforeEffects(timestamp, gl, cameraState);
    }

    // Step 9: After render callback
    if (afterRender) {
      afterRender(timestamp, gl, cameraState);
    }

    // Continue render loop
    frameId = window.requestAnimationFrame(render);
  };

  return {
    start: () => {
      if (frameId === null) {
        frameId = window.requestAnimationFrame(render);
      }
    },
    stop: () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
    },
  };
};
