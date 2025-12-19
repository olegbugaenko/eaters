import { MutableRefObject, useEffect } from "react";
import { SpellId } from "@db/spells-db";
import { SpellOption, SpellcastingModule } from "@logic/modules/active-map/spells/SpellcastingModule";
import {
  SceneCameraState,
  SceneObjectManager,
  SceneVector2,
} from "@logic/services/SceneObjectManager";
import {
  POSITION_COMPONENTS,
  VERTEX_COMPONENTS,
  FILL_INFO_COMPONENTS,
  FILL_PARAMS0_COMPONENTS,
  FILL_PARAMS1_COMPONENTS,
  FILL_FILAMENTS0_COMPONENTS,
  FILL_FILAMENTS1_COMPONENTS,
  STOP_OFFSETS_COMPONENTS,
  STOP_COLOR_COMPONENTS,
  createObjectsRendererManager,
} from "@ui/renderers/objects";
import { clearAllAuraSlots } from "@ui/renderers/objects/PlayerUnitObjectRenderer";
import { updateAllWhirlInterpolations } from "@ui/renderers/objects/SandStormRenderer";
import { renderArcBatches, resetAllArcBatches } from "@ui/renderers/primitives/gpu/ArcGpuRenderer";
import {
  clearPetalAuraInstances,
  petalAuraEffect,
  disposePetalAuraResources,
  getPetalAuraGlContext,
} from "@ui/renderers/primitives/gpu/PetalAuraGpuRenderer";
import {
  disposeParticleRenderResources,
  getParticleStats,
  renderParticleEmitters,
} from "@ui/renderers/primitives/gpu/ParticleEmitterGpuRenderer";
import { whirlEffect, disposeWhirlResources, getWhirlGlContext } from "@ui/renderers/primitives/gpu/WhirlGpuRenderer";
import { renderFireRings } from "@ui/renderers/primitives/gpu/FireRingGpuRenderer";
import { getParticleEmitterGlContext, setParticleEmitterGlContext } from "@ui/renderers/primitives/utils/gpuContext";
import { disposeFireRing } from "@ui/renderers/primitives/gpu/FireRingGpuRenderer";
import { registerHmrCleanup } from "@ui/shared/hmrCleanup";
import { setSceneTimelineTimeMs } from "@ui/renderers/primitives/utils/sceneTimeline";
import {
  SCENE_VERTEX_SHADER,
  createSceneFragmentShader,
} from "@ui/renderers/shaders/fillEffects.glsl";
import { compileShader, linkProgram } from "@ui/renderers/utils/webglProgram";

const VERTEX_SHADER = SCENE_VERTEX_SHADER;

