import { SceneVector2 } from "../../../../logic/services/SceneObjectManager";

type ArcInstance = {
  from: SceneVector2;
  to: SceneVector2;
  age: number;
  lifetime: number;
  active: boolean;
};

type ArcBatch = {
  gl: WebGL2RenderingContext;
  vao: WebGLVertexArrayObject | null;
  instanceBuffer: WebGLBuffer | null;
  capacity: number;
  instances: ArcInstance[];
  uniforms: ArcGpuUniforms;
  activeCount: number;
};

type BatchKey = string;

const batchesByKey = new Map<BatchKey, ArcBatch>();

const INSTANCE_COMPONENTS = 6; // from(2), to(2), age(1), lifetime(1)
const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
const instanceScratch = new Float32Array(INSTANCE_COMPONENTS);

export type ArcGpuUniforms = {
  coreColor: Float32Array; // vec4
  blurColor: Float32Array; // vec4
  coreWidth: number;
  blurWidth: number;
  fadeStartMs: number;
  noiseAmplitude: number;
  noiseDensity: number; // cycles per length unit
  oscAmplitude: number;
  oscAngularSpeed: number; // radians per ms
};

const ARC_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_unitPos; // quad: [-0.5..0.5]x[-0.5..0.5]
in vec2 a_from;
in vec2 a_to;
in float a_age;
in float a_lifetime;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_coreWidth;
uniform float u_blurWidth;
uniform float u_noiseAmplitude;
uniform float u_noiseDensity;
uniform float u_oscAmplitude;

out vec2 v_worldPos;
flat out vec2 v_from;
flat out float v_age;
flat out float v_lifetime;
flat out vec2 v_axis;
flat out vec2 v_normal;
flat out float v_length;
flat out float v_noisePhaseScale;
flat out float v_shortScale;

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  v_from = a_from;
  v_age = a_age;
  v_lifetime = a_lifetime;
  float noiseReach = u_noiseAmplitude * (1.0 + u_oscAmplitude * 0.5);
  float halfWidth = 0.5 * u_coreWidth + u_blurWidth + noiseReach;

  // Build a bounding quad around the segment
  vec2 dir = a_to - a_from;
  float len = max(length(dir), 0.0001);
  vec2 axis = dir / len;
  vec2 normal = vec2(-axis.y, axis.x);
  float nominal = max(u_coreWidth + 2.0 * u_blurWidth, 0.0001);
  v_axis = axis;
  v_normal = normal;
  v_length = len;
  v_noisePhaseScale = len * u_noiseDensity * 3.14159265359; // 0.5 * TAU
  v_shortScale = clamp(len / nominal, 0.35, 1.0);

  // a_unitPos.x in [-0.5,0.5] maps along axis from center; a_unitPos.y scales normal
  vec2 center = (a_from + a_to) * 0.5;
  float along = a_unitPos.x * len;
  float side = a_unitPos.y * halfWidth * 2.0; // full height quad
  vec2 world = center + axis * along + normal * side;

  v_worldPos = world;
  gl_Position = vec4(toClip(world), 0.0, 1.0);
}
`;

const ARC_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_worldPos;
flat in vec2 v_from;
flat in float v_age;
flat in float v_lifetime;
flat in vec2 v_axis;
flat in vec2 v_normal;
flat in float v_length;
flat in float v_noisePhaseScale;
flat in float v_shortScale;

uniform vec4 u_coreColor;
uniform vec4 u_blurColor;
uniform float u_coreWidth;
uniform float u_blurWidth;
uniform float u_fadeStartMs;
uniform float u_noiseAmplitude;
uniform float u_oscAmplitude;
uniform float u_oscAngularSpeed;

out vec4 fragColor;

float clamp01(float v){return clamp(v,0.0,1.0);} 

// Optimized noise function - reduced complexity but keeps visual quality
float noise1(float t){
  return sin(t) * 0.7 + sin(t*1.7+1.3)*0.3;
}

void main(){
  float len = max(v_length, 0.0001);
  vec2 rel = v_worldPos - v_from;
  float proj = dot(rel, v_axis);
  float t = clamp(proj / len, 0.0, 1.0);
  float baseOffset = dot(rel, v_normal);

  float phase = t * v_noisePhaseScale;
  float timeOsc = u_oscAngularSpeed * v_age;
  float n = noise1(phase + timeOsc) * u_noiseAmplitude * (1.0 + u_oscAmplitude * 0.5);
  float dist = abs(baseOffset - n);

  float taperFrac = 0.2;
  float endIn  = smoothstep(0.0, taperFrac, t);
  float endOut = smoothstep(0.0, taperFrac, 1.0 - t);
  float endTaper = endIn * endOut;

  float shortScale = v_shortScale;
  float core = (u_coreWidth * 0.5) * max(0.0, endTaper) * shortScale;
  float blur = u_blurWidth * max(0.0, endTaper) * shortScale;
  float safeBlur = max(blur, 0.0001);

  float blend = clamp01((dist - core) / safeBlur);
  float inside = 1.0 - step(core, dist);
  float coreBlend = mix(1.0 - blend, 1.0, inside);

  float fade = 1.0;
  if (u_fadeStartMs < v_lifetime) {
    if (v_age > u_fadeStartMs) {
      float fdur = max(1.0, v_lifetime - u_fadeStartMs);
      float fprog = clamp01((v_age - u_fadeStartMs) / fdur);
      fade = 1.0 - fprog;
    }
  }

  vec3 rgb = mix(u_blurColor.rgb, u_coreColor.rgb, coreBlend);
  float a = mix(u_blurColor.a, u_coreColor.a, coreBlend);
  float finalAlpha = a * coreBlend * fade;

  fragColor = vec4(rgb, finalAlpha);
  if (fragColor.a <= 0.001) discard;
}
`;

