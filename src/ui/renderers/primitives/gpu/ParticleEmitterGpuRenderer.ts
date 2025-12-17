import { SceneVector2 } from "../../../../logic/services/SceneObjectManager";
import {
  CORE_NOISE_GLSL,
  APPLY_FILL_NOISE_GLSL,
  APPLY_FILL_FILAMENTS_GLSL,
  DEFAULT_NOISE_ANCHOR,
  createNoiseAnchorGLSL,
} from "../../shaders/fillEffects.glsl";

const UNIT_QUAD_VERTICES = new Float32Array([
  // TRIANGLE_STRIP order: bottom-left, bottom-right, top-left, top-right
  -0.5, -0.5,
   0.5, -0.5,
  -0.5,  0.5,
   0.5,  0.5,
]);

const PARTICLE_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_unitPosition;
in vec2 a_position;
in float a_size;
in float a_age;
in float a_lifetime;
in float a_isActive;
in vec2 a_velocity;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_fadeStartMs;
uniform float u_defaultLifetimeMs;
uniform float u_minParticleSize;
uniform float u_lengthMultiplier;
uniform int u_alignToVelocity;
uniform float u_sizeGrowthRate;

uniform int u_fillType;
uniform int u_stopCount;
uniform int u_hasLinearStart;
uniform int u_hasLinearEnd;
uniform int u_hasRadialOffset;
uniform int u_hasExplicitRadius;
uniform int u_shape;

uniform vec2 u_linearStart;
uniform vec2 u_linearEnd;
uniform vec2 u_radialOffset;
uniform float u_explicitRadius;

uniform float u_stopOffsets[5];
uniform vec4 u_stopColor0;
uniform vec4 u_stopColor1;
uniform vec4 u_stopColor2;
uniform vec4 u_stopColor3;
uniform vec4 u_stopColor4;
uniform vec2 u_noiseAmplitude;
uniform float u_noiseScale;
uniform vec4 u_filaments0;
uniform float u_filamentEdgeBlur;

out vec2 v_worldPosition;
out vec4 v_fillInfo;
out vec4 v_fillParams0;
out vec4 v_fillParams1;
out vec4 v_filaments0;
out float v_filamentEdgeBlur;
out float v_stopOffsets[5];
out vec4 v_stopColor0;
out vec4 v_stopColor1;
out vec4 v_stopColor2;
out vec4 v_stopColor3;
out vec4 v_stopColor4;
out float v_shape;
out vec2 v_particleCenter;
out float v_particleRadius;

float clamp01(float value) {
  return clamp(value, 0.0, 1.0);
}

