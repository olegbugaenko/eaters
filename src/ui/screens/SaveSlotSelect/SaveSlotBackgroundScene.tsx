import { useEffect, useRef } from "react";
import { SceneObjectManager } from "@/logic/services/scene-object-manager/SceneObjectManager";
import { petalAuraGpuRenderer } from "@ui/renderers/primitives/gpu/petal-aura";
import { updateAllWhirlInterpolations } from "@ui/renderers/objects";
import { particleEmitterGpuRenderer } from "@ui/renderers/primitives/gpu/particle-emitter";
import { arcGpuRenderer } from "@ui/renderers/primitives/gpu/arc";
import { renderFireRings } from "@ui/renderers/primitives/gpu/fire-ring";
import { setupWebGLScene } from "@ui/screens/Scene/hooks/useWebGLSceneSetup";
import { createWebGLRenderLoop } from "@ui/screens/Scene/hooks/useWebGLRenderLoop";
import { whirlGpuRenderer } from "@ui/renderers/primitives/gpu/whirl";
import {
  MAP_SIZE,
  TITLE_LINES,
  CONTENT_PADDING,
} from "./save-slot-scene-config";
import {
  computeTitleLayout,
  createArchLayout,
  mergeBounds,
  computeSceneContentBounds,
  centerCameraOnBounds,
  createCreatures,
  updateCreatures,
  type CreatureState,
} from "./save-slot-scene-layout";

export const SaveSlotBackgroundScene: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const wrapper = canvas.parentElement as HTMLElement | null;
    
    const scene = new SceneObjectManager();
    scene.setMapSize(MAP_SIZE);

    const titleLayout = computeTitleLayout(
      TITLE_LINES,
      MAP_SIZE.width,
      MAP_SIZE.height
    );

    const archLayout = createArchLayout(titleLayout.bounds);

    [...titleLayout.bricks, ...archLayout.bricks].forEach((brick) => {
      scene.addObject("brick", {
        position: brick.position,
        size: brick.size,
        fill: brick.fill,
        stroke: brick.stroke,
        rotation: brick.rotation ?? 0,
      });
    });

    const creatures = createCreatures(scene, titleLayout);
    const contentBounds = computeSceneContentBounds(
      mergeBounds(titleLayout.bounds, archLayout.bounds),
      creatures,
      500, // paddingX
      CONTENT_PADDING // paddingY
    );

    // Setup WebGL context and renderer (without bullets/rings - not needed for background scene)
    const { gl, webglRenderer, cleanup: webglCleanup } = setupWebGLScene(
      canvas,
      scene,
      { initBullets: false, initRings: false }
    );

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = wrapper?.clientWidth ?? window.innerWidth;
      const targetHeight = wrapper?.clientHeight ?? window.innerHeight;
      const width = Math.max(1, Math.round(targetWidth * dpr));
      const height = Math.max(1, Math.round(targetHeight * dpr));
      canvas.style.width = `${targetWidth}px`;
      canvas.style.height = `${targetHeight}px`;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      scene.setViewportScreenSize(width, height);
      const safeContentWidth = Math.max(contentBounds.width, 1);
      const safeContentHeight = Math.max(contentBounds.height, 1);
      const scale = Math.min(1, width / safeContentWidth, height / safeContentHeight);
      scene.setScale(scale);
      centerCameraOnBounds(scene, contentBounds);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const initialChanges = scene.flushChanges();
    webglRenderer.getObjectsRenderer().applyChanges(initialChanges);
    webglRenderer.syncBuffers();

    // Create render loop with shared logic
    const renderLoop = createWebGLRenderLoop({
      webglRenderer,
      scene,
      gl,
      beforeUpdate: (timestamp) => {
        updateCreatures(scene, creatures, timestamp);
      },
      beforeEffects: (timestamp, gl, cameraState) => {
        // Render additional effects (particles, whirls, auras, arcs, fire rings)
        particleEmitterGpuRenderer.beforeRender(gl, timestamp);
        particleEmitterGpuRenderer.render(gl, cameraState.position, cameraState.viewportSize, timestamp);
        updateAllWhirlInterpolations();
        whirlGpuRenderer.beforeRender(gl, timestamp);
        petalAuraGpuRenderer.beforeRender(gl, timestamp);
        whirlGpuRenderer.render(gl, cameraState.position, cameraState.viewportSize, timestamp);
        petalAuraGpuRenderer.render(gl, cameraState.position, cameraState.viewportSize, timestamp);
        arcGpuRenderer.beforeRender(gl, timestamp);
        arcGpuRenderer.render(gl, cameraState.position, cameraState.viewportSize, timestamp);
        renderFireRings(gl, cameraState.position, cameraState.viewportSize, timestamp);
      },
    });

    renderLoop.start();

    return () => {
      renderLoop.stop();
      window.removeEventListener("resize", handleResize);
      // Cleanup WebGL resources (includes all GPU effects cleanup)
      webglCleanup();
    };
  }, []);

  return <canvas ref={canvasRef} className="save-slot-background__canvas" />;
};
