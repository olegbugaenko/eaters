import { compileShader } from "@ui/renderers/utils/webglProgram";
import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { RendererLayerAnimationConfig } from "@shared/types/renderer.types";

const TF_VERTEX_HEADER = `#version 300 es
precision highp float;
`;

const TF_FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
  outColor = vec4(0.0);
}
`;

const POLYGON_TF_VERTEX_SHADER = `${TF_VERTEX_HEADER}
layout(location = 0) in vec2 a_position;

uniform float u_timeMs;
uniform float u_periodMs;
uniform float u_phase;
uniform float u_amplitude;
uniform float u_amplitudePercent;
uniform float u_phaseStep;
uniform int u_animType; // 0 sway, 1 pulse
uniform int u_axisType; // 0 normal, 1 tangent, 2 movement
uniform int u_useVertexPhase;
uniform vec2 u_center;
uniform vec2 u_movementPerp;

out vec2 v_position;

vec2 resolveNormal(vec2 pos) {
  vec2 d = pos - u_center;
  float len = length(d);
  if (len < 1e-6) {
    return vec2(0.0, 0.0);
  }
  return d / len;
}

void main() {
  vec2 basePos = a_position;
  float omega = 6.28318530718 / max(u_periodMs, 1.0);
  float baseAngle = omega * u_timeMs + u_phase;
  float phaseOffset = (u_useVertexPhase == 1) ? (u_phaseStep * float(gl_VertexID)) : 0.0;
  float angle = baseAngle + phaseOffset;
  float s = sin(angle);

  vec2 normal = resolveNormal(basePos);
  vec2 tangent = vec2(-normal.y, normal.x);
  vec2 axis;
  if (u_axisType == 1) {
    axis = tangent;
  } else if (u_axisType == 2) {
    axis = u_movementPerp;
  } else {
    axis = normal;
  }

  float magnitude = u_amplitude;
  if (u_axisType == 2) {
    float signedDist = dot(basePos, u_movementPerp);
    float moveToward = -sign(signedDist);
    float moveMagnitude = (u_amplitudePercent >= 0.0) ? abs(signedDist) * u_amplitudePercent : u_amplitude;
    magnitude = moveMagnitude * moveToward;
  } else if (u_amplitudePercent >= 0.0 && u_axisType == 0) {
    float radius = length(basePos - u_center);
    magnitude = radius * u_amplitudePercent;
  }

  vec2 offset = axis * (magnitude * s);
  v_position = basePos + offset;
}
`;

const SPINE_TF_VERTEX_SHADER = `${TF_VERTEX_HEADER}
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_axis;
layout(location = 2) in float a_falloff;

uniform float u_timeMs;
uniform float u_periodMs;
uniform float u_phase;
uniform float u_amplitude;

out vec2 v_position;