float computeAlpha(float age, float lifetime) {
  float effectiveLifetime = lifetime > 0.0 ? lifetime : u_defaultLifetimeMs;
  if (u_fadeStartMs >= effectiveLifetime) {
    return 1.0;
  }
  if (age <= u_fadeStartMs) {
    return 1.0;
  }
  float fadeDuration = max(1.0, effectiveLifetime - u_fadeStartMs);
  float fadeProgress = clamp01((age - u_fadeStartMs) / fadeDuration);
  return 1.0 - fadeProgress;
}

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  float isActive = a_isActive;
  bool alive = isActive > 0.5;
  float baseSize = a_size;
  // Apply size growth: size = baseSize * growthRate^(age/1000)
  float ageSeconds = a_age * 0.001;
  float growthMultiplier = u_sizeGrowthRate > 0.0 ? pow(u_sizeGrowthRate, ageSeconds) : 1.0;
  float size = alive ? max(baseSize * growthMultiplier, u_minParticleSize) : 0.0;
  vec2 center = a_position;
  float lengthMul = max(u_lengthMultiplier, 1.0);
  vec2 baseOffset = vec2(a_unitPosition.x * size * lengthMul, a_unitPosition.y * size);
  vec2 world;
  if (u_alignToVelocity == 1) {
    vec2 dir = a_velocity;
    float len = length(dir);
    vec2 ndir = len > 0.0001 ? dir / len : vec2(1.0, 0.0);
    vec2 perp = vec2(-ndir.y, ndir.x);
    vec2 rotated = ndir * baseOffset.x + perp * baseOffset.y;
    world = center + rotated;
  } else {
    world = center + baseOffset;
  }

  float alpha = alive ? computeAlpha(a_age, a_lifetime) : 0.0;

  v_worldPosition = world;
  for (int i = 0; i < 5; i++) {
    v_stopOffsets[i] = u_stopOffsets[i];
  }

  vec4 stop0 = u_stopColor0;
  vec4 stop1 = u_stopColor1;
  vec4 stop2 = u_stopColor2;
  vec4 stop3 = u_stopColor3;
  vec4 stop4 = u_stopColor4;
  stop0.a *= alpha;
  stop1.a *= alpha;
  stop2.a *= alpha;
  stop3.a *= alpha;
  stop4.a *= alpha;
  v_stopColor0 = stop0;
  v_stopColor1 = stop1;
  v_stopColor2 = stop2;
  v_stopColor3 = stop3;
  v_stopColor4 = stop4;

  v_fillInfo = vec4(float(u_fillType), float(u_stopCount), u_noiseAmplitude.x, u_noiseAmplitude.y);
  v_filaments0 = u_filaments0;
  v_filamentEdgeBlur = u_filamentEdgeBlur;

  if (u_fillType == 1) {
    vec2 startWorld;
    vec2 endWorld;
    vec2 dir;
    if (u_alignToVelocity == 1) {
      float halfLen = (size * 0.5) * max(u_lengthMultiplier, 1.0);
      vec2 vdir = a_velocity;
      float vlen = length(vdir);
      vec2 ndir = vlen > 0.0001 ? vdir / vlen : vec2(1.0, 0.0);
      startWorld = center - ndir * halfLen;
      endWorld = center + ndir * halfLen;
      dir = endWorld - startWorld;
    } else {
      vec2 startLocal = u_hasLinearStart == 1 ? u_linearStart : vec2(-size * 0.5, 0.0);
      vec2 endLocal = u_hasLinearEnd == 1 ? u_linearEnd : vec2(size * 0.5, 0.0);
      startWorld = center + startLocal;
      endWorld = center + endLocal;
      dir = endWorld - startWorld;
    }
    float lengthSq = dot(dir, dir);
    v_fillParams0 = vec4(startWorld, endWorld);
    v_fillParams1 = vec4(dir, lengthSq > 0.0 ? 1.0 / lengthSq : 0.0, u_noiseScale);
  } else if (u_fillType == 2 || u_fillType == 3) {
    vec2 offsetLocal = u_hasRadialOffset == 1 ? u_radialOffset : vec2(0.0);
    vec2 gradientCenter = center + offsetLocal;
    float radius = u_hasExplicitRadius == 1 ? u_explicitRadius : size * 0.5;
    v_fillParams0 = vec4(gradientCenter, radius, 0.0);
    v_fillParams1 = vec4(0.0, 0.0, 0.0, u_noiseScale);
  } else {
    v_fillParams0 = vec4(center, 0.0, 0.0);
    v_fillParams1 = vec4(0.0, 0.0, 0.0, u_noiseScale);
  }

  v_shape = float(u_shape);
  v_particleCenter = center;
  v_particleRadius = size * 0.5;

  if (!alive) {
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
    return;
  }

  gl_Position = vec4(toClip(world), 0.0, 1.0);
}
`;

const PARTICLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_worldPosition;
in vec4 v_fillInfo;
in vec4 v_fillParams0;
in vec4 v_fillParams1;
in vec4 v_filaments0;
in float v_filamentEdgeBlur;
in float v_stopOffsets[5];
in vec4 v_stopColor0;
in vec4 v_stopColor1;
in vec4 v_stopColor2;
in vec4 v_stopColor3;
in vec4 v_stopColor4;
in float v_shape;
in vec2 v_particleCenter;
in float v_particleRadius;

out vec4 fragColor;

float clamp01(float value) {
  return clamp(value, 0.0, 1.0);
}

` + CORE_NOISE_GLSL + createNoiseAnchorGLSL(DEFAULT_NOISE_ANCHOR) + APPLY_FILL_NOISE_GLSL + APPLY_FILL_FILAMENTS_GLSL + `

vec4 sampleGradient(float t) {
  int stopCount = int(v_fillInfo.y);
  vec4 colors[5] = vec4[5](v_stopColor0, v_stopColor1, v_stopColor2, v_stopColor3, v_stopColor4);
  
  if (stopCount <= 1) {
    return colors[0];
  }
  
  // Clamp t to valid range
  t = clamp(t, 0.0, 1.0);
  
  // Find the segment t falls into
  for (int i = 0; i < stopCount - 1; i++) {
    float offset0 = v_stopOffsets[i];
    float offset1 = v_stopOffsets[i + 1];
    if (t <= offset1 || i == stopCount - 2) {
      float blend = clamp01((t - offset0) / max(0.00001, offset1 - offset0));
      return mix(colors[i], colors[i + 1], blend);
    }
  }
  
  return colors[stopCount - 1];
}

vec4 shadeSolid() {
  return v_stopColor0;
}

vec4 shadeLinear() {
  vec2 startWorld = v_fillParams0.xy;
  vec2 endWorld = v_fillParams0.zw;
  vec2 dir = v_fillParams1.xy;
  float dirLengthSq = v_fillParams1.z;
  float projection = 0.0;
  if (dirLengthSq > 0.0) {
    projection = clamp01(dot(v_worldPosition - startWorld, dir) * dirLengthSq);
  }
  return sampleGradient(projection);
}

vec4 shadeRadial() {
  vec2 center = v_fillParams0.xy;
  float radius = max(v_fillParams0.z, 0.00001);
  float distance = length(v_worldPosition - center);
  float t = clamp01(distance / radius);
  return sampleGradient(t);
}

void main() {
  if (v_stopColor0.a <= 0.0 && v_stopColor1.a <= 0.0 && v_stopColor2.a <= 0.0 && v_stopColor3.a <= 0.0 && v_stopColor4.a <= 0.0) {
    discard;
  }
  // v_shape: 0.0=square, 1.0=circle, 2.0=triangle
  if (v_shape > 0.5 && v_shape < 1.5) {
    // Circle masking
    float dist = length(v_worldPosition - v_particleCenter);
    if (dist > v_particleRadius) {
      discard;
    }
  } else if (v_shape > 1.5) {
    // Triangle masking: pointing in direction of velocity
    vec2 localPos = (v_worldPosition - v_particleCenter) / max(v_particleRadius, 0.01);
    // Isosceles triangle: base at x=-0.5, tip at x=0.5, height 1.0
    float x = localPos.x;
    float absY = abs(localPos.y);
    // Triangle edges: |y| < 0.5 * (1.0 - x) for x in [-0.5, 0.5]
    if (x < -0.5 || x > 0.5 || absY > 0.5 * (1.0 - 2.0 * x)) discard;
  }
  float fillType = v_fillInfo.x;
  vec4 color;
  if (fillType < 0.5) {
    color = shadeSolid();
  } else if (abs(fillType - 1.0) < 0.5) {
    color = shadeLinear();
  } else if (abs(fillType - 2.0) < 0.5 || abs(fillType - 3.0) < 0.5) {
    color = shadeRadial();
  } else {
    color = shadeSolid();
  }
  fragColor = applyFillNoise(applyFillFilaments(color));
}
`;

