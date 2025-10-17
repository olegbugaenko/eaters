import { SceneVector2 } from "../../../logic/services/SceneObjectManager";

const UNIT_QUAD_VERTICES = new Float32Array([
  -0.5,
  -0.5,
  0.5,
  -0.5,
  0.5,
  0.5,
  -0.5,
  -0.5,
  0.5,
  0.5,
  -0.5,
  0.5,
]);

const PARTICLE_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_unitPosition;
in vec2 a_position;
in float a_size;
in float a_age;
in float a_lifetime;
in float a_isActive;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_fadeStartMs;
uniform float u_defaultLifetimeMs;
uniform float u_minParticleSize;

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

uniform vec3 u_stopOffsets;
uniform vec4 u_stopColor0;
uniform vec4 u_stopColor1;
uniform vec4 u_stopColor2;

out vec2 v_worldPosition;
out vec4 v_fillInfo;
out vec4 v_fillParams0;
out vec4 v_fillParams1;
out vec3 v_stopOffsets;
out vec4 v_stopColor0;
out vec4 v_stopColor1;
out vec4 v_stopColor2;
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
  float active = a_isActive;
  float size = max(a_size, u_minParticleSize);
  vec2 center = a_position;
  vec2 offset = a_unitPosition * size;
  vec2 world = center + offset;

  float alpha = active > 0.5 ? computeAlpha(a_age, a_lifetime) : 0.0;

  v_worldPosition = world;
  v_stopOffsets = u_stopOffsets;

  vec4 stop0 = u_stopColor0;
  vec4 stop1 = u_stopColor1;
  vec4 stop2 = u_stopColor2;
  stop0.a *= alpha;
  stop1.a *= alpha;
  stop2.a *= alpha;
  v_stopColor0 = stop0;
  v_stopColor1 = stop1;
  v_stopColor2 = stop2;

  v_fillInfo = vec4(float(u_fillType), float(u_stopCount), 0.0, 0.0);

  if (u_fillType == 1) {
    vec2 startLocal = u_hasLinearStart == 1 ? u_linearStart : vec2(-size * 0.5);
    vec2 endLocal = u_hasLinearEnd == 1 ? u_linearEnd : vec2(size * 0.5);
    vec2 startWorld = center + startLocal;
    vec2 endWorld = center + endLocal;
    vec2 dir = endWorld - startWorld;
    float lengthSq = dot(dir, dir);
    v_fillParams0 = vec4(startWorld, endWorld);
    v_fillParams1 = vec4(dir, lengthSq > 0.0 ? 1.0 / lengthSq : 0.0, 0.0);
  } else if (u_fillType == 2 || u_fillType == 3) {
    vec2 offsetLocal = u_hasRadialOffset == 1 ? u_radialOffset : vec2(0.0);
    vec2 gradientCenter = center + offsetLocal;
    float radius = u_hasExplicitRadius == 1 ? u_explicitRadius : size * 0.5;
    v_fillParams0 = vec4(gradientCenter, radius, 0.0);
    v_fillParams1 = vec4(0.0);
  } else {
    v_fillParams0 = vec4(center, 0.0, 0.0);
    v_fillParams1 = vec4(0.0);
  }

  v_shape = float(u_shape);
  v_particleCenter = center;
  v_particleRadius = size * 0.5;

  gl_Position = vec4(toClip(world), 0.0, 1.0);
}
`;

const PARTICLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_worldPosition;
in vec4 v_fillInfo;
in vec4 v_fillParams0;
in vec4 v_fillParams1;
in vec3 v_stopOffsets;
in vec4 v_stopColor0;
in vec4 v_stopColor1;
in vec4 v_stopColor2;
in float v_shape;
in vec2 v_particleCenter;
in float v_particleRadius;

out vec4 fragColor;

float clamp01(float value) {
  return clamp(value, 0.0, 1.0);
}

vec4 sampleGradient(float t) {
  float stopCount = v_fillInfo.y;
  vec4 color0 = v_stopColor0;
  if (stopCount < 1.5) {
    return color0;
  }
  vec4 color1 = v_stopColor1;
  if (stopCount < 2.5) {
    float blend = clamp01((t - v_stopOffsets.x) / max(0.00001, v_stopOffsets.y - v_stopOffsets.x));
    return mix(color0, color1, blend);
  }
  vec4 color2 = v_stopColor2;
  if (t <= v_stopOffsets.x) {
    return color0;
  }
  if (t >= v_stopOffsets.z) {
    return color2;
  }
  if (t <= v_stopOffsets.y) {
    float blend = clamp01((t - v_stopOffsets.x) / max(0.00001, v_stopOffsets.y - v_stopOffsets.x));
    return mix(color0, color1, blend);
  }
  float blend = clamp01((t - v_stopOffsets.y) / max(0.00001, v_stopOffsets.z - v_stopOffsets.y));
  return mix(color1, color2, blend);
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
  if (v_stopColor0.a <= 0.0 && v_stopColor1.a <= 0.0 && v_stopColor2.a <= 0.0) {
    discard;
  }
  if (v_shape > 0.5) {
    float dist = length(v_worldPosition - v_particleCenter);
    if (dist > v_particleRadius) {
      discard;
    }
  }
  float fillType = v_fillInfo.x;
  if (fillType < 0.5) {
    fragColor = shadeSolid();
    return;
  }
  if (abs(fillType - 1.0) < 0.5) {
    fragColor = shadeLinear();
    return;
  }
  if (abs(fillType - 2.0) < 0.5 || abs(fillType - 3.0) < 0.5) {
    fragColor = shadeRadial();
    return;
  }
  fragColor = shadeSolid();
}
`;

