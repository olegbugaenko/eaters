import { useEffect, useRef } from "react";
import { SceneObjectManager } from "@/logic/services/scene-object-manager/SceneObjectManager";
import { setSceneTimelineTimeMs } from "@ui/renderers/primitives/utils/sceneTimeline";
import { petalAuraEffect } from "@ui/renderers/primitives/gpu/PetalAuraGpuRenderer";
import { updateAllWhirlInterpolations } from "@ui/renderers/objects/SandStormRenderer";
import { renderParticleEmitters } from "@ui/renderers/primitives/gpu/ParticleEmitterGpuRenderer";
import { renderArcBatches } from "@ui/renderers/primitives/gpu/ArcGpuRenderer";
import { renderFireRings } from "@ui/renderers/primitives/gpu/FireRingGpuRenderer";
import { setupWebGLScene } from "@ui/screens/Scene/hooks/useWebGLSceneSetup";
import { whirlEffect } from "@ui/renderers/primitives/gpu/WhirlGpuRenderer";
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

    let frame = 0;
    const render = (timestamp: number) => {
      setSceneTimelineTimeMs(timestamp);
      updateCreatures(scene, creatures, timestamp);
      const cameraState = scene.getCamera();
      const changes = scene.flushChanges();
      webglRenderer.getObjectsRenderer().applyChanges(changes);
      webglRenderer.syncBuffers();

      // Render base scene (static + dynamic buffers)
      webglRenderer.render(cameraState);

      // Render additional effects (particles, whirls, auras, arcs, fire rings)
      renderParticleEmitters(webglRenderer.getGl(), cameraState.position, cameraState.viewportSize);
      updateAllWhirlInterpolations();
      whirlEffect.beforeRender(webglRenderer.getGl(), timestamp);
      petalAuraEffect.beforeRender(webglRenderer.getGl(), timestamp);
      whirlEffect.render(webglRenderer.getGl(), cameraState.position, cameraState.viewportSize, timestamp);
      petalAuraEffect.render(webglRenderer.getGl(), cameraState.position, cameraState.viewportSize, timestamp);
      renderArcBatches(webglRenderer.getGl(), cameraState.position, cameraState.viewportSize);
      renderFireRings(webglRenderer.getGl(), cameraState.position, cameraState.viewportSize, timestamp);

      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      // Cleanup WebGL resources (includes all GPU effects cleanup)
      webglCleanup();
    };
  }, []);

  return <canvas ref={canvasRef} className="save-slot-background__canvas" />;
};