interface ParticleRenderProgram {
  program: WebGLProgram;
  attributes: {
    unitPosition: number;
    position: number;
    velocity: number;
    size: number;
    age: number;
    lifetime: number;
    isActive: number;
  };
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    fadeStartMs: WebGLUniformLocation | null;
    defaultLifetimeMs: WebGLUniformLocation | null;
    minParticleSize: WebGLUniformLocation | null;
    lengthMultiplier: WebGLUniformLocation | null;
    alignToVelocity: WebGLUniformLocation | null;
    sizeGrowthRate: WebGLUniformLocation | null;
    fillType: WebGLUniformLocation | null;
    stopCount: WebGLUniformLocation | null;
    hasLinearStart: WebGLUniformLocation | null;
    hasLinearEnd: WebGLUniformLocation | null;
    hasRadialOffset: WebGLUniformLocation | null;
    hasExplicitRadius: WebGLUniformLocation | null;
    shape: WebGLUniformLocation | null;
    linearStart: WebGLUniformLocation | null;
    linearEnd: WebGLUniformLocation | null;
    radialOffset: WebGLUniformLocation | null;
    explicitRadius: WebGLUniformLocation | null;
    stopOffsets: WebGLUniformLocation | null;
    stopColor0: WebGLUniformLocation | null;
    stopColor1: WebGLUniformLocation | null;
    stopColor2: WebGLUniformLocation | null;
    stopColor3: WebGLUniformLocation | null;
    stopColor4: WebGLUniformLocation | null;
    noiseAmplitude: WebGLUniformLocation | null;
    noiseScale: WebGLUniformLocation | null;
    filaments0: WebGLUniformLocation | null;
    filamentEdgeBlur: WebGLUniformLocation | null;
  };
}

