import { MutableRefObject, useEffect, useRef } from "react";
import { SpellId } from "@db/spells-db";
import { SpellOption } from "@logic/modules/active-map/spellcasting/spellcasting.types";
import { SpellcastingModule } from "@logic/modules/active-map/spellcasting/spellcasting.module";
import {
  SceneCameraState,
  SceneVector2,
} from "@logic/services/scene-object-manager/scene-object-manager.types";
import { SceneObjectManager } from "@logic/services/scene-object-manager/SceneObjectManager";
import { GameLoop } from "@logic/services/game-loop/GameLoop";
import { updateAllWhirlInterpolations } from "@ui/renderers/objects";
import { renderArcBatches } from "@ui/renderers/primitives/gpu/ArcGpuRenderer";
import {
  petalAuraEffect,
} from "@ui/renderers/primitives/gpu/PetalAuraGpuRenderer";
import {
  getParticleStats,
  renderParticleEmitters,
} from "@ui/renderers/primitives/gpu/ParticleEmitterGpuRenderer";
import { whirlEffect } from "@ui/renderers/primitives/gpu/WhirlGpuRenderer";
import { renderFireRings } from "@ui/renderers/primitives/gpu/FireRingGpuRenderer";
import {
  uploadBulletBatches,
  renderBulletBatches,
  applyInterpolatedBulletPositions,
} from "@ui/renderers/primitives/gpu/BulletGpuRenderer";
import {
  renderRings,
} from "@ui/renderers/primitives/gpu/RingGpuRenderer";
import { usePositionInterpolation } from "./usePositionInterpolation";
import { setupWebGLScene } from "./useWebGLSceneSetup";
import { createWebGLRenderLoop } from "./useWebGLRenderLoop";

const EDGE_THRESHOLD = 48;
const CAMERA_SPEED = 400; // world units per second

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

interface PointerState {
  x: number;
  y: number;
  inside: boolean;
  isPressed: boolean;
  lastCastTime: number;
}

const applyCameraMovement = (
  pointer: Pick<PointerState, "x" | "y" | "inside">,
  scene: SceneObjectManager,
  deltaMs: number,
  canvasWidthPx: number,
  canvasHeightPx: number,
) => {
  if (!pointer.inside || deltaMs <= 0) {
    return;
  }
  const deltaSeconds = deltaMs / 1000;
  let moveX = 0;
  let moveY = 0;

  if (pointer.x < EDGE_THRESHOLD) {
    moveX -= CAMERA_SPEED * deltaSeconds;
  } else if (pointer.x > canvasWidthPx - EDGE_THRESHOLD) {
    moveX += CAMERA_SPEED * deltaSeconds;
  }

  if (pointer.y < EDGE_THRESHOLD) {
    moveY -= CAMERA_SPEED * deltaSeconds;
  } else if (pointer.y > canvasHeightPx - EDGE_THRESHOLD) {
    moveY += CAMERA_SPEED * deltaSeconds;
  }

  if (moveX !== 0 || moveY !== 0) {
    // Note: scene accessed via ref in render loop
    scene.panCamera(moveX, moveY);
  }
};

export interface BufferStats {
  bytes: number;
  reallocs: number;
}

export interface ParticleStatsState {
  active: number;
  capacity: number;
  emitters: number;
}

export interface UseSceneCanvasParams {
  scene: SceneObjectManager;
  spellcasting: SpellcastingModule;
  gameLoop: GameLoop;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  wrapperRef: MutableRefObject<HTMLDivElement | null>;
  summoningPanelRef: MutableRefObject<HTMLDivElement | null>;
  selectedSpellIdRef: MutableRefObject<SpellId | null>;
  spellOptionsRef: MutableRefObject<SpellOption[]>;
  pointerPressedRef: MutableRefObject<boolean>;
  lastPointerPositionRef: MutableRefObject<{ x: number; y: number } | null>;
  cameraInfoRef: MutableRefObject<SceneCameraState>;
  scaleRef: MutableRefObject<number>;
  setScale: (value: number) => void;
  setCameraInfo: (value: SceneCameraState) => void;
  setVboStats: (stats: BufferStats) => void;
  vboStatsRef: MutableRefObject<BufferStats>;
  setParticleStats: (stats: ParticleStatsState) => void;
  particleStatsRef: MutableRefObject<ParticleStatsState>;
  particleStatsLastUpdateRef: MutableRefObject<number>;
}

