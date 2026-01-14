import { MutableRefObject, useEffect, useRef } from "react";
import { SpellId } from "@db/spells-db";
import { SpellOption } from "@logic/modules/active-map/spellcasting/spellcasting.types";
import type { SpellcastingModuleUiApi } from "@logic/modules/active-map/spellcasting/spellcasting.types";
import {
  SceneCameraState,
  SceneVector2,
  SceneUiApi,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { GameLoopUiApi } from "@core/logic/provided/services/game-loop/game-loop.types";
import { updateAllWhirlInterpolations } from "@ui/renderers/objects";
import { arcGpuRenderer } from "@ui/renderers/primitives/gpu/arc";
import {
  petalAuraGpuRenderer,
} from "@ui/renderers/primitives/gpu/petal-aura";
import {
  particleEmitterGpuRenderer,
} from "@ui/renderers/primitives/gpu/particle-emitter";
import { explosionWaveGpuRenderer } from "@ui/renderers/primitives/gpu/explosion-wave";
import { whirlGpuRenderer } from "@ui/renderers/primitives/gpu/whirl";
import { renderFireRings } from "@ui/renderers/primitives/gpu/fire-ring";
import {
  bulletGpuRenderer,
  applyInterpolatedBulletPositions,
} from "@ui/renderers/primitives/gpu/bullet";
import { ringGpuRenderer } from "@ui/renderers/primitives/gpu/ring";
import { clamp } from "@shared/helpers/numbers.helper";
import { usePositionInterpolation } from "./usePositionInterpolation";
import { setupWebGLScene } from "./useWebGLSceneSetup";
import { createWebGLRenderLoop } from "./useWebGLRenderLoop";
import {
  updateVboStats,
  updateParticleStats,
  updateMovableStats,
  tickFrame,
} from "../components/debug/debugStats";

const EDGE_THRESHOLD = 48;
const CAMERA_SPEED = 400; // world units per second

interface PointerState {
  x: number;
  y: number;
  inside: boolean;
  isPressed: boolean;
  isRightMousePressed: boolean;
  lastCastTime: number;
}

// applyCameraMovement will be defined inside useEffect to access rightMouseLastPositionRef

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
  scene: SceneUiApi;
  spellcasting: SpellcastingModuleUiApi;
  gameLoop: GameLoopUiApi;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  wrapperRef: MutableRefObject<HTMLDivElement | null>;
  summoningPanelRef: MutableRefObject<HTMLDivElement | null>;
  selectedSpellIdRef: MutableRefObject<SpellId | null>;
  spellOptionsRef: MutableRefObject<SpellOption[]>;
  pointerPressedRef: MutableRefObject<boolean>;
  lastPointerPositionRef: MutableRefObject<{ x: number; y: number } | null>;
  cameraInfoRef: MutableRefObject<SceneCameraState>;
  scaleRef: MutableRefObject<number>;
  onCameraUiChange: (value: {
    scale?: number;
    cameraInfo?: SceneCameraState;
    scaleRange?: { min: number; max: number };
  }) => void;
  vboStatsRef: MutableRefObject<BufferStats>;
  particleStatsRef: MutableRefObject<ParticleStatsState>;
  particleStatsLastUpdateRef: MutableRefObject<number>;
  hasInitializedScaleRef: MutableRefObject<boolean>;
  onSpellCast?: (spellId: SpellId) => void;
  onInspectTarget?: (position: SceneVector2) => void;
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
  onCameraUiChange,
  vboStatsRef,
  particleStatsRef,
  particleStatsLastUpdateRef,
  hasInitializedScaleRef,
  onSpellCast,
  onInspectTarget,
}: UseSceneCanvasParams) => {
  // Use position interpolation hook
  const { getInterpolatedUnitPositions, getInterpolatedBulletPositions, getInterpolatedBrickPositions, getInterpolatedEnemyPositions } = usePositionInterpolation(scene, gameLoop);

  // Store scene, spellcasting, callbacks, and interpolation functions in refs to avoid recreating useEffect
  const sceneRef = useRef(scene);
  const spellcastingRef = useRef(spellcasting);
  const onSpellCastRef = useRef(onSpellCast);
  const onInspectTargetRef = useRef(onInspectTarget);
  const getInterpolatedUnitPositionsRef = useRef(getInterpolatedUnitPositions);
  const getInterpolatedBulletPositionsRef = useRef(getInterpolatedBulletPositions);
  const getInterpolatedBrickPositionsRef = useRef(getInterpolatedBrickPositions);
  const getInterpolatedEnemyPositionsRef = useRef(getInterpolatedEnemyPositions);
  const movableStatsLastUpdateRef = useRef(0);
  // Separate ref for right mouse panning to track previous position
  const rightMouseLastPositionRef = useRef<{ x: number; y: number } | null>(null);
  const rightMouseDownPositionRef = useRef<{ x: number; y: number } | null>(null);
  
  useEffect(() => {
    sceneRef.current = scene;
    spellcastingRef.current = spellcasting;
    onSpellCastRef.current = onSpellCast;
    onInspectTargetRef.current = onInspectTarget;
    getInterpolatedUnitPositionsRef.current = getInterpolatedUnitPositions;
    getInterpolatedBulletPositionsRef.current = getInterpolatedBulletPositions;
    getInterpolatedBrickPositionsRef.current = getInterpolatedBrickPositions;
    getInterpolatedEnemyPositionsRef.current = getInterpolatedEnemyPositions;
  }, [scene, spellcasting, onSpellCast, onInspectTarget, getInterpolatedUnitPositions, getInterpolatedBulletPositions, getInterpolatedBrickPositions, getInterpolatedEnemyPositions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // Setup WebGL context and renderer
    const { gl, webglRenderer, objectsRenderer, cleanup: webglCleanup } = setupWebGLScene(canvas, sceneRef.current);
    updateMovableStats(sceneRef.current.getMovableObjectCount());

    const pointerState: PointerState = {
      x: 0,
      y: 0,
      inside: false,
      isPressed: false,
      isRightMousePressed: false,
      lastCastTime: 0,
    };

    const updatePointerPressed = (pressed: boolean) => {
      pointerState.isPressed = pressed;
      pointerPressedRef.current = pressed;
    };

    const updateRightMousePressed = (pressed: boolean) => {
      pointerState.isRightMousePressed = pressed;
    };

    const applyCameraMovement = (
      pointer: Pick<PointerState, "x" | "y" | "inside" | "isRightMousePressed">,
      scene: SceneUiApi,
      deltaMs: number,
      canvasWidthPx: number,
      canvasHeightPx: number,
    ) => {
      if (deltaMs <= 0) {
        return;
      }
      const deltaSeconds = deltaMs / 1000;
      let moveX = 0;
      let moveY = 0;

      // Right mouse button panning: move camera based on mouse movement
      if (pointer.isRightMousePressed && rightMouseLastPositionRef.current) {
        const deltaX = pointer.x - rightMouseLastPositionRef.current.x;
        const deltaY = pointer.y - rightMouseLastPositionRef.current.y;
        // Only move if there's actual movement
        if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
          // Convert pixel movement to world units (inverse of scale)
          const cameraState = scene.getCamera();
          const worldDeltaX = -(deltaX / canvasWidthPx) * cameraState.viewportSize.width;
          const worldDeltaY = -(deltaY / canvasHeightPx) * cameraState.viewportSize.height;
          moveX = worldDeltaX;
          moveY = worldDeltaY;
          // Update last position after using it
          rightMouseLastPositionRef.current = { x: pointer.x, y: pointer.y };
        }
      } else if (pointer.inside) {
        // Edge panning: move camera when mouse is near screen edges
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
      }

      if (moveX !== 0 || moveY !== 0) {
        // Note: scene accessed via ref in render loop
        scene.panCamera(moveX, moveY);
      }
    };

    const updateLastPointerPosition = (x: number, y: number) => {
      pointerState.x = x;
      pointerState.y = y;
      lastPointerPositionRef.current = { x, y };
      // Don't update rightMouseLastPositionRef here - it's updated in applyCameraMovement after use
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
      updateMovableStats(sceneRef.current.getMovableObjectCount());

      // Додатково очищаємо будь-які залишки змін після очищення
      const remainingChanges = sceneRef.current.flushChanges();
      if (remainingChanges.added.length > 0 ||
          remainingChanges.updated.length > 0 ||
          remainingChanges.removed.length > 0) {
        webglRenderer.getObjectsRenderer().applyChanges(remainingChanges);
        applySync();
        updateMovableStats(sceneRef.current.getMovableObjectCount());
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
        const objectsRenderer = webglRenderer.getObjectsRenderer();
        const interpolatedBulletPositions = getInterpolatedBulletPositionsRef.current();

        // Apply interpolated unit positions
        const interpolatedUnitPositions = getInterpolatedUnitPositionsRef.current();
        if (interpolatedUnitPositions.size > 0) {
          objectsRenderer.applyInterpolatedPositions(interpolatedUnitPositions);
          
          // Also update objects tied to interpolated units (e.g., auras)
          const tiedPositions = new Map<string, { x: number; y: number }>();
          interpolatedUnitPositions.forEach((pos, unitId) => {
            const tiedChildren = objectsRenderer.getTiedChildren(unitId);
            if (tiedChildren) {
              tiedChildren.forEach((childId) => {
                tiedPositions.set(childId, pos);
              });
            }
          });
          if (tiedPositions.size > 0) {
            objectsRenderer.applyInterpolatedPositions(tiedPositions);
          }
        }
        // Apply interpolated brick positions
        const interpolatedBrickPositions = getInterpolatedBrickPositionsRef.current();
        if (interpolatedBrickPositions.size > 0) {
          objectsRenderer.applyInterpolatedPositions(interpolatedBrickPositions);
        }
        // Apply interpolated enemy positions
        const interpolatedEnemyPositions = getInterpolatedEnemyPositionsRef.current();
        if (interpolatedEnemyPositions.size > 0) {
          objectsRenderer.applyInterpolatedPositions(interpolatedEnemyPositions);
        }
        // Apply interpolated bullet positions for emitter spawn origins
        if (interpolatedBulletPositions.size > 0) {
          objectsRenderer.applyInterpolatedBulletPositions(interpolatedBulletPositions);
        }
      },

      afterUpdate: (timestamp, scene, cameraState) => {
        const now = timestamp;
        if (now - movableStatsLastUpdateRef.current >= 250) {
          movableStatsLastUpdateRef.current = now;
          updateMovableStats(sceneRef.current.getMovableObjectCount());
        }
        // Update VBO stats (write to global object, no React re-render)
        const dbs = webglRenderer.getObjectsRenderer().getDynamicBufferStats();
        if (
          dbs.bytesAllocated !== vboStatsRef.current.bytes ||
          dbs.reallocations !== vboStatsRef.current.reallocs
        ) {
          vboStatsRef.current = {
            bytes: dbs.bytesAllocated,
            reallocs: dbs.reallocations,
          };
          updateVboStats(dbs.bytesAllocated, dbs.reallocations);
        }
      },
      beforeEffects: (timestamp, gl, cameraState) => {
        // Render additional effects (particles, whirls, auras, arcs, fire rings, bullets, rings)
        // Explosion waves - rendered separately (not via ParticleEmitter system)
        explosionWaveGpuRenderer.beforeRender(gl, timestamp);
        explosionWaveGpuRenderer.render(gl, cameraState.position, cameraState.viewportSize, timestamp);
        // Particle emitters (particles, not waves)
        particleEmitterGpuRenderer.beforeRender(gl, timestamp);
        particleEmitterGpuRenderer.render(
          gl,
          cameraState.position,
          cameraState.viewportSize,
          timestamp,
        );
        updateAllWhirlInterpolations();
        whirlGpuRenderer.beforeRender(gl, timestamp);
        petalAuraGpuRenderer.beforeRender(gl, timestamp);
        whirlGpuRenderer.render(gl, cameraState.position, cameraState.viewportSize, timestamp);
        petalAuraGpuRenderer.render(
          gl,
          cameraState.position,
          cameraState.viewportSize,
          timestamp,
        );
        arcGpuRenderer.beforeRender(gl, timestamp);
        arcGpuRenderer.render(gl, cameraState.position, cameraState.viewportSize, timestamp);
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
        bulletGpuRenderer.beforeRender(gl, timestamp);
        bulletGpuRenderer.render(gl, cameraState.position, cameraState.viewportSize, timestamp);
        // GPU instanced rings (ring trails)
        ringGpuRenderer.beforeRender(gl, timestamp);
        ringGpuRenderer.render(gl, cameraState.position, cameraState.viewportSize, timestamp);
      },
      afterRender: (timestamp, gl, cameraState) => {
        // Tick FPS counter (no separate rAF needed)
        tickFrame();

        // Update particle stats (write to global object, no React re-render)
        const stats = particleEmitterGpuRenderer.getStats(gl);
        const now = timestamp;
        if (now - particleStatsLastUpdateRef.current >= 500) {
          particleStatsLastUpdateRef.current = now;
          if (
            stats.active !== particleStatsRef.current.active ||
            stats.capacity !== particleStatsRef.current.capacity ||
            stats.emitters !== particleStatsRef.current.emitters
          ) {
            particleStatsRef.current = stats;
            updateParticleStats(stats.active, stats.capacity, stats.emitters);
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
          onCameraUiChange({ scale: latestCamera.scale });
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
          onCameraUiChange({ cameraInfo: latestCamera });
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
      // Don't modify map size here - it should be set by MapRunLifecycle.startRun()
      // which uses the map config's size. Modifying it here causes minScale to change
      // on every resize/restart.
      const current = sceneRef.current.getCamera();
      scaleRef.current = current.scale;
      cameraInfoRef.current = current;
      onCameraUiChange({ scale: current.scale, cameraInfo: current });
      
      // Update scale range after viewport changes
      const newScaleRange = sceneRef.current.getScaleRange();
      onCameraUiChange({ scaleRange: newScaleRange });
      
      // Mark scale as initialized after first resize
      // This ensures scale is set AFTER minScale is properly calculated
      hasInitializedScaleRef.current = true;
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

    const getCanvasPosition = (event: PointerEvent): { x: number; y: number } | null => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return null;
      }
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const clampedX = clamp(x, 0, rect.width);
      const clampedY = clamp(y, 0, rect.height);
      return {
        x: (clampedX / rect.width) * canvas.width,
        y: (clampedY / rect.height) * canvas.height,
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
        // Still update position for right mouse panning even if canvas is invalid
        if (pointerState.isRightMousePressed) {
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const canvasX = (x / Math.max(rect.width, 1)) * canvas.width;
          const canvasY = (y / Math.max(rect.height, 1)) * canvas.height;
          updateLastPointerPosition(canvasX, canvasY);
        }
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
      updateRightMousePressed(false);
      rightMouseLastPositionRef.current = null;
      rightMouseDownPositionRef.current = null;
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
      const castSuccess = spellcastingRef.current.tryCastSpell(spellId, worldPosition);
      console.log('[useSceneCanvas] tryCastSpell result:', { spellId, castSuccess, hasCallback: !!onSpellCastRef.current });
      if (castSuccess) {
        onSpellCastRef.current?.(spellId);
      }
      pointerState.lastCastTime = now;
    };

    const handlePointerDown = (event: PointerEvent) => {
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

      if (event.button === 0) {
        // Left mouse button - spell casting
        updatePointerPressed(true);
        tryCastSpellAtPosition(event);
      } else if (event.button === 2) {
        // Right mouse button - camera panning
        event.preventDefault(); // Prevent context menu
        updateRightMousePressed(true);
        rightMouseDownPositionRef.current = getCanvasPosition(event);
        // Initialize right mouse position for panning
        if (rect.width > 0 && rect.height > 0) {
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const clampedX = clamp(x, 0, rect.width);
          const clampedY = clamp(y, 0, rect.height);
          const canvasX = (clampedX / rect.width) * canvas.width;
          const canvasY = (clampedY / rect.height) * canvas.height;
          rightMouseLastPositionRef.current = { x: canvasX, y: canvasY };
        }
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button === 0) {
        // Left mouse button
        updatePointerPressed(false);
      } else if (event.button === 2) {
        // Right mouse button
        updateRightMousePressed(false);
        rightMouseLastPositionRef.current = null;
        const downPosition = rightMouseDownPositionRef.current;
        const currentPosition = getCanvasPosition(event);
        rightMouseDownPositionRef.current = null;
        if (!downPosition || !currentPosition || !onInspectTargetRef.current) {
          return;
        }
        const deltaX = currentPosition.x - downPosition.x;
        const deltaY = currentPosition.y - downPosition.y;
        const travelDistance = Math.hypot(deltaX, deltaY);
        if (travelDistance > 6) {
          return;
        }
        const worldPosition = getWorldPosition(event);
        if (!worldPosition) {
          return;
        }
        onInspectTargetRef.current(worldPosition);
      }
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

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const currentCamera = sceneRef.current.getCamera();
      const scaleRange = sceneRef.current.getScaleRange();
      
      // Zoom factor: negative deltaY = zoom in, positive = zoom out
      const zoomFactor = Math.exp(-event.deltaY * 0.001);
      const proposedScale = currentCamera.scale * zoomFactor;
      
      // Clamp to valid range
      const nextScale = clamp(proposedScale, scaleRange.min, scaleRange.max);
      
      if (Math.abs(nextScale - currentCamera.scale) > 0.0001) {
        sceneRef.current.setScale(nextScale);
        const updatedCamera = sceneRef.current.getCamera();
        scaleRef.current = updatedCamera.scale;
        cameraInfoRef.current = updatedCamera;
        onCameraUiChange({ scale: updatedCamera.scale, cameraInfo: updatedCamera });
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      // Prevent context menu on right click
      event.preventDefault();
    };

    const handleSelectStart = (event: Event) => {
      // Prevent text selection
      event.preventDefault();
    };

    window.addEventListener("pointermove", handlePointerMoveWithCast, {
      passive: true,
    });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("pointerout", handlePointerLeave, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("contextmenu", handleContextMenu);
    canvas.addEventListener("selectstart", handleSelectStart);

    return () => {
      // Stop render loop
      renderLoop.stop();
      // Cleanup WebGL resources
      webglCleanup();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pointermove", handlePointerMoveWithCast);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("pointerout", handlePointerLeave);
      window.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("contextmenu", handleContextMenu);
      canvas.removeEventListener("selectstart", handleSelectStart);
    };
  }, [
    // Refs are stable and don't need to be in dependencies
    // scene/spellcasting/interpolation functions accessed via refs to avoid recreating useEffect
    // Only include setState functions (they're stable) and canvasRef for initial mount
    canvasRef,
    onCameraUiChange,
  ]);
};