void main() {
  float omega = 6.28318530718 / max(u_periodMs, 1.0);
  float baseAngle = omega * u_timeMs + u_phase;
  float segmentPhase = float(gl_VertexID) * 0.5;
  float s = sin(baseAngle + segmentPhase);
  float displacement = u_amplitude * a_falloff * s;
  v_position = a_position + a_axis * displacement;
}
`;

const TF_VARYINGS = ["v_position"] as const;

type PolygonGpuResources = {
  program: WebGLProgram;
  vertexShader: WebGLShader;
  fragmentShader: WebGLShader;
  vao: WebGLVertexArrayObject;
  inputBuffer: WebGLBuffer;
  outputBuffer: WebGLBuffer;
  transformFeedback: WebGLTransformFeedback;
  capacity: number;
  uniforms: {
    timeMs: WebGLUniformLocation | null;
    periodMs: WebGLUniformLocation | null;
    phase: WebGLUniformLocation | null;
    amplitude: WebGLUniformLocation | null;
    amplitudePercent: WebGLUniformLocation | null;
    phaseStep: WebGLUniformLocation | null;
    animType: WebGLUniformLocation | null;
    axisType: WebGLUniformLocation | null;
    useVertexPhase: WebGLUniformLocation | null;
    center: WebGLUniformLocation | null;
    movementPerp: WebGLUniformLocation | null;
  };
};

type SpineGpuResources = {
  program: WebGLProgram;
  vertexShader: WebGLShader;
  fragmentShader: WebGLShader;
  vao: WebGLVertexArrayObject;
  inputBuffer: WebGLBuffer;
  outputBuffer: WebGLBuffer;
  transformFeedback: WebGLTransformFeedback;
  capacity: number;
  uniforms: {
    timeMs: WebGLUniformLocation | null;
    periodMs: WebGLUniformLocation | null;
    phase: WebGLUniformLocation | null;
    amplitude: WebGLUniformLocation | null;
  };
};

type GpuAnimResources = {
  polygon: PolygonGpuResources;
  spine: SpineGpuResources;
};

const rendererContexts = new WeakMap<WebGL2RenderingContext, GpuAnimResources>();
const failedContexts = new WeakSet<WebGL2RenderingContext>();
let activeContext: WebGL2RenderingContext | null = null;

export const setAnimationGpuContext = (
  context: WebGL2RenderingContext | null
): void => {
  activeContext = context;
};

export const getAnimationGpuContext = (): WebGL2RenderingContext | null => activeContext;

const createTransformFeedbackProgram = (
  gl: WebGL2RenderingContext,
  vertexSource: string,
  varyings: readonly string[]
): { program: WebGLProgram; vertexShader: WebGLShader; fragmentShader: WebGLShader } => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, TF_FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Unable to create program");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.transformFeedbackVaryings(program, varyings, gl.SEPARATE_ATTRIBS);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Failed to link program: ${info ?? "unknown"}`);
  }
  return { program, vertexShader, fragmentShader };
};

