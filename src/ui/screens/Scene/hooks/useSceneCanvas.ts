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

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec4 a_fillInfo;
attribute vec4 a_fillParams0;
attribute vec4 a_fillParams1;
attribute vec4 a_filaments0;
attribute float a_filamentEdgeBlur;
attribute vec3 a_stopOffsets;
attribute vec4 a_stopColor0;
attribute vec4 a_stopColor1;
attribute vec4 a_stopColor2;
uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
varying vec2 v_worldPosition;
varying vec4 v_fillInfo;
varying vec4 v_fillParams0;
varying vec4 v_fillParams1;
varying vec4 v_filaments0;
varying float v_filamentEdgeBlur;
varying vec3 v_stopOffsets;
varying vec4 v_stopColor0;
varying vec4 v_stopColor1;
varying vec4 v_stopColor2;

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  gl_Position = vec4(toClip(a_position), 0.0, 1.0);
  v_worldPosition = a_position;
  v_fillInfo = a_fillInfo;
  v_fillParams0 = a_fillParams0;
  v_fillParams1 = a_fillParams1;
  v_filaments0 = a_filaments0;
  v_filamentEdgeBlur = a_filamentEdgeBlur;
  v_stopOffsets = a_stopOffsets;
  v_stopColor0 = a_stopColor0;
  v_stopColor1 = a_stopColor1;
  v_stopColor2 = a_stopColor2;
}
`;

const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 v_worldPosition;
varying vec4 v_fillInfo;
varying vec4 v_fillParams0;
varying vec4 v_fillParams1;
varying vec4 v_filaments0;
varying float v_filamentEdgeBlur;
varying vec3 v_stopOffsets;
varying vec4 v_stopColor0;
varying vec4 v_stopColor1;
varying vec4 v_stopColor2;

float clamp01(float value) {
  return clamp(value, 0.0, 1.0);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise2d(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  float ab = mix(a, b, u.x);
  float cd = mix(c, d, u.x);
  return mix(ab, cd, u.y);
}

vec2 resolveNoiseAnchor(float fillType) {
  // v_fillParams0.xy stores the object origin for solid fills, the gradient start
  // for linear fills, and the gradient center for radial/diamond fills.
  // Using it as the anchor keeps noise stable in the object's local space.
  if (fillType < 3.5) {
    return v_fillParams0.xy;
  }
  return v_worldPosition;
}

vec4 applyFillNoise(vec4 color) {
  float colorAmp = v_fillInfo.z;
  float alphaAmp = v_fillInfo.w;
  if (colorAmp <= 0.0 && alphaAmp <= 0.0) {
    return color;
  }
  float scale = v_fillParams1.w;
  float effectiveScale = scale > 0.0 ? scale : 1.0;
  float fillType = v_fillInfo.x;
  vec2 anchor = resolveNoiseAnchor(fillType);
  float noiseValue = noise2d((v_worldPosition - anchor) * effectiveScale) * 2.0 - 1.0;
  if (colorAmp > 0.0) {
    color.rgb = clamp(color.rgb + noiseValue * colorAmp, 0.0, 1.0);
  }
  if (alphaAmp > 0.0) {
    color.a = clamp(color.a + noiseValue * alphaAmp, 0.0, 1.0);
  }
  return color;
}

float ridgeNoise(vec2 p) {
  // Ridge noise creates vein-like structures
  return 1.0 - abs(noise2d(p) * 2.0 - 1.0);
}

float filamentNoise(vec2 p, float density) {
  float scale = density * 0.03;
  vec2 sp = p * scale;
  
  // Domain warping - warp coordinates with noise for organic flow
  vec2 warp = vec2(
    noise2d(sp + vec2(0.0, 0.0)),
    noise2d(sp + vec2(5.2, 1.3))
  );
  vec2 warped = sp + warp * 0.5;
  
  // Layered ridge noise for filament structure
  float n = 0.0;
  n += ridgeNoise(warped * 1.0) * 0.6;
  n += ridgeNoise(warped * 2.0) * 0.3;
  n += ridgeNoise(warped * 4.0) * 0.1;
  
  return n;
}

vec4 applyFillFilaments(vec4 color) {
  float colorContrast = v_filaments0.x;
  float alphaContrast = v_filaments0.y;
  float width = clamp01(v_filaments0.z);
  float density = v_filaments0.w;
  float edgeBlur = clamp01(v_filamentEdgeBlur);

  if ((colorContrast <= 0.0 && alphaContrast <= 0.0) || density <= 0.0) {
    return color;
  }

  vec2 anchor = resolveNoiseAnchor(v_fillInfo.x);
  vec2 pos = v_worldPosition - anchor;
  
  // Get filament pattern
  float n = filamentNoise(pos, density);
  
  // width controls how much of the filament is visible
  // Higher width = thicker filaments
  float threshold = 1.0 - width;
  float edge = threshold - edgeBlur * 0.3;
  
  // Create filament with smooth edges
  float filament = smoothstep(edge, threshold, n);
  
  // Convert to signed value
  float signed = (filament - 0.5) * 2.0;

  if (colorContrast > 0.0) {
    color.rgb = clamp(color.rgb + signed * colorContrast, 0.0, 1.0);
  }
  if (alphaContrast > 0.0) {
    color.a = clamp(color.a + signed * alphaContrast, 0.0, 1.0);
  }

  return color;
}

vec4 sampleGradient(float t) {
  float stopCount = v_fillInfo.y;
  vec4 color0 = v_stopColor0;
  if (stopCount < 1.5) {
    return color0;
  }

  float offset0 = v_stopOffsets.x;
  float offset1 = v_stopOffsets.y;
  vec4 color1 = v_stopColor1;

  if (stopCount < 2.5) {
    if (t <= offset0) {
      return color0;
    }
    if (t >= offset1) {
      return color1;
    }
    float range = max(offset1 - offset0, 0.0001);
    float factor = clamp((t - offset0) / range, 0.0, 1.0);
    return mix(color0, color1, factor);
  }

  float offset2 = v_stopOffsets.z;
  vec4 color2 = v_stopColor2;

  if (t <= offset0) {
    return color0;
  }
  if (t >= offset2) {
    return color2;
  }
  if (t <= offset1) {
    float range = max(offset1 - offset0, 0.0001);
    float factor = clamp((t - offset0) / range, 0.0, 1.0);
    return mix(color0, color1, factor);
  }

  float range = max(offset2 - offset1, 0.0001);
  float factor = clamp((t - offset1) / range, 0.0, 1.0);
  return mix(color1, color2, factor);
}

void main() {
  float fillType = v_fillInfo.x;
  vec4 color = v_stopColor0;

  if (fillType >= 0.5) {
    float t = 0.0;
    if (fillType < 1.5) {
      vec2 start = v_fillParams0.xy;
      vec2 dir = v_fillParams1.xy;
      float invLenSq = v_fillParams1.z;
      if (invLenSq > 0.0) {
        float projection = dot(v_worldPosition - start, dir) * invLenSq;
        t = clamp01(projection);
      }
    } else if (fillType < 2.5) {
      vec2 center = v_fillParams0.xy;
      float radius = max(v_fillParams0.z, 0.000001);
      float dist = length(v_worldPosition - center);
      t = clamp01(dist / radius);
    } else {
      vec2 center = v_fillParams0.xy;
      float radius = max(v_fillParams0.z, 0.000001);
      vec2 diff = v_worldPosition - center;
      float dist = abs(diff.x) + abs(diff.y);
      t = clamp01(dist / radius);
    }
    color = sampleGradient(t);
  }

  color = applyFillNoise(applyFillFilaments(color));
  gl_FragColor = color;
}
`;