export interface ParticleEmitterGpuRenderUniforms {
  fillType: number;
  stopCount: number;
  stopOffsets: Float32Array;
  stopColor0: Float32Array;
  stopColor1: Float32Array;
  stopColor2: Float32Array;
  stopColor3: Float32Array;
  stopColor4: Float32Array;
  noiseColorAmplitude: number;
  noiseAlphaAmplitude: number;
  noiseScale: number;
  filamentColorContrast: number;
  filamentAlphaContrast: number;
  filamentWidth: number;
  filamentDensity: number;
  filamentEdgeBlur: number;
  hasLinearStart: boolean;
  linearStart: SceneVector2;
  hasLinearEnd: boolean;
  linearEnd: SceneVector2;
  hasRadialOffset: boolean;
  radialOffset: SceneVector2;
  hasExplicitRadius: boolean;
  explicitRadius: number;
  fadeStartMs: number;
  defaultLifetimeMs: number;
  shape: number;
  minParticleSize: number;
  lengthMultiplier: number;
  alignToVelocity: boolean;
  sizeGrowthRate: number;
}

export interface ParticleEmitterGpuDrawHandle {
  gl: WebGL2RenderingContext;
  capacity: number;
  getCurrentVao(): WebGLVertexArrayObject | null;
  uniforms: ParticleEmitterGpuRenderUniforms;
  activeCount: number;
}

export interface ParticleRenderResources {
  program: ParticleRenderProgram;
  quadBuffer: WebGLBuffer;
}

interface ParticleRendererContext {
  resources: ParticleRenderResources;
  emitters: Set<ParticleEmitterGpuDrawHandle>;
}

const rendererContexts = new WeakMap<WebGL2RenderingContext, ParticleRendererContext>();