interface ArcProgram {
  program: WebGLProgram;
  attributes: { unitPos: number; from: number; to: number; age: number; lifetime: number };
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    coreColor: WebGLUniformLocation | null;
    blurColor: WebGLUniformLocation | null;
    coreWidth: WebGLUniformLocation | null;
    blurWidth: WebGLUniformLocation | null;
    fadeStartMs: WebGLUniformLocation | null;
    noiseAmplitude: WebGLUniformLocation | null;
    noiseDensity: WebGLUniformLocation | null;
    oscAmplitude: WebGLUniformLocation | null;
    oscAngularSpeed: WebGLUniformLocation | null;
  };
}

let cachedProgram: WeakMap<WebGL2RenderingContext, ArcProgram | null> = new WeakMap();
let quadBufferCache: WeakMap<WebGL2RenderingContext, WebGLBuffer | null> = new WeakMap();

const UNIT_QUAD = new Float32Array([
  -0.5, -0.5,
   0.5, -0.5,
  -0.5,  0.5,
   0.5,  0.5,
]);

const compileShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null => {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("Arc shader compile error", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
};

const getProgram = (gl: WebGL2RenderingContext): ArcProgram | null => {
  const existing = cachedProgram.get(gl);
  if (existing !== undefined) return existing;
  const vs = compileShader(gl, gl.VERTEX_SHADER, ARC_VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, ARC_FRAGMENT_SHADER);
  if (!vs || !fs) { cachedProgram.set(gl, null); return null; }
  const prog = gl.createProgram();
  if (!prog) { cachedProgram.set(gl, null); return null; }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("Arc program link error", gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    cachedProgram.set(gl, null);
    return null;
  }
  const attributes = {
    unitPos: gl.getAttribLocation(prog, "a_unitPos"),
    from: gl.getAttribLocation(prog, "a_from"),
    to: gl.getAttribLocation(prog, "a_to"),
    age: gl.getAttribLocation(prog, "a_age"),
    lifetime: gl.getAttribLocation(prog, "a_lifetime"),
  };
  const uniforms = {
    cameraPosition: gl.getUniformLocation(prog, "u_cameraPosition"),
    viewportSize: gl.getUniformLocation(prog, "u_viewportSize"),
    coreColor: gl.getUniformLocation(prog, "u_coreColor"),
    blurColor: gl.getUniformLocation(prog, "u_blurColor"),
    coreWidth: gl.getUniformLocation(prog, "u_coreWidth"),
    blurWidth: gl.getUniformLocation(prog, "u_blurWidth"),
    fadeStartMs: gl.getUniformLocation(prog, "u_fadeStartMs"),
    noiseAmplitude: gl.getUniformLocation(prog, "u_noiseAmplitude"),
    noiseDensity: gl.getUniformLocation(prog, "u_noiseDensity"),
    oscAmplitude: gl.getUniformLocation(prog, "u_oscAmplitude"),
    oscAngularSpeed: gl.getUniformLocation(prog, "u_oscAngularSpeed"),
  };
  const bundle: ArcProgram = { program: prog, attributes, uniforms };
  cachedProgram.set(gl, bundle);
  return bundle;
};

const getQuadBuffer = (gl: WebGL2RenderingContext): WebGLBuffer | null => {
  let buf = quadBufferCache.get(gl) ?? null;
  if (buf) return buf;
  buf = gl.createBuffer();
  if (!buf) { quadBufferCache.set(gl, null); return null; }
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  quadBufferCache.set(gl, buf);
  return buf;
};

export const ensureArcBatch = (
  gl: WebGL2RenderingContext,
  key: BatchKey,
  capacity: number,
  uniformsInit: ArcGpuUniforms
): ArcBatch | null => {
  const existing = batchesByKey.get(key);
  if (existing) {
    // If context changed, dispose stale VAOs and recreate for this GL
    if (existing.gl !== gl) {
      disposeArcBatch(existing);
      batchesByKey.delete(key);
    } else if (capacity <= existing.capacity) {
      return existing;
    } else {
      // grow capacity: recreate buffer/vao
      disposeArcBatch(existing);
      batchesByKey.delete(key);
    }
  }

  const program = getProgram(gl);
  const quad = getQuadBuffer(gl);
  if (!program || !quad) return null;

  const instanceBuffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  if (!instanceBuffer || !vao) {
    if (instanceBuffer) gl.deleteBuffer(instanceBuffer);
    if (vao) gl.deleteVertexArray(vao);
    return null;
  }

  gl.bindVertexArray(vao);

  // unit quad attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(program.attributes.unitPos);
  gl.vertexAttribPointer(program.attributes.unitPos, 2, gl.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT, 0);
  gl.vertexAttribDivisor(program.attributes.unitPos, 0);

  // instance buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);

  const enable = (loc: number, size: number, offsetFloats: number) => {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, INSTANCE_STRIDE, offsetFloats * Float32Array.BYTES_PER_ELEMENT);
    gl.vertexAttribDivisor(loc, 1);
  };
  enable(program.attributes.from, 2, 0);
  enable(program.attributes.to, 2, 2);
  enable(program.attributes.age, 1, 4);
  enable(program.attributes.lifetime, 1, 5);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const uniforms: ArcGpuUniforms = { ...uniformsInit };
  const batch: ArcBatch = {
    gl,
    vao,
    instanceBuffer,
    capacity,
    instances: new Array(capacity).fill(null).map(() => ({ from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, age: 0, lifetime: 0, active: false })),
    uniforms,
    activeCount: 0,
  };
  batchesByKey.set(key, batch);
  return batch;
};

