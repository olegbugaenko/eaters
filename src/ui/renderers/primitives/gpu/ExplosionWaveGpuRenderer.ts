import { SceneVector2 } from "../../../../logic/services/SceneObjectManager";
import {
  ParticleEmitterGpuRenderUniforms,
  getParticleRenderResources,
  registerParticleEmitterHandle,
  unregisterParticleEmitterHandle,
} from "./ParticleEmitterGpuRenderer";

type WaveInstance = {
  position: SceneVector2;
  size: number; // diameter in world units
  age: number;
  lifetime: number;
  active: boolean;
};

type WaveBatch = {
  gl: WebGL2RenderingContext;
  vao: WebGLVertexArrayObject | null;
  instanceBuffer: WebGLBuffer | null;
  capacity: number;
  instances: WaveInstance[];
  uniforms: ParticleEmitterGpuRenderUniforms;
  handle: {
    gl: WebGL2RenderingContext;
    capacity: number;
    getCurrentVao: () => WebGLVertexArrayObject | null;
    uniforms: ParticleEmitterGpuRenderUniforms;
    activeCount: number;
  };
};

type FillKey = string; // serialized fill options key

const INSTANCE_COMPONENTS = 6; // position(2) + size(1) + age(1) + lifetime(1) + isActive(1)
const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;

const batchesByKey = new Map<FillKey, WaveBatch>();

export type WaveUniformConfig = Omit<
  ParticleEmitterGpuRenderUniforms,
  | "minParticleSize"
  | "shape"
  | "stopOffsets"
  | "stopColor0"
  | "stopColor1"
  | "stopColor2"
  | "linearStart"
  | "linearEnd"
  | "radialOffset"
> & {
  stopOffsets: Float32Array;
  stopColor0: Float32Array;
  stopColor1: Float32Array;
  stopColor2: Float32Array;
  linearStart?: SceneVector2;
  linearEnd?: SceneVector2;
  radialOffset?: SceneVector2;
};

