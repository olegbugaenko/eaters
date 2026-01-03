import { SceneObjectManager } from "@logic/services/scene-object-manager/SceneObjectManager";
import { WebGLSceneRenderer } from "@ui/renderers/utils/WebGLSceneRenderer";
import { createObjectsRendererManager } from "@ui/renderers/objects";
import { clearAllAuraSlots } from "@ui/renderers/objects";
import {
  clearPetalAuraInstances,
  petalAuraEffect,
} from "@ui/renderers/primitives/gpu/PetalAuraGpuRenderer";
import { setParticleEmitterGlContext } from "@ui/renderers/primitives/utils/gpuContext";
import { whirlEffect } from "@ui/renderers/primitives/gpu/WhirlGpuRenderer";
import {
  setBulletGpuContext,
  acquireBulletSlot,
  updateBulletSlot,
  releaseBulletSlot,
  createBulletVisualConfig,
} from "@ui/renderers/primitives/gpu/BulletGpuRenderer";
import { setBulletRenderBridge } from "@logic/services/bullet-render-bridge/BulletRenderBridge";
import { initRingGpuRenderer } from "@ui/renderers/primitives/gpu/RingGpuRenderer";
import { registerHmrCleanup } from "@ui/shared/hmrCleanup";
import { getParticleEmitterGlContext } from "@ui/renderers/primitives/utils/gpuContext";
import { getWhirlGlContext } from "@ui/renderers/primitives/gpu/WhirlGpuRenderer";
import { getPetalAuraGlContext } from "@ui/renderers/primitives/gpu/PetalAuraGpuRenderer";
import { disposeParticleRenderResources } from "@ui/renderers/primitives/gpu/ParticleEmitterGpuRenderer";
import { disposeFireRing } from "@ui/renderers/primitives/gpu/FireRingGpuRenderer";
import { disposeWhirlResources } from "@ui/renderers/primitives/gpu/WhirlGpuRenderer";
import { disposePetalAuraResources } from "@ui/renderers/primitives/gpu/PetalAuraGpuRenderer";
import { clearAllBulletBatches } from "@ui/renderers/primitives/gpu/BulletGpuRenderer";
import { clearRingInstances, disposeRingGpuRenderer } from "@ui/renderers/primitives/gpu/RingGpuRenderer";
import { resetAllArcBatches } from "@ui/renderers/primitives/gpu/ArcGpuRenderer";

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
      const gl2 = getWhirlGlContext?.();
      if (gl2) {
        try { whirlEffect.onContextLost(gl2); } catch {}
      }
      const gl3 = getPetalAuraGlContext?.();
      if (gl3) {
        try { petalAuraEffect.onContextLost(gl3); } catch {}
      }
      try { disposeWhirlResources(); } catch {}
      try { disposePetalAuraResources(); } catch {}
    } finally {
      try { setParticleEmitterGlContext(null); } catch {}
      try { setBulletGpuContext(null); } catch {}
      try { setBulletRenderBridge(null); } catch {}
      try { clearAllAuraSlots(); } catch {}
      try { clearPetalAuraInstances(); } catch {}
      try { clearAllBulletBatches(); } catch {}
      try { clearRingInstances(); } catch {}
      try { disposeRingGpuRenderer(); } catch {}
      try { resetAllArcBatches(); } catch {}
    }
  });

  const objectsRenderer = createObjectsRendererManager();

  setParticleEmitterGlContext(gl);
  
  if (initBullets) {
    setBulletGpuContext(gl);
    setBulletRenderBridge({
      acquireSlot: acquireBulletSlot,
      updateSlot: updateBulletSlot,
      releaseSlot: releaseBulletSlot,
      createConfig: createBulletVisualConfig,
    });
  }
  
  if (initRings) {
    initRingGpuRenderer(gl);
  }
  
  whirlEffect.onContextAcquired(gl);
  petalAuraEffect.onContextAcquired(gl);

  clearAllAuraSlots();
  clearPetalAuraInstances(gl);
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
      setBulletGpuContext(null);
      setBulletRenderBridge(null);
    }
    
    if (gl) {
      try {
        whirlEffect.onContextLost(gl);
      } catch {}
      try {
        petalAuraEffect.onContextLost(gl);
      } catch {}
      try {
        disposeParticleRenderResources(gl);
      } catch {}
      try {
        disposeFireRing(gl);
      } catch {}
    } else {
      const whirlContext = whirlEffect.getPrimaryContext();
      if (whirlContext) {
        try {
          whirlEffect.onContextLost(whirlContext);
        } catch {}
      }
      const auraContext = petalAuraEffect.getPrimaryContext();
      if (auraContext) {
        try {
          petalAuraEffect.onContextLost(auraContext);
        } catch {}
      }
    }
    
    // Dispose effect resources
    try {
      whirlEffect.dispose();
    } catch {}
    try {
      petalAuraEffect.dispose();
    } catch {}
    
    // Clear all instance data
    clearAllAuraSlots();
    clearPetalAuraInstances();
    
    if (initBullets) {
      clearAllBulletBatches();
    }
    
    if (initRings) {
      clearRingInstances();
      disposeRingGpuRenderer();
    }
    
    resetAllArcBatches();
  };

  return {
    gl,
    webglRenderer,
    objectsRenderer,
    cleanup,
  };
};