export const disposeArcBatch = (batch: ArcBatch): void => {
  if (batch.instanceBuffer) batch.gl.deleteBuffer(batch.instanceBuffer);
  if (batch.vao) batch.gl.deleteVertexArray(batch.vao);
};

export const writeArcInstance = (batch: ArcBatch, index: number, instance: ArcInstance): void => {
  if (!batch.instanceBuffer) return;
  const gl = batch.gl;
  const arr = instanceScratch;
  arr[0] = instance.from.x; arr[1] = instance.from.y;
  arr[2] = instance.to.x;   arr[3] = instance.to.y;
  arr[4] = Math.max(0, instance.age);
  arr[5] = Math.max(0, instance.lifetime);
  gl.bindBuffer(gl.ARRAY_BUFFER, batch.instanceBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, index * INSTANCE_STRIDE, arr);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  batch.instances[index] = instance;
};

export const setArcBatchActiveCount = (batch: ArcBatch, count: number): void => {
  batch.activeCount = Math.max(0, Math.min(count, batch.capacity));
};

export const renderArcBatches = (
  gl: WebGL2RenderingContext,
  cameraPosition: SceneVector2,
  viewportSize: { width: number; height: number }
): void => {
  if (batchesByKey.size === 0) return;
  const program = getProgram(gl);
  if (!program) return;
  gl.useProgram(program.program);
  
  // Set camera uniforms once for all batches
  if (program.uniforms.cameraPosition) gl.uniform2f(program.uniforms.cameraPosition, cameraPosition.x, cameraPosition.y);
  if (program.uniforms.viewportSize) gl.uniform2f(program.uniforms.viewportSize, viewportSize.width, viewportSize.height);

  batchesByKey.forEach((batch, key) => {
    if (batch.gl !== gl) {
      // Stale batch from previous GL context; clean it up lazily
      disposeArcBatch(batch);
      batchesByKey.delete(key);
      return;
    }
    const vao = batch.vao;
    if (!vao || batch.activeCount <= 0) return;
    const u = batch.uniforms;
    
    // Set uniforms for this batch
    if (program.uniforms.coreColor) gl.uniform4fv(program.uniforms.coreColor, u.coreColor);
    if (program.uniforms.blurColor) gl.uniform4fv(program.uniforms.blurColor, u.blurColor);
    if (program.uniforms.coreWidth) gl.uniform1f(program.uniforms.coreWidth, u.coreWidth);
    if (program.uniforms.blurWidth) gl.uniform1f(program.uniforms.blurWidth, u.blurWidth);
    if (program.uniforms.fadeStartMs) gl.uniform1f(program.uniforms.fadeStartMs, u.fadeStartMs);
    if (program.uniforms.noiseAmplitude) gl.uniform1f(program.uniforms.noiseAmplitude, u.noiseAmplitude);
    if (program.uniforms.noiseDensity) gl.uniform1f(program.uniforms.noiseDensity, u.noiseDensity);
    if (program.uniforms.oscAmplitude) gl.uniform1f(program.uniforms.oscAmplitude, u.oscAmplitude);
    if (program.uniforms.oscAngularSpeed) gl.uniform1f(program.uniforms.oscAngularSpeed, u.oscAngularSpeed);

    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, batch.activeCount);
  });

  gl.bindVertexArray(null);
};