export const ensureWaveBatch = (
  gl: WebGL2RenderingContext,
  key: FillKey,
  capacity: number,
  uniformsInit: WaveUniformConfig
): WaveBatch | null => {
  const existing = batchesByKey.get(key);
  if (existing) {
    // If the GL context changed, recreate the batch for the new context
    if (existing.gl !== gl) {
      disposeWaveBatch(existing);
      batchesByKey.delete(key);
    } else if (capacity <= existing.capacity) {
      return existing;
    } else {
      // grow capacity: recreate buffer/vao
      disposeWaveBatch(existing);
      batchesByKey.delete(key);
    }
  }

  const resources = getParticleRenderResources(gl);
  if (!resources) {
    return null;
  }

  const instanceBuffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  if (!instanceBuffer || !vao) {
    if (instanceBuffer) gl.deleteBuffer(instanceBuffer);
    if (vao) gl.deleteVertexArray(vao);
    return null;
  }

  gl.bindVertexArray(vao);

  // quad positions come from shared quad buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, resources.quadBuffer);
  gl.enableVertexAttribArray(resources.program.attributes.unitPosition);
  gl.vertexAttribPointer(
    resources.program.attributes.unitPosition,
    2,
    gl.FLOAT,
    false,
    2 * Float32Array.BYTES_PER_ELEMENT,
    0
  );
  gl.vertexAttribDivisor(resources.program.attributes.unitPosition, 0);

  // bind instance buffer for per-instance attributes
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);

  // a_position (vec2)
  gl.enableVertexAttribArray(resources.program.attributes.position);
  gl.vertexAttribPointer(
    resources.program.attributes.position,
    2,
    gl.FLOAT,
    false,
    INSTANCE_STRIDE,
    0
  );
  gl.vertexAttribDivisor(resources.program.attributes.position, 1);

  // a_size (float)
  gl.enableVertexAttribArray(resources.program.attributes.size);
  gl.vertexAttribPointer(
    resources.program.attributes.size,
    1,
    gl.FLOAT,
    false,
    INSTANCE_STRIDE,
    2 * Float32Array.BYTES_PER_ELEMENT
  );
  gl.vertexAttribDivisor(resources.program.attributes.size, 1);

  // a_age (float)
  gl.enableVertexAttribArray(resources.program.attributes.age);
  gl.vertexAttribPointer(
    resources.program.attributes.age,
    1,
    gl.FLOAT,
    false,
    INSTANCE_STRIDE,
    3 * Float32Array.BYTES_PER_ELEMENT
  );
  gl.vertexAttribDivisor(resources.program.attributes.age, 1);

  // a_lifetime (float)
  gl.enableVertexAttribArray(resources.program.attributes.lifetime);
  gl.vertexAttribPointer(
    resources.program.attributes.lifetime,
    1,
    gl.FLOAT,
    false,
    INSTANCE_STRIDE,
    4 * Float32Array.BYTES_PER_ELEMENT
  );
  gl.vertexAttribDivisor(resources.program.attributes.lifetime, 1);

  // a_isActive (float)
  gl.enableVertexAttribArray(resources.program.attributes.isActive);
  gl.vertexAttribPointer(
    resources.program.attributes.isActive,
    1,
    gl.FLOAT,
    false,
    INSTANCE_STRIDE,
    5 * Float32Array.BYTES_PER_ELEMENT
  );
  gl.vertexAttribDivisor(resources.program.attributes.isActive, 1);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const uniforms: ParticleEmitterGpuRenderUniforms = {
    fillType: uniformsInit.fillType,
    stopCount: uniformsInit.stopCount,
    stopOffsets: uniformsInit.stopOffsets,
    stopColor0: uniformsInit.stopColor0,
    stopColor1: uniformsInit.stopColor1,
    stopColor2: uniformsInit.stopColor2,
    noiseColorAmplitude: uniformsInit.noiseColorAmplitude,
    noiseAlphaAmplitude: uniformsInit.noiseAlphaAmplitude,
    noiseScale: uniformsInit.noiseScale,
    hasLinearStart: uniformsInit.hasLinearStart ?? false,
    linearStart: uniformsInit.linearStart ?? { x: 0, y: 0 },
    hasLinearEnd: uniformsInit.hasLinearEnd ?? false,
    linearEnd: uniformsInit.linearEnd ?? { x: 0, y: 0 },
    hasRadialOffset: uniformsInit.hasRadialOffset ?? false,
    radialOffset: uniformsInit.radialOffset ?? { x: 0, y: 0 },
    hasExplicitRadius: uniformsInit.hasExplicitRadius ?? false,
    explicitRadius: uniformsInit.explicitRadius ?? 0,
    fadeStartMs: uniformsInit.fadeStartMs,
    defaultLifetimeMs: uniformsInit.defaultLifetimeMs,
    shape: 1, // circle
    minParticleSize: 0.0001,
    lengthMultiplier: 1,
    alignToVelocity: false,
  };

  const batch: WaveBatch = {
    gl,
    vao,
    instanceBuffer,
    capacity,
    instances: new Array(capacity).fill(null).map(() => ({
      position: { x: 0, y: 0 },
      size: 0,
      age: 0,
      lifetime: 0,
      active: false,
    })),
    uniforms,
    handle: {
      gl,
      capacity,
      uniforms,
      getCurrentVao: () => vao,
      activeCount: 0,
    },
  };

  registerParticleEmitterHandle(batch.handle);
  batchesByKey.set(key, batch);
  return batch;
};

export const disposeWaveBatch = (batch: WaveBatch): void => {
  unregisterParticleEmitterHandle(batch.handle);
  if (batch.instanceBuffer) batch.gl.deleteBuffer(batch.instanceBuffer);
  if (batch.vao) batch.gl.deleteVertexArray(batch.vao);
};

export const writeWaveInstance = (
  batch: WaveBatch,
  index: number,
  instance: WaveInstance
): void => {
  if (!batch.instanceBuffer) return;
  const gl = batch.gl;
  const scratch = new Float32Array(INSTANCE_COMPONENTS);
  scratch[0] = instance.position.x;
  scratch[1] = instance.position.y;
  scratch[2] = Math.max(0, instance.size);
  scratch[3] = Math.max(0, instance.age);
  scratch[4] = Math.max(0, instance.lifetime);
  scratch[5] = instance.active ? 1 : 0;
  gl.bindBuffer(gl.ARRAY_BUFFER, batch.instanceBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, index * INSTANCE_STRIDE, scratch);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  batch.instances[index] = instance;
};

export const setWaveBatchActiveCount = (batch: WaveBatch, count: number): void => {
  batch.handle.activeCount = Math.max(0, Math.min(count, batch.capacity));
};

export const getWaveBatch = (key: FillKey): WaveBatch | undefined => batchesByKey.get(key);

export const resetAllWaveBatches = (): void => {
  if (batchesByKey.size === 0) {
    return;
  }

  const entries = Array.from(batchesByKey.entries());
  entries.forEach(([key, batch]) => {
    try {
      batch.instances.length = 0;
      disposeWaveBatch(batch);
    } finally {
      batchesByKey.delete(key);
    }
  });
};