interface ParticleRenderProgram {
  program: WebGLProgram;
  attributes: {
    unitPosition: number;
    position: number;
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
  };
}

export interface ParticleEmitterGpuRenderUniforms {
  fillType: number;
  stopCount: number;
  stopOffsets: Float32Array;
  stopColor0: Float32Array;
  stopColor1: Float32Array;
  stopColor2: Float32Array;
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
}

export interface ParticleEmitterGpuDrawHandle {
  gl: WebGL2RenderingContext;
  capacity: number;
  getCurrentVao(): WebGLVertexArrayObject | null;
  uniforms: ParticleEmitterGpuRenderUniforms;
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
    size: gl.getAttribLocation(program, "a_size"),
    age: gl.getAttribLocation(program, "a_age"),
    lifetime: gl.getAttribLocation(program, "a_lifetime"),
    isActive: gl.getAttribLocation(program, "a_isActive"),
  };
  if (
    attributes.unitPosition < 0 ||
    attributes.position < 0 ||
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

const applyUniform = (
  gl: WebGL2RenderingContext,
  location: WebGLUniformLocation | null,
  setter: () => void
): void => {
  if (!location) {
    return;
  }
  setter();
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
  gl.useProgram(program.program);
  applyUniform(gl, program.uniforms.cameraPosition, () =>
    gl.uniform2f(program.uniforms.cameraPosition, cameraPosition.x, cameraPosition.y)
  );
  applyUniform(gl, program.uniforms.viewportSize, () =>
    gl.uniform2f(program.uniforms.viewportSize, viewportSize.width, viewportSize.height)
  );

  emitters.forEach((handle) => {
    const vao = handle.getCurrentVao();
    if (!vao) {
      return;
    }
    const uniforms = handle.uniforms;
    applyUniform(gl, program.uniforms.fadeStartMs, () =>
      gl.uniform1f(program.uniforms.fadeStartMs, uniforms.fadeStartMs)
    );
    applyUniform(gl, program.uniforms.defaultLifetimeMs, () =>
      gl.uniform1f(program.uniforms.defaultLifetimeMs, uniforms.defaultLifetimeMs)
    );
    applyUniform(gl, program.uniforms.minParticleSize, () =>
      gl.uniform1f(program.uniforms.minParticleSize, uniforms.minParticleSize)
    );
    applyUniform(gl, program.uniforms.fillType, () =>
      gl.uniform1i(program.uniforms.fillType, uniforms.fillType)
    );
    applyUniform(gl, program.uniforms.stopCount, () =>
      gl.uniform1i(program.uniforms.stopCount, uniforms.stopCount)
    );
    applyUniform(gl, program.uniforms.hasLinearStart, () =>
      gl.uniform1i(program.uniforms.hasLinearStart, uniforms.hasLinearStart ? 1 : 0)
    );
    applyUniform(gl, program.uniforms.hasLinearEnd, () =>
      gl.uniform1i(program.uniforms.hasLinearEnd, uniforms.hasLinearEnd ? 1 : 0)
    );
    applyUniform(gl, program.uniforms.hasRadialOffset, () =>
      gl.uniform1i(program.uniforms.hasRadialOffset, uniforms.hasRadialOffset ? 1 : 0)
    );
    applyUniform(gl, program.uniforms.hasExplicitRadius, () =>
      gl.uniform1i(program.uniforms.hasExplicitRadius, uniforms.hasExplicitRadius ? 1 : 0)
    );
    applyUniform(gl, program.uniforms.shape, () =>
      gl.uniform1i(program.uniforms.shape, uniforms.shape)
    );
    applyUniform(gl, program.uniforms.linearStart, () =>
      gl.uniform2f(program.uniforms.linearStart, uniforms.linearStart.x, uniforms.linearStart.y)
    );
    applyUniform(gl, program.uniforms.linearEnd, () =>
      gl.uniform2f(program.uniforms.linearEnd, uniforms.linearEnd.x, uniforms.linearEnd.y)
    );
    applyUniform(gl, program.uniforms.radialOffset, () =>
      gl.uniform2f(program.uniforms.radialOffset, uniforms.radialOffset.x, uniforms.radialOffset.y)
    );
    applyUniform(gl, program.uniforms.explicitRadius, () =>
      gl.uniform1f(program.uniforms.explicitRadius, uniforms.explicitRadius)
    );
    applyUniform(gl, program.uniforms.stopOffsets, () =>
      gl.uniform3fv(program.uniforms.stopOffsets, uniforms.stopOffsets)
    );
    applyUniform(gl, program.uniforms.stopColor0, () =>
      gl.uniform4fv(program.uniforms.stopColor0, uniforms.stopColor0)
    );
    applyUniform(gl, program.uniforms.stopColor1, () =>
      gl.uniform4fv(program.uniforms.stopColor1, uniforms.stopColor1)
    );
    applyUniform(gl, program.uniforms.stopColor2, () =>
      gl.uniform4fv(program.uniforms.stopColor2, uniforms.stopColor2)
    );

    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, handle.capacity);
  });

  gl.bindVertexArray(null);
};