export const useSceneCanvas = ({
  scene,
  spellcasting,
  gameLoop,
  canvasRef,
  wrapperRef,
  summoningPanelRef,
  selectedSpellIdRef,
  spellOptionsRef,
  pointerPressedRef,
  lastPointerPositionRef,
  cameraInfoRef,
  scaleRef,
  setScale,
  setCameraInfo,
  setVboStats,
  vboStatsRef,
  setParticleStats,
  particleStatsRef,
  particleStatsLastUpdateRef,
}: UseSceneCanvasParams) => {
  // Use position interpolation hook
  const { getInterpolatedUnitPositions, getInterpolatedBulletPositions } = usePositionInterpolation(scene, gameLoop);

  // Store scene, spellcasting, and interpolation functions in refs to avoid recreating useEffect
  const sceneRef = useRef(scene);
  const spellcastingRef = useRef(spellcasting);
  const getInterpolatedUnitPositionsRef = useRef(getInterpolatedUnitPositions);
  const getInterpolatedBulletPositionsRef = useRef(getInterpolatedBulletPositions);
  
  useEffect(() => {
    sceneRef.current = scene;
    spellcastingRef.current = spellcasting;
    getInterpolatedUnitPositionsRef.current = getInterpolatedUnitPositions;
    getInterpolatedBulletPositionsRef.current = getInterpolatedBulletPositions;
  }, [scene, spellcasting, getInterpolatedUnitPositions, getInterpolatedBulletPositions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // Setup WebGL context and renderer
    const { gl, webglRenderer, objectsRenderer, cleanup: webglCleanup } = setupWebGLScene(canvas, sceneRef.current);

    const pointerState: PointerState = {
      x: 0,
      y: 0,
      inside: false,
      isPressed: false,
      lastCastTime: 0,
    };

    const updatePointerPressed = (pressed: boolean) => {
      pointerState.isPressed = pressed;
      pointerPressedRef.current = pressed;
    };

    const updateLastPointerPosition = (x: number, y: number) => {
      pointerState.x = x;
      pointerState.y = y;
      lastPointerPositionRef.current = { x, y };
    };

    const applySync = () => {
      webglRenderer.syncBuffers();
    };

    const initialChanges = sceneRef.current.flushChanges();
    webglRenderer.getObjectsRenderer().applyChanges(initialChanges);
    applySync();

    const applyPendingVisibilityCleanup = () => {
      const removedIds = sceneRef.current.flushAllPendingRemovals();
      const changes = sceneRef.current.flushChanges();

      // Об'єднуємо всі видалення (від flushAllPendingRemovals та звичайні зміни)
      const allRemoved = [...removedIds, ...changes.removed];

      // Застосовуємо всі зміни, включаючи видалення
      webglRenderer.getObjectsRenderer().applyChanges({
        added: changes.added,
        updated: changes.updated,
        removed: allRemoved
      });

      // Оновлюємо буфери WebGL
      applySync();

      // Додатково очищаємо будь-які залишки змін після очищення
      const remainingChanges = sceneRef.current.flushChanges();
      if (remainingChanges.added.length > 0 ||
          remainingChanges.updated.length > 0 ||
          remainingChanges.removed.length > 0) {
        webglRenderer.getObjectsRenderer().applyChanges(remainingChanges);
        applySync();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        applyPendingVisibilityCleanup();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    let previousTime: number | null = null;

    // Create render loop with shared logic
    const renderLoop = createWebGLRenderLoop({
      webglRenderer,
      scene: sceneRef.current,
      gl,
      beforeUpdate: (timestamp) => {
        if (previousTime === null) {
          previousTime = timestamp;
        }
        const deltaMs = Math.min(timestamp - previousTime, 100);
        previousTime = timestamp;

        applyCameraMovement(
          pointerState,
          sceneRef.current,
          deltaMs,
          canvas.width,
          canvas.height,
        );
      },
      afterApplyChanges: (timestamp, scene, cameraState) => {
        // Apply interpolated unit positions
        const interpolatedUnitPositions = getInterpolatedUnitPositionsRef.current();
        if (interpolatedUnitPositions.size > 0) {
          webglRenderer.getObjectsRenderer().applyInterpolatedPositions(interpolatedUnitPositions);
        }
      },

      afterUpdate: (timestamp, scene, cameraState) => {
        // Update VBO stats
        const dbs = webglRenderer.getObjectsRenderer().getDynamicBufferStats();
        if (
          dbs.bytesAllocated !== vboStatsRef.current.bytes ||
          dbs.reallocations !== vboStatsRef.current.reallocs
        ) {
          vboStatsRef.current = {
            bytes: dbs.bytesAllocated,
            reallocs: dbs.reallocations,
          };
          setVboStats({ bytes: dbs.bytesAllocated, reallocs: dbs.reallocations });
        }
      },
      beforeEffects: (timestamp, gl, cameraState) => {
        // Render additional effects (particles, whirls, auras, arcs, fire rings, bullets, rings)
        renderParticleEmitters(
          gl,
          cameraState.position,
          cameraState.viewportSize,
        );
        updateAllWhirlInterpolations();
        whirlEffect.beforeRender(gl, timestamp);
        petalAuraEffect.beforeRender(gl, timestamp);
        whirlEffect.render(
          gl,
          cameraState.position,
          cameraState.viewportSize,
          timestamp,
        );
        petalAuraEffect.render(
          gl,
          cameraState.position,
          cameraState.viewportSize,
          timestamp,
        );
        renderArcBatches(
          gl,
          cameraState.position,
          cameraState.viewportSize,
        );
        renderFireRings(
          gl,
          cameraState.position,
          cameraState.viewportSize,
          timestamp,
        );
        // GPU instanced bullets with interpolation
        const interpolatedBulletPositions = getInterpolatedBulletPositionsRef.current();
        if (interpolatedBulletPositions.size > 0) {
          applyInterpolatedBulletPositions(interpolatedBulletPositions);
        }
        uploadBulletBatches();
        renderBulletBatches(cameraState.position, cameraState.viewportSize);
        // GPU instanced rings (ring trails)
        renderRings(
          cameraState.position,
          { x: cameraState.viewportSize.width, y: cameraState.viewportSize.height },
          timestamp
        );
      },
      afterRender: (timestamp, gl, cameraState) => {
        // Update particle stats
        const stats = getParticleStats(gl);
        const now = timestamp;
        if (now - particleStatsLastUpdateRef.current >= 500) {
          particleStatsLastUpdateRef.current = now;
          if (
            stats.active !== particleStatsRef.current.active ||
            stats.capacity !== particleStatsRef.current.capacity ||
            stats.emitters !== particleStatsRef.current.emitters
          ) {
            particleStatsRef.current = stats;
            setParticleStats(stats);
          }
        } else {
          particleStatsRef.current = stats;
        }

        // Update camera/scale state
        const latestCamera = sceneRef.current.getCamera();
        if (
          Math.abs(latestCamera.scale - scaleRef.current) > 0.0001
        ) {
          scaleRef.current = latestCamera.scale;
          setScale(latestCamera.scale);
        }
        if (
          Math.abs(latestCamera.position.x - cameraInfoRef.current.position.x) >
            0.0001 ||
          Math.abs(latestCamera.position.y - cameraInfoRef.current.position.y) >
            0.0001 ||
          Math.abs(latestCamera.viewportSize.width - cameraInfoRef.current.viewportSize.width) >
            0.0001 ||
          Math.abs(latestCamera.viewportSize.height - cameraInfoRef.current.viewportSize.height) >
            0.0001
        ) {
          cameraInfoRef.current = latestCamera;
          setCameraInfo(latestCamera);
        }
      },
    });

    const resize = () => {
      const wrapper = wrapperRef.current ?? canvas.parentElement;
      if (!wrapper) {
        return;
      }
      const targetWidth = Math.max(1, wrapper.clientWidth);
      const targetHeight = Math.max(1, wrapper.clientHeight);
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${targetWidth}px`;
      canvas.style.height = `${targetHeight}px`;
      canvas.width = Math.max(1, Math.round(targetWidth * dpr));
      canvas.height = Math.max(1, Math.round(targetHeight * dpr));

      
      gl.viewport(0, 0, canvas.width, canvas.height);
      sceneRef.current.setViewportScreenSize(canvas.width, canvas.height);
      const currentMapSize = sceneRef.current.getMapSize();
      sceneRef.current.setMapSize({
        width: Math.max(currentMapSize.width, canvas.width, 1000),
        height: Math.max(currentMapSize.height + 150, canvas.height, 1000),
      });
      const current = sceneRef.current.getCamera();
      scaleRef.current = current.scale;
      cameraInfoRef.current = current;
      setScale(current.scale);
      setCameraInfo(current);
    };

    resize();
    renderLoop.start();
    window.addEventListener("resize", resize);

    const getWorldPosition = (event: PointerEvent): SceneVector2 | null => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return null;
      }
      const rawX = (event.clientX - rect.left) / rect.width;
      const rawY = (event.clientY - rect.top) / rect.height;
      if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
        return null;
      }
      const cameraState = sceneRef.current.getCamera();
      const normalizedX = clamp(rawX, 0, 1);
      const normalizedY = clamp(rawY, 0, 1);
      return {
        x:
          cameraState.position.x +
          normalizedX * cameraState.viewportSize.width,
        y:
          cameraState.position.y +
          normalizedY * cameraState.viewportSize.height,
      };
    };

    const getOverlayHeight = () => {
      const panel = summoningPanelRef.current;
      if (!panel) {
        return 0;
      }
      return panel.getBoundingClientRect().height;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        pointerState.inside = false;
        return;
      }

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const clampedX = clamp(x, 0, rect.width);
      const clampedY = clamp(y, 0, rect.height);
      const canvasX = (clampedX / rect.width) * canvas.width;
      const canvasY = (clampedY / rect.height) * canvas.height;
      updateLastPointerPosition(canvasX, canvasY);

      const overlayHeight = getOverlayHeight();
      const insideHorizontal =
        event.clientX >= rect.left && event.clientX <= rect.right;
      const insideVertical =
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom + overlayHeight;
      pointerState.inside = insideHorizontal && insideVertical;
    };

    const handlePointerLeave = () => {
      pointerState.inside = false;
      updatePointerPressed(false);
      lastPointerPositionRef.current = null;
    };

    const tryCastSpellAtPosition = (event: PointerEvent) => {
      const spellId = selectedSpellIdRef.current;
      if (!spellId) {
        return;
      }
      const spell = spellOptionsRef.current.find((option) => option.id === spellId);
      if (!spell || spell.remainingCooldownMs > 0) {
        return;
      }
      const now = Date.now();
      if (now - pointerState.lastCastTime < 16) {
        return;
      }
      const worldPosition = getWorldPosition(event);
      if (!worldPosition) {
        return;
      }
      spellcastingRef.current.tryCastSpell(spellId, worldPosition);
      pointerState.lastCastTime = now;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const clampedX = clamp(x, 0, rect.width);
        const clampedY = clamp(y, 0, rect.height);
        const canvasX = (clampedX / rect.width) * canvas.width;
        const canvasY = (clampedY / rect.height) * canvas.height;
        updateLastPointerPosition(canvasX, canvasY);
      }
      updatePointerPressed(true);
      tryCastSpellAtPosition(event);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      updatePointerPressed(false);
    };

    const handlePointerMoveWithCast = (event: PointerEvent) => {
      handlePointerMove(event);
      if (pointerState.isPressed && pointerState.inside) {
        const spellId = selectedSpellIdRef.current;
        if (spellId) {
          const spell = spellOptionsRef.current.find(
            (option) => option.id === spellId,
          );
          if (spell && spell.remainingCooldownMs <= 0) {
            tryCastSpellAtPosition(event);
          }
        }
      }
    };

    window.addEventListener("pointermove", handlePointerMoveWithCast, {
      passive: true,
    });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("pointerout", handlePointerLeave, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    canvas.addEventListener("pointerdown", handlePointerDown);

    return () => {
      // Stop render loop
      renderLoop.stop();
      // Cleanup WebGL resources (includes resetAllArcBatches)
      webglCleanup();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pointermove", handlePointerMoveWithCast);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("pointerout", handlePointerLeave);
      window.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [
    // Refs are stable and don't need to be in dependencies
    // scene/spellcasting/interpolation functions accessed via refs to avoid recreating useEffect
    // Only include setState functions (they're stable) and canvasRef for initial mount
    canvasRef,
    setScale,
    setCameraInfo,
    setVboStats,
    setParticleStats,
  ]);
};