const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Failed to compile particle shader", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const createRenderProgram = (
  gl: WebGL2RenderingContext
): ParticleRenderProgram | null => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, PARTICLE_VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, PARTICLE_FRAGMENT_SHADER);
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Failed to link particle render program", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  const attributes = {
    unitPosition: gl.getAttribLocation(program, "a_unitPosition"),
    position: gl.getAttribLocation(program, "a_position"),
    velocity: gl.getAttribLocation(program, "a_velocity"),
    size: gl.getAttribLocation(program, "a_size"),
    age: gl.getAttribLocation(program, "a_age"),
    lifetime: gl.getAttribLocation(program, "a_lifetime"),
    isActive: gl.getAttribLocation(program, "a_isActive"),
  };
  if (
    attributes.unitPosition < 0 ||
    attributes.position < 0 ||
    attributes.velocity < 0 ||
    attributes.size < 0 ||
    attributes.age < 0 ||
    attributes.lifetime < 0 ||
    attributes.isActive < 0
  ) {
    console.error("Particle render attributes are missing");
    gl.deleteProgram(program);
    return null;
  }
  const uniforms = {
    cameraPosition: gl.getUniformLocation(program, "u_cameraPosition"),
    viewportSize: gl.getUniformLocation(program, "u_viewportSize"),
    fadeStartMs: gl.getUniformLocation(program, "u_fadeStartMs"),
    defaultLifetimeMs: gl.getUniformLocation(program, "u_defaultLifetimeMs"),
    minParticleSize: gl.getUniformLocation(program, "u_minParticleSize"),
    lengthMultiplier: gl.getUniformLocation(program, "u_lengthMultiplier"),
    alignToVelocity: gl.getUniformLocation(program, "u_alignToVelocity"),
    sizeGrowthRate: gl.getUniformLocation(program, "u_sizeGrowthRate"),
    fillType: gl.getUniformLocation(program, "u_fillType"),
    stopCount: gl.getUniformLocation(program, "u_stopCount"),
    hasLinearStart: gl.getUniformLocation(program, "u_hasLinearStart"),
    hasLinearEnd: gl.getUniformLocation(program, "u_hasLinearEnd"),
    hasRadialOffset: gl.getUniformLocation(program, "u_hasRadialOffset"),
    hasExplicitRadius: gl.getUniformLocation(program, "u_hasExplicitRadius"),
    shape: gl.getUniformLocation(program, "u_shape"),
    linearStart: gl.getUniformLocation(program, "u_linearStart"),
    linearEnd: gl.getUniformLocation(program, "u_linearEnd"),
    radialOffset: gl.getUniformLocation(program, "u_radialOffset"),
    explicitRadius: gl.getUniformLocation(program, "u_explicitRadius"),
    stopOffsets: gl.getUniformLocation(program, "u_stopOffsets"),
    stopColor0: gl.getUniformLocation(program, "u_stopColor0"),
    stopColor1: gl.getUniformLocation(program, "u_stopColor1"),
    stopColor2: gl.getUniformLocation(program, "u_stopColor2"),
    stopColor3: gl.getUniformLocation(program, "u_stopColor3"),
    stopColor4: gl.getUniformLocation(program, "u_stopColor4"),
    noiseAmplitude: gl.getUniformLocation(program, "u_noiseAmplitude"),
    noiseScale: gl.getUniformLocation(program, "u_noiseScale"),
    filaments0: gl.getUniformLocation(program, "u_filaments0"),
    filamentEdgeBlur: gl.getUniformLocation(program, "u_filamentEdgeBlur"),
  };
  return { program, attributes, uniforms };
};