const FRAGMENT_SHADER = createSceneFragmentShader();

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
  useEffect(() => {
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
        try { clearAllAuraSlots(); } catch {}
        try { clearPetalAuraInstances(); } catch {}
        try { resetAllArcBatches(); } catch {}
      }
    });
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;

    if (!gl) {
      throw new Error("WebGL 2 is required but not available");
    }

    const objectsRenderer = createObjectsRendererManager();

    setParticleEmitterGlContext(gl);
    whirlEffect.onContextAcquired(gl);
    petalAuraEffect.onContextAcquired(gl);

    clearAllAuraSlots();
    if (gl) {
      clearPetalAuraInstances(gl);
    } else {
      clearPetalAuraInstances();
    }
    objectsRenderer.bootstrap(scene.getObjects());

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = linkProgram(gl, vertexShader, fragmentShader);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const fillInfoLocation = gl.getAttribLocation(program, "a_fillInfo");
    const fillParams0Location = gl.getAttribLocation(program, "a_fillParams0");
    const fillParams1Location = gl.getAttribLocation(program, "a_fillParams1");
    const filaments0Location = gl.getAttribLocation(program, "a_filaments0");
    const filamentEdgeBlurLocation = gl.getAttribLocation(
      program,
      "a_filamentEdgeBlur",
    );
    const stopOffsetsLocation = gl.getAttribLocation(program, "a_stopOffsets");
    const stopColor0Location = gl.getAttribLocation(program, "a_stopColor0");
    const stopColor1Location = gl.getAttribLocation(program, "a_stopColor1");
    const stopColor2Location = gl.getAttribLocation(program, "a_stopColor2");

    const stride =
      VERTEX_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    const attributeLocations = [
      positionLocation,
      fillInfoLocation,
      fillParams0Location,
      fillParams1Location,
      filaments0Location,
      filamentEdgeBlurLocation,
      stopOffsetsLocation,
      stopColor0Location,
      stopColor1Location,
      stopColor2Location,
    ];

    if (attributeLocations.some((location) => location < 0)) {
      throw new Error("Unable to resolve vertex attribute locations");
    }

    const attributeConfigs = (() => {
      let offset = 0;
      const configs: Array<{ location: number; size: number; offset: number }> = [];
      const pushConfig = (location: number, size: number) => {
        configs.push({ location, size, offset });
        offset += size * Float32Array.BYTES_PER_ELEMENT;
      };
      pushConfig(positionLocation, POSITION_COMPONENTS);
      pushConfig(fillInfoLocation, FILL_INFO_COMPONENTS);
      pushConfig(fillParams0Location, FILL_PARAMS0_COMPONENTS);
      pushConfig(fillParams1Location, FILL_PARAMS1_COMPONENTS);
      pushConfig(filaments0Location, FILL_FILAMENTS0_COMPONENTS);
      pushConfig(filamentEdgeBlurLocation, FILL_FILAMENTS1_COMPONENTS);
      pushConfig(stopOffsetsLocation, STOP_OFFSETS_COMPONENTS);
      pushConfig(stopColor0Location, STOP_COLOR_COMPONENTS);
      pushConfig(stopColor1Location, STOP_COLOR_COMPONENTS);
      pushConfig(stopColor2Location, STOP_COLOR_COMPONENTS);
      return configs;
    })();

    const staticBuffer = gl.createBuffer();
    const dynamicBuffer = gl.createBuffer();

    if (!staticBuffer || !dynamicBuffer) {
      throw new Error("Unable to allocate buffers");
    }

    const enableAttributes = (buffer: WebGLBuffer) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      attributeConfigs.forEach(({ location, size, offset }) => {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
      });
    };

    const cameraPositionLocation = gl.getUniformLocation(
      program,
      "u_cameraPosition",
    );
    const viewportSizeLocation = gl.getUniformLocation(
      program,
      "u_viewportSize",
    );

    if (!cameraPositionLocation || !viewportSizeLocation) {
      throw new Error("Unable to resolve camera uniforms");
    }

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );

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
      const sync = objectsRenderer.consumeSyncInstructions();
      if (sync.staticData) {
        gl.bindBuffer(gl.ARRAY_BUFFER, staticBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sync.staticData, gl.STATIC_DRAW);
      }
      if (sync.dynamicData) {
        gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sync.dynamicData, gl.DYNAMIC_DRAW);
      } else if (sync.dynamicUpdates.length > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
        sync.dynamicUpdates.forEach(({ offset, data }) => {
          gl.bufferSubData(
            gl.ARRAY_BUFFER,
            offset * Float32Array.BYTES_PER_ELEMENT,
            data,
          );
        });
      }
    };

    const initialChanges = scene.flushChanges();
    objectsRenderer.applyChanges(initialChanges);
    applySync();

    let frame = 0;
    let previousTime: number | null = null;

    const render = (timestamp: number) => {
      setSceneTimelineTimeMs(timestamp);
      if (previousTime === null) {
        previousTime = timestamp;
      }
      const deltaMs = Math.min(timestamp - previousTime, 100);
      previousTime = timestamp;

      applyCameraMovement(
        pointerState,
        scene,
        deltaMs,
        canvas.width,
        canvas.height,
      );

      const cameraState = scene.getCamera();
      const changes = scene.flushChanges();
      objectsRenderer.applyChanges(changes);
      applySync();

      const dbs = objectsRenderer.getDynamicBufferStats();
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

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(
        cameraPositionLocation,
        cameraState.position.x,
        cameraState.position.y,
      );
      gl.uniform2f(
        viewportSizeLocation,
        cameraState.viewportSize.width,
        cameraState.viewportSize.height,
      );

      const drawBuffer = (buffer: WebGLBuffer, vertexCount: number) => {
        if (vertexCount <= 0) {
          return;
        }
        enableAttributes(buffer);
        gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
      };

      drawBuffer(staticBuffer, objectsRenderer.getStaticVertexCount());
      drawBuffer(dynamicBuffer, objectsRenderer.getDynamicVertexCount());

      if (gl) {
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
      }

      const latestCamera = scene.getCamera();
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

      frame = window.requestAnimationFrame(render);
    };

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
      scene.setViewportScreenSize(canvas.width, canvas.height);
      const currentMapSize = scene.getMapSize();
      console.log('CanvasDIM: ', canvas.width, canvas.height, currentMapSize.width, currentMapSize.height);
      
      scene.setMapSize({
        width: Math.max(currentMapSize.width, canvas.width, 1000),
        height: Math.max(currentMapSize.height + 150, canvas.height, 1000),
      });
      const current = scene.getCamera();
      scaleRef.current = current.scale;
      cameraInfoRef.current = current;
      setScale(current.scale);
      setCameraInfo(current);
    };

    resize();
    frame = window.requestAnimationFrame(render);
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
      const cameraState = scene.getCamera();
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
      spellcasting.tryCastSpell(spellId, worldPosition);
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

    console.log("useSceneCanvas mounted");

    return () => {
      objectsRenderer.dispose();
      setParticleEmitterGlContext(null);
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
      try {
        whirlEffect.dispose();
      } catch {}
      try {
        petalAuraEffect.dispose();
      } catch {}
      clearAllAuraSlots();
      clearPetalAuraInstances();
      resetAllArcBatches();
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(frame);
      gl.deleteBuffer(staticBuffer);
      gl.deleteBuffer(dynamicBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      window.removeEventListener("pointermove", handlePointerMoveWithCast);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("pointerout", handlePointerLeave);
      window.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [
    scene,
    spellcasting,
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
  ]);
};