const ensurePolygonResources = (
  gl: WebGL2RenderingContext,
  vertexCount: number
): PolygonGpuResources | null => {
  const resources = ensureResources(gl);
  if (!resources) {
    return null;
  }
  const polygon = resources.polygon;
  if (vertexCount > polygon.capacity) {
    polygon.capacity = Math.max(vertexCount, polygon.capacity * 2, 16);
    gl.bindBuffer(gl.ARRAY_BUFFER, polygon.inputBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, polygon.capacity * 2 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, polygon.outputBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, polygon.capacity * 2 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  return polygon;
};

const ensureSpineResources = (
  gl: WebGL2RenderingContext,
  vertexCount: number
): SpineGpuResources | null => {
  const resources = ensureResources(gl);
  if (!resources) {
    return null;
  }
  const spine = resources.spine;
  if (vertexCount > spine.capacity) {
    spine.capacity = Math.max(vertexCount, spine.capacity * 2, 8);
    gl.bindBuffer(gl.ARRAY_BUFFER, spine.inputBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, spine.capacity * 5 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, spine.outputBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, spine.capacity * 2 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  return spine;
};

const ensureResources = (gl: WebGL2RenderingContext): GpuAnimResources | null => {
  const existing = rendererContexts.get(gl);
  if (existing) {
    return existing;
  }
  if (failedContexts.has(gl)) {
    return null;
  }

  try {
    const polygonProgram = createTransformFeedbackProgram(gl, POLYGON_TF_VERTEX_SHADER, TF_VARYINGS);
    const spineProgram = createTransformFeedbackProgram(gl, SPINE_TF_VERTEX_SHADER, TF_VARYINGS);

    const polygonVao = gl.createVertexArray();
    const spineVao = gl.createVertexArray();
    const polygonInputBuffer = gl.createBuffer();
    const polygonOutputBuffer = gl.createBuffer();
    const spineInputBuffer = gl.createBuffer();
    const spineOutputBuffer = gl.createBuffer();
    const polygonTf = gl.createTransformFeedback();
    const spineTf = gl.createTransformFeedback();

    if (!polygonVao || !spineVao || !polygonInputBuffer || !polygonOutputBuffer || !spineInputBuffer || !spineOutputBuffer || !polygonTf || !spineTf) {
      return null;
    }

    gl.bindVertexArray(polygonVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, polygonInputBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.bindVertexArray(null);

    gl.bindVertexArray(spineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, spineInputBuffer);
    const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);
    gl.bindVertexArray(null);

    const polygonResources: PolygonGpuResources = {
      program: polygonProgram.program,
      vertexShader: polygonProgram.vertexShader,
      fragmentShader: polygonProgram.fragmentShader,
      vao: polygonVao,
      inputBuffer: polygonInputBuffer,
      outputBuffer: polygonOutputBuffer,
      transformFeedback: polygonTf,
      capacity: 0,
      uniforms: {
        timeMs: gl.getUniformLocation(polygonProgram.program, "u_timeMs"),
        periodMs: gl.getUniformLocation(polygonProgram.program, "u_periodMs"),
        phase: gl.getUniformLocation(polygonProgram.program, "u_phase"),
        amplitude: gl.getUniformLocation(polygonProgram.program, "u_amplitude"),
        amplitudePercent: gl.getUniformLocation(polygonProgram.program, "u_amplitudePercent"),
        phaseStep: gl.getUniformLocation(polygonProgram.program, "u_phaseStep"),
        animType: gl.getUniformLocation(polygonProgram.program, "u_animType"),
        axisType: gl.getUniformLocation(polygonProgram.program, "u_axisType"),
        useVertexPhase: gl.getUniformLocation(polygonProgram.program, "u_useVertexPhase"),
        center: gl.getUniformLocation(polygonProgram.program, "u_center"),
        movementPerp: gl.getUniformLocation(polygonProgram.program, "u_movementPerp"),
      },
    };

    const spineResources: SpineGpuResources = {
      program: spineProgram.program,
      vertexShader: spineProgram.vertexShader,
      fragmentShader: spineProgram.fragmentShader,
      vao: spineVao,
      inputBuffer: spineInputBuffer,
      outputBuffer: spineOutputBuffer,
      transformFeedback: spineTf,
      capacity: 0,
      uniforms: {
        timeMs: gl.getUniformLocation(spineProgram.program, "u_timeMs"),
        periodMs: gl.getUniformLocation(spineProgram.program, "u_periodMs"),
        phase: gl.getUniformLocation(spineProgram.program, "u_phase"),
        amplitude: gl.getUniformLocation(spineProgram.program, "u_amplitude"),
      },
    };

    const resources = { polygon: polygonResources, spine: spineResources };
    rendererContexts.set(gl, resources);
    return resources;
  } catch (error) {
    console.warn("[AnimationGpu] Failed to initialize GPU animation resources", error);
    failedContexts.add(gl);
    return null;
  }
};

export const isAnimationGpuAvailable = (): boolean => {
  if (!activeContext) {
    return false;
  }
  return Boolean(ensureResources(activeContext));
};

export const samplePolygonGpu = (options: {
  vertices: Float32Array;
  vertexCount: number;
  anim: RendererLayerAnimationConfig;
  timeMs: number;
  center: SceneVector2;
  phaseStep: number;
  enableMovementAxis: boolean;
  output: Float32Array;
}): boolean => {
  const gl = activeContext;
  if (!gl) {
    return false;
  }
  const polygon = ensurePolygonResources(gl, options.vertexCount);
  if (!polygon) {
    return false;
  }

  const anim = options.anim;
  const axis = anim.axis ?? "normal";
  const useMovementAxis = options.enableMovementAxis && (axis === "movement-tangent" || axis === "movement-normal");
  const axisType = useMovementAxis ? 2 : axis === "tangent" ? 1 : 0;
  const movementPerp = axis === "movement-normal" ? { x: -1, y: 0 } : { x: 0, y: 1 };
  const amplitudePercent =
    typeof anim.amplitudePercentage === "number" && Number.isFinite(anim.amplitudePercentage)
      ? anim.amplitudePercentage
      : -1;

  gl.bindBuffer(gl.ARRAY_BUFFER, polygon.inputBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, options.vertices);

  gl.useProgram(polygon.program);
  gl.uniform1f(polygon.uniforms.timeMs, options.timeMs);
  gl.uniform1f(polygon.uniforms.periodMs, Math.max(anim.periodMs ?? 1500, 1));
  gl.uniform1f(polygon.uniforms.phase, anim.phase ?? 0);
  gl.uniform1f(polygon.uniforms.amplitude, anim.amplitude ?? 6);
  gl.uniform1f(polygon.uniforms.amplitudePercent, amplitudePercent);
  gl.uniform1f(polygon.uniforms.phaseStep, options.phaseStep);
  gl.uniform1i(polygon.uniforms.animType, anim.type === "pulse" ? 1 : 0);
  gl.uniform1i(polygon.uniforms.axisType, axisType);
  const useVertexPhase = anim.type === "sway" && !useMovementAxis ? 1 : 0;
  gl.uniform1i(polygon.uniforms.useVertexPhase, useVertexPhase);
  gl.uniform2f(polygon.uniforms.center, options.center.x, options.center.y);
  gl.uniform2f(polygon.uniforms.movementPerp, movementPerp.x, movementPerp.y);

  gl.bindVertexArray(polygon.vao);
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, polygon.transformFeedback);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, polygon.outputBuffer);
  gl.enable(gl.RASTERIZER_DISCARD);
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, options.vertexCount);
  gl.endTransformFeedback();
  gl.disable(gl.RASTERIZER_DISCARD);
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
  gl.bindVertexArray(null);

  gl.bindBuffer(gl.ARRAY_BUFFER, polygon.outputBuffer);
  gl.getBufferSubData(gl.ARRAY_BUFFER, 0, options.output);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return true;
};

export const sampleSpineGpu = (options: {
  packedInput: Float32Array;
  vertexCount: number;
  anim: RendererLayerAnimationConfig;
  timeMs: number;
  output: Float32Array;
}): boolean => {
  const gl = activeContext;
  if (!gl) {
    return false;
  }
  const spine = ensureSpineResources(gl, options.vertexCount);
  if (!spine) {
    return false;
  }

  const anim = options.anim;
  gl.bindBuffer(gl.ARRAY_BUFFER, spine.inputBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, options.packedInput);

  gl.useProgram(spine.program);
  gl.uniform1f(spine.uniforms.timeMs, options.timeMs);
  gl.uniform1f(spine.uniforms.periodMs, Math.max(anim.periodMs ?? 1400, 1));
  gl.uniform1f(spine.uniforms.phase, anim.phase ?? 0);
  gl.uniform1f(spine.uniforms.amplitude, anim.amplitude ?? 1.0);

  gl.bindVertexArray(spine.vao);
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, spine.transformFeedback);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, spine.outputBuffer);
  gl.enable(gl.RASTERIZER_DISCARD);
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, options.vertexCount);
  gl.endTransformFeedback();
  gl.disable(gl.RASTERIZER_DISCARD);
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
  gl.bindVertexArray(null);

  gl.bindBuffer(gl.ARRAY_BUFFER, spine.outputBuffer);
  gl.getBufferSubData(gl.ARRAY_BUFFER, 0, options.output);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return true;
};

export const disposeAnimationGpuResources = (gl: WebGL2RenderingContext): void => {
  const resources = rendererContexts.get(gl);
  if (!resources) {
    failedContexts.delete(gl);
    return;
  }
  gl.deleteProgram(resources.polygon.program);
  gl.deleteShader(resources.polygon.vertexShader);
  gl.deleteShader(resources.polygon.fragmentShader);
  gl.deleteVertexArray(resources.polygon.vao);
  gl.deleteBuffer(resources.polygon.inputBuffer);
  gl.deleteBuffer(resources.polygon.outputBuffer);
  gl.deleteTransformFeedback(resources.polygon.transformFeedback);

  gl.deleteProgram(resources.spine.program);
  gl.deleteShader(resources.spine.vertexShader);
  gl.deleteShader(resources.spine.fragmentShader);
  gl.deleteVertexArray(resources.spine.vao);
  gl.deleteBuffer(resources.spine.inputBuffer);
  gl.deleteBuffer(resources.spine.outputBuffer);
  gl.deleteTransformFeedback(resources.spine.transformFeedback);

  rendererContexts.delete(gl);
  failedContexts.delete(gl);
};