const createResources = (
  gl: WebGL2RenderingContext
): ParticleRenderResources | null => {
  const program = createRenderProgram(gl);
  if (!program) {
    return null;
  }
  const quadBuffer = gl.createBuffer();
  if (!quadBuffer) {
    gl.deleteProgram(program.program);
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_VERTICES, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return { program, quadBuffer };
};

export const getParticleRenderResources = (
  gl: WebGL2RenderingContext
): ParticleRenderResources | null => {
  let context = rendererContexts.get(gl);
  if (context) {
    return context.resources;
  }
  const resources = createResources(gl);
  if (!resources) {
    return null;
  }
  context = {
    resources,
    emitters: new Set(),
  };
  rendererContexts.set(gl, context);
  return resources;
};

export const disposeParticleRenderResources = (
  gl: WebGL2RenderingContext
): void => {
  const context = rendererContexts.get(gl);
  if (!context) {
    return;
  }
  // Best effort: ensure no emitters are kept
  context.emitters.clear();
  const { program, quadBuffer } = context.resources;
  if (quadBuffer) {
    gl.deleteBuffer(quadBuffer);
  }
  if (program && program.program) {
    gl.deleteProgram(program.program);
  }
  rendererContexts.delete(gl);
};

export const getParticleStats = (
  gl: WebGL2RenderingContext
): { emitters: number; active: number; capacity: number } => {
  const context = rendererContexts.get(gl);
  if (!context) {
    return { emitters: 0, active: 0, capacity: 0 };
  }
  let emitters = 0;
  let active = 0;
  let capacity = 0;
  context.emitters.forEach((handle) => {
    emitters += 1;
    active += Math.max(0, handle.activeCount || 0);
    capacity += Math.max(0, handle.capacity || 0);
  });
  return { emitters, active, capacity };
};

const getRendererContext = (
  gl: WebGL2RenderingContext
): ParticleRendererContext | null => {
  const resources = getParticleRenderResources(gl);
  if (!resources) {
    return null;
  }
  let context = rendererContexts.get(gl);
  if (!context) {
    context = {
      resources,
      emitters: new Set(),
    };
    rendererContexts.set(gl, context);
  }
  return context;
};

export const registerParticleEmitterHandle = (
  handle: ParticleEmitterGpuDrawHandle
): void => {
  const context = getRendererContext(handle.gl);
  if (!context) {
    return;
  }
  context.emitters.add(handle);
};

export const unregisterParticleEmitterHandle = (
  handle: ParticleEmitterGpuDrawHandle
): void => {
  const context = rendererContexts.get(handle.gl);
  if (!context) {
    return;
  }
  context.emitters.delete(handle);
};

type UniformCache = {
  fadeStartMs?: number;
  defaultLifetimeMs?: number;
  minParticleSize?: number;
  lengthMultiplier?: number;
  alignToVelocity?: number;
  sizeGrowthRate?: number;
  fillType?: number;
  stopCount?: number;
  hasLinearStart?: number;
  hasLinearEnd?: number;
  hasRadialOffset?: number;
  hasExplicitRadius?: number;
  shape?: number;
  linearStart?: [number, number];
  linearEnd?: [number, number];
  radialOffset?: [number, number];
  explicitRadius?: number;
  stopOffsets?: string; // serialized to avoid per-element checks cost
  stopColor0?: string;
  stopColor1?: string;
  stopColor2?: string;
  stopColor3?: string;
  stopColor4?: string;
  noiseAmplitude?: [number, number];
  noiseScale?: number;
  filaments0?: [number, number, number, number];
  filamentEdgeBlur?: number;
};

const serializeArray = (arr: Float32Array): string => {
  let s = "";
  for (let i = 0; i < arr.length; i += 1) s += arr[i] + ",";
  return s;
};

const uploadEmitterUniforms = (
  gl: WebGL2RenderingContext,
  program: ParticleRenderProgram,
  u: ParticleEmitterGpuRenderUniforms,
  cache: UniformCache
): void => {
  if (program.uniforms.fadeStartMs && cache.fadeStartMs !== u.fadeStartMs) {
    gl.uniform1f(program.uniforms.fadeStartMs, (cache.fadeStartMs = u.fadeStartMs));
  }
  if (
    program.uniforms.defaultLifetimeMs &&
    cache.defaultLifetimeMs !== u.defaultLifetimeMs
  ) {
    gl.uniform1f(
      program.uniforms.defaultLifetimeMs,
      (cache.defaultLifetimeMs = u.defaultLifetimeMs)
    );
  }
  if (
    program.uniforms.minParticleSize &&
    cache.minParticleSize !== u.minParticleSize
  ) {
    gl.uniform1f(
      program.uniforms.minParticleSize,
      (cache.minParticleSize = u.minParticleSize)
    );
  }
  if (
    program.uniforms.lengthMultiplier &&
    cache.lengthMultiplier !== u.lengthMultiplier
  ) {
    gl.uniform1f(
      program.uniforms.lengthMultiplier,
      (cache.lengthMultiplier = u.lengthMultiplier)
    );
  }
  const alignVal = u.alignToVelocity ? 1 : 0;
  if (
    program.uniforms.alignToVelocity &&
    cache.alignToVelocity !== alignVal
  ) {
    gl.uniform1i(
      program.uniforms.alignToVelocity,
      (cache.alignToVelocity = alignVal)
    );
  }
  if (
    program.uniforms.sizeGrowthRate &&
    cache.sizeGrowthRate !== u.sizeGrowthRate
  ) {
    gl.uniform1f(
      program.uniforms.sizeGrowthRate,
      (cache.sizeGrowthRate = u.sizeGrowthRate)
    );
  }
  if (program.uniforms.fillType && cache.fillType !== u.fillType) {
    gl.uniform1i(program.uniforms.fillType, (cache.fillType = u.fillType));
  }
  if (program.uniforms.stopCount && cache.stopCount !== u.stopCount) {
    gl.uniform1i(program.uniforms.stopCount, (cache.stopCount = u.stopCount));
  }
  const hasStart = u.hasLinearStart ? 1 : 0;
  if (program.uniforms.hasLinearStart && cache.hasLinearStart !== hasStart) {
    gl.uniform1i(program.uniforms.hasLinearStart, (cache.hasLinearStart = hasStart));
  }
  const hasEnd = u.hasLinearEnd ? 1 : 0;
  if (program.uniforms.hasLinearEnd && cache.hasLinearEnd !== hasEnd) {
    gl.uniform1i(program.uniforms.hasLinearEnd, (cache.hasLinearEnd = hasEnd));
  }
  const hasRadial = u.hasRadialOffset ? 1 : 0;
  if (program.uniforms.hasRadialOffset && cache.hasRadialOffset !== hasRadial) {
    gl.uniform1i(
      program.uniforms.hasRadialOffset,
      (cache.hasRadialOffset = hasRadial)
    );
  }
  const hasRadius = u.hasExplicitRadius ? 1 : 0;
  if (
    program.uniforms.hasExplicitRadius &&
    cache.hasExplicitRadius !== hasRadius
  ) {
    gl.uniform1i(
      program.uniforms.hasExplicitRadius,
      (cache.hasExplicitRadius = hasRadius)
    );
  }
  if (program.uniforms.shape && cache.shape !== u.shape) {
    gl.uniform1i(program.uniforms.shape, (cache.shape = u.shape));
  }
  const ls: [number, number] = [u.linearStart.x, u.linearStart.y];
  if (
    program.uniforms.linearStart &&
    (!cache.linearStart || cache.linearStart[0] !== ls[0] || cache.linearStart[1] !== ls[1])
  ) {
    gl.uniform2f(program.uniforms.linearStart, ls[0], ls[1]);
    cache.linearStart = ls;
  }
  const le: [number, number] = [u.linearEnd.x, u.linearEnd.y];
  if (
    program.uniforms.linearEnd &&
    (!cache.linearEnd || cache.linearEnd[0] !== le[0] || cache.linearEnd[1] !== le[1])
  ) {
    gl.uniform2f(program.uniforms.linearEnd, le[0], le[1]);
    cache.linearEnd = le;
  }
  const ro: [number, number] = [u.radialOffset.x, u.radialOffset.y];
  if (
    program.uniforms.radialOffset &&
    (!cache.radialOffset || cache.radialOffset[0] !== ro[0] || cache.radialOffset[1] !== ro[1])
  ) {
    gl.uniform2f(program.uniforms.radialOffset, ro[0], ro[1]);
    cache.radialOffset = ro;
  }
  if (
    program.uniforms.explicitRadius &&
    cache.explicitRadius !== u.explicitRadius
  ) {
    gl.uniform1f(
      program.uniforms.explicitRadius,
      (cache.explicitRadius = u.explicitRadius)
    );
  }
  const so = serializeArray(u.stopOffsets);
  if (program.uniforms.stopOffsets && cache.stopOffsets !== so) {
    gl.uniform1fv(program.uniforms.stopOffsets, u.stopOffsets);
    cache.stopOffsets = so;
  }
  const c0 = serializeArray(u.stopColor0);
  if (program.uniforms.stopColor0 && cache.stopColor0 !== c0) {
    gl.uniform4fv(program.uniforms.stopColor0, u.stopColor0);
    cache.stopColor0 = c0;
  }
  const c1 = serializeArray(u.stopColor1);
  if (program.uniforms.stopColor1 && cache.stopColor1 !== c1) {
    gl.uniform4fv(program.uniforms.stopColor1, u.stopColor1);
    cache.stopColor1 = c1;
  }
  const c2 = serializeArray(u.stopColor2);
  if (program.uniforms.stopColor2 && cache.stopColor2 !== c2) {
    gl.uniform4fv(program.uniforms.stopColor2, u.stopColor2);
    cache.stopColor2 = c2;
  }
  const c3 = serializeArray(u.stopColor3);
  if (program.uniforms.stopColor3 && cache.stopColor3 !== c3) {
    gl.uniform4fv(program.uniforms.stopColor3, u.stopColor3);
    cache.stopColor3 = c3;
  }
  const c4 = serializeArray(u.stopColor4);
  if (program.uniforms.stopColor4 && cache.stopColor4 !== c4) {
    gl.uniform4fv(program.uniforms.stopColor4, u.stopColor4);
    cache.stopColor4 = c4;
  }
  const noiseAmp: [number, number] = [u.noiseColorAmplitude, u.noiseAlphaAmplitude];
  if (
    program.uniforms.noiseAmplitude &&
    (!cache.noiseAmplitude || cache.noiseAmplitude[0] !== noiseAmp[0] || cache.noiseAmplitude[1] !== noiseAmp[1])
  ) {
    gl.uniform2f(program.uniforms.noiseAmplitude, noiseAmp[0], noiseAmp[1]);
    cache.noiseAmplitude = [noiseAmp[0], noiseAmp[1]];
  }
  if (program.uniforms.noiseScale && cache.noiseScale !== u.noiseScale) {
    gl.uniform1f(program.uniforms.noiseScale, (cache.noiseScale = u.noiseScale));
  }
  const filaments0: [number, number, number, number] = [
    u.filamentColorContrast,
    u.filamentAlphaContrast,
    u.filamentWidth,
    u.filamentDensity,
  ];
  if (
    program.uniforms.filaments0 &&
    (!cache.filaments0 ||
      cache.filaments0[0] !== filaments0[0] ||
      cache.filaments0[1] !== filaments0[1] ||
      cache.filaments0[2] !== filaments0[2] ||
      cache.filaments0[3] !== filaments0[3])
  ) {
    gl.uniform4f(
      program.uniforms.filaments0,
      filaments0[0],
      filaments0[1],
      filaments0[2],
      filaments0[3]
    );
    cache.filaments0 = [...filaments0];
  }
  if (
    program.uniforms.filamentEdgeBlur &&
    cache.filamentEdgeBlur !== u.filamentEdgeBlur
  ) {
    gl.uniform1f(
      program.uniforms.filamentEdgeBlur,
      (cache.filamentEdgeBlur = u.filamentEdgeBlur)
    );
  }
};

export const renderParticleEmitters = (
  gl: WebGL2RenderingContext,
  cameraPosition: SceneVector2,
  viewportSize: { width: number; height: number }
): void => {
  const context = rendererContexts.get(gl);
  if (!context || context.emitters.size === 0) {
    return;
  }
  const { resources, emitters } = context;
  const program = resources.program;
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
    gl.ONE,
    gl.ONE_MINUS_SRC_ALPHA,
  );
  gl.useProgram(program.program);
  if (program.uniforms.cameraPosition) {
    gl.uniform2f(program.uniforms.cameraPosition, cameraPosition.x, cameraPosition.y);
  }
  if (program.uniforms.viewportSize) {
    gl.uniform2f(program.uniforms.viewportSize, viewportSize.width, viewportSize.height);
  }

  const cache: UniformCache = {};
  emitters.forEach((handle) => {
    const instanceCount = Math.max(0, Math.min(handle.capacity, handle.activeCount || 0));
    if (instanceCount <= 0) {
      return;
    }
    const vao = handle.getCurrentVao();
    if (!vao) {
      return;
    }
    const uniforms = handle.uniforms;
    uploadEmitterUniforms(gl, program, uniforms, cache);

    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instanceCount);
  });

  gl.bindVertexArray(null);
};
