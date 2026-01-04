import { SceneObjectManager } from "@logic/services/scene-object-manager/SceneObjectManager";
import { WebGLSceneRenderer } from "@ui/renderers/utils/WebGLSceneRenderer";
import { createObjectsRendererManager } from "@ui/renderers/objects";
import { clearAllAuraSlots } from "@ui/renderers/objects";
import { petalAuraGpuRenderer } from "@ui/renderers/primitives/gpu/PetalAuraGpuRenderer";
import { setParticleEmitterGlContext } from "@ui/renderers/primitives/utils/gpuContext";
import { whirlGpuRenderer } from "@ui/renderers/primitives/gpu/WhirlGpuRenderer";
import {
  bulletGpuRenderer,
  createBulletVisualConfig,
} from "@ui/renderers/primitives/gpu/BulletGpuRenderer";
import { setBulletRenderBridge } from "@logic/services/bullet-render-bridge/BulletRenderBridge";
import { ringGpuRenderer } from "@ui/renderers/primitives/gpu/RingGpuRenderer";
import { registerHmrCleanup } from "@ui/shared/hmrCleanup";
import { getParticleEmitterGlContext } from "@ui/renderers/primitives/utils/gpuContext";
// WhirlGpuRenderer now uses unified API
// PetalAuraGpuRenderer now uses unified API
import { disposeParticleRenderResources } from "@ui/renderers/primitives/gpu/ParticleEmitterGpuRenderer";
import { disposeFireRing } from "@ui/renderers/primitives/gpu/FireRingGpuRenderer";
// BulletGpuRenderer now uses unified API
// RingGpuRenderer now uses unified API - no separate imports needed
import { arcGpuRenderer } from "@ui/renderers/primitives/gpu/ArcGpuRenderer";

interface WebGLSceneSetupOptions {
  /** Initialize bullet GPU renderer (default: true) */
  initBullets?: boolean;
  /** Initialize ring GPU renderer (default: true) */
  initRings?: boolean;
}

interface WebGLSceneSetupResult {
  gl: WebGL2RenderingContext;
  webglRenderer: WebGLSceneRenderer;
  objectsRenderer: ReturnType<typeof createObjectsRendererManager>;
  cleanup: () => void;
}

/**
 * Sets up WebGL context and renderer.
 * Handles initialization of WebGL, shaders, buffers, and GPU effects.
 * 
 * @param canvas - HTML canvas element
 * @param scene - Scene object manager
 * @param options - Optional configuration for GPU effects initialization
 * @returns Setup result with gl context, renderer, and cleanup function
 */
export const setupWebGLScene = (
  canvas: HTMLCanvasElement,
  scene: SceneObjectManager,
  options?: WebGLSceneSetupOptions
): WebGLSceneSetupResult => {
  const { initBullets = true, initRings = true } = options ?? {};
  const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;

  if (!gl) {
    throw new Error("WebGL 2 is required but not available");
  }

  // Register HMR cleanup to avoid accumulating GL resources on hot reloads
  registerHmrCleanup(() => {
    try {
      const gl1 = getParticleEmitterGlContext();
      if (gl1) {
        try { disposeParticleRenderResources(gl1); } catch {}
        try { disposeFireRing(gl1); } catch {}
      }
      // WhirlGpuRenderer handles context loss automatically
      // PetalAuraGpuRenderer handles context loss automatically
      try { whirlGpuRenderer.dispose(); } catch {}
      try { petalAuraGpuRenderer.dispose(); } catch {}
    } finally {
      try { setParticleEmitterGlContext(null); } catch {}
      try { bulletGpuRenderer.setContext(null); } catch {}
      try { setBulletRenderBridge(null); } catch {}
      try { clearAllAuraSlots(); } catch {}
      try { petalAuraGpuRenderer.clearInstances(); } catch {}
      try { bulletGpuRenderer.clearInstances(); } catch {}
      try { ringGpuRenderer.clearInstances(); } catch {}
      try { ringGpuRenderer.dispose(); } catch {}
      try { arcGpuRenderer.clearInstances(); arcGpuRenderer.dispose(); } catch {}
    }
  });

  const objectsRenderer = createObjectsRendererManager();

  setParticleEmitterGlContext(gl);
  
  if (initBullets) {
    bulletGpuRenderer.setContext(gl);
    setBulletRenderBridge({
      acquireSlot: (config) => {
        return bulletGpuRenderer.acquireSlot({
          batchKey: config.visualKey,
          config,
        });
      },
      updateSlot: (handle, position, rotation, radius, active) => {
        bulletGpuRenderer.updateSlot(handle, {
          position,
          rotation,
          radius,
          active,
        });
      },
      releaseSlot: (handle) => {
        bulletGpuRenderer.releaseSlot(handle);
      },
      createConfig: createBulletVisualConfig,
    });
  }
  
  if (initRings) {
    ringGpuRenderer.setContext(gl);
  }
  
  whirlGpuRenderer.setContext(gl);
  petalAuraGpuRenderer.setContext(gl);

  clearAllAuraSlots();
  petalAuraGpuRenderer.clearInstances();
  objectsRenderer.bootstrap(scene.getObjects());

  // Initialize WebGL renderer (handles shaders, buffers, attributes, uniforms)
  const webglRenderer = new WebGLSceneRenderer(gl, objectsRenderer);

  const cleanup = () => {
    // Dispose WebGL renderer first (handles buffers, program, shaders)
    webglRenderer.dispose();
    webglRenderer.getObjectsRenderer().dispose();
    
    // Clear all GPU contexts
    setParticleEmitterGlContext(null);
    
    if (initBullets) {
      bulletGpuRenderer.setContext(null);
      setBulletRenderBridge(null);
    }
    
    if (gl) {
      try {
        whirlGpuRenderer.setContext(null);
      } catch {}
      try {
        petalAuraGpuRenderer.setContext(null);
      } catch {}
      try {
        disposeParticleRenderResources(gl);
      } catch {}
      try {
        disposeFireRing(gl);
      } catch {}
    } else {
      // WhirlGpuRenderer handles context loss automatically
      // PetalAuraGpuRenderer handles context loss automatically
    }
    
    // Dispose effect resources
    try {
      whirlGpuRenderer.dispose();
    } catch {}
    try {
      petalAuraGpuRenderer.dispose();
    } catch {}
    
    // Clear all instance data
    clearAllAuraSlots();
    petalAuraGpuRenderer.clearInstances();
    
    if (initBullets) {
      bulletGpuRenderer.clearInstances();
    }
    
    if (initRings) {
      ringGpuRenderer.clearInstances();
      ringGpuRenderer.dispose();
    }
    
    arcGpuRenderer.clearInstances();
    arcGpuRenderer.dispose();
  };

  return {
    gl,
    webglRenderer,
    objectsRenderer,
    cleanup,
  };
};