const EDGE_THRESHOLD = 48;
const CAMERA_SPEED = 400; // world units per second

const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
};

const createProgram = (
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
) => {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Unable to create program");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Unknown program error";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
};

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

    const webgl2 = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    const gl =
      (webgl2 as WebGL2RenderingContext | WebGLRenderingContext | null) ??
      canvas.getContext("webgl");

    if (!gl) {
      throw new Error("Unable to acquire WebGL context");
    }

    const objectsRenderer = createObjectsRendererManager();

    if (webgl2) {
      setParticleEmitterGlContext(webgl2);
      whirlEffect.onContextAcquired(webgl2);
      petalAuraEffect.onContextAcquired(webgl2);
    } else {
      setParticleEmitterGlContext(null);
      const whirlContext = whirlEffect.getPrimaryContext();
      if (whirlContext) {
        whirlEffect.onContextLost(whirlContext);
      }
      const auraContext = petalAuraEffect.getPrimaryContext();
      if (auraContext) {
        petalAuraEffect.onContextLost(auraContext);
      }
    }

    clearAllAuraSlots();
    if (webgl2) {
      clearPetalAuraInstances(webgl2);
    } else {
      clearPetalAuraInstances();
    }
    objectsRenderer.bootstrap(scene.getObjects());

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = createProgram(gl, vertexShader, fragmentShader);

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

      if (webgl2) {
        renderParticleEmitters(
          webgl2,
          cameraState.position,
          cameraState.viewportSize,
        );
        updateAllWhirlInterpolations();
        whirlEffect.beforeRender(webgl2, timestamp);
        petalAuraEffect.beforeRender(webgl2, timestamp);
        whirlEffect.render(
          webgl2,
          cameraState.position,
          cameraState.viewportSize,
          timestamp,
        );
        petalAuraEffect.render(
          webgl2,
          cameraState.position,
          cameraState.viewportSize,
          timestamp,
        );
        renderArcBatches(
          webgl2,
          cameraState.position,
          cameraState.viewportSize,
        );
        renderFireRings(
          webgl2,
          cameraState.position,
          cameraState.viewportSize,
          timestamp,
        );
        const stats = getParticleStats(webgl2);
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
      scene.setMapSize({
        width: Math.max(
          currentMapSize.width,
          canvas.width,
          canvas.height,
          1000,
        ),
        height: Math.max(
          currentMapSize.height,
          canvas.width,
          canvas.height,
          1000,
        ),
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
      if (webgl2) {
        try {
          whirlEffect.onContextLost(webgl2);
        } catch {}
        try {
          petalAuraEffect.onContextLost(webgl2);
        } catch {}
        try {
          disposeParticleRenderResources(webgl2);
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
