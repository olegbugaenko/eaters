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
  disposed: boolean;
};

type FillKey = string; // serialized fill options key

const INSTANCE_COMPONENTS = 6; // position(2) + size(1) + age(1) + lifetime(1) + isActive(1)
const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;

const batchesByKey = new Map<FillKey, WaveBatch>();

const createBlankInstances = (capacity: number): WaveInstance[] =>
  Array.from({ length: capacity }, () => ({
    position: { x: 0, y: 0 },
    size: 0,
    age: 0,
    lifetime: 0,
    active: false,
  }));

const resizeWaveBatch = (batch: WaveBatch, capacity: number): boolean => {
  const gl = batch.gl;
  const resources = getParticleRenderResources(gl);
  if (!resources) {
    return false;
  }

  const oldInstances = batch.instances.slice();
  const oldBuffer = batch.instanceBuffer;
  const oldVao = batch.vao;

  const instanceBuffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  if (!instanceBuffer || !vao) {
    if (instanceBuffer) gl.deleteBuffer(instanceBuffer);
    if (vao) gl.deleteVertexArray(vao);
    return false;
  }

  gl.bindVertexArray(vao);

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

  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);

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

  batch.instanceBuffer = instanceBuffer;
  batch.vao = vao;
  batch.capacity = capacity;
  batch.handle.capacity = capacity;
  batch.instances = createBlankInstances(capacity);
  batch.disposed = false;

  let activeCount = 0;
  const copyCount = Math.min(oldInstances.length, capacity);
  for (let i = 0; i < copyCount; i += 1) {
    const inst = oldInstances[i];
    if (!inst) {
      continue;
    }
    if (inst.active) {
      activeCount += 1;
    }
    writeWaveInstance(batch, i, inst);
  }
  setWaveBatchActiveCount(batch, activeCount);

  if (oldBuffer) gl.deleteBuffer(oldBuffer);
  if (oldVao) gl.deleteVertexArray(oldVao);

  return true;
};

export type WaveUniformConfig = Omit<
  ParticleEmitterGpuRenderUniforms,
  | "minParticleSize"
  | "shape"
  | "stopOffsets"
  | "stopColor0"
  | "stopColor1"
  | "stopColor2"
  | "stopColor3"
  | "stopColor4"
  | "linearStart"
  | "linearEnd"
  | "radialOffset"
  | "sizeGrowthRate"
> & {
  stopOffsets: Float32Array;
  stopColor0: Float32Array;
  stopColor1: Float32Array;
  stopColor2: Float32Array;
  stopColor3: Float32Array;
  stopColor4: Float32Array;
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
    if (existing.gl !== gl || existing.disposed) {
      disposeWaveBatch(existing);
      batchesByKey.delete(key);
    } else if (capacity <= existing.capacity) {
      return existing;
    } else {
      // grow capacity in-place so shared handles remain valid
      if (resizeWaveBatch(existing, capacity)) {
        return existing;
      }
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
    stopColor3: uniformsInit.stopColor3,
    stopColor4: uniformsInit.stopColor4,
    noiseColorAmplitude: uniformsInit.noiseColorAmplitude,
    noiseAlphaAmplitude: uniformsInit.noiseAlphaAmplitude,
    noiseScale: uniformsInit.noiseScale,
    fiberColorAmplitude: uniformsInit.fiberColorAmplitude,
    fiberAlphaAmplitude: uniformsInit.fiberAlphaAmplitude,
    fiberDensity: uniformsInit.fiberDensity,
    fiberWidth: uniformsInit.fiberWidth,
    fiberClarity: uniformsInit.fiberClarity,
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
    sizeGrowthRate: 1.0,
  };

  const batch: WaveBatch = {
    gl,
    vao,
    instanceBuffer,
    capacity,
    instances: createBlankInstances(capacity),
    uniforms,
    handle: {
      gl,
      capacity,
      uniforms,
      getCurrentVao: () => vao,
      activeCount: 0,
    },
    disposed: false,
  };

  registerParticleEmitterHandle(batch.handle);
  batchesByKey.set(key, batch);
  return batch;
};

export const disposeWaveBatch = (batch: WaveBatch): void => {
  if (batch.disposed) {
    return;
  }
  batch.disposed = true;
  unregisterParticleEmitterHandle(batch.handle);
  const { instanceBuffer, vao } = batch;
  batch.handle.activeCount = 0;
  batch.handle.capacity = 0;
  batch.instances = [];
  batch.instanceBuffer = null;
  batch.vao = null;
  batch.capacity = 0;
  if (instanceBuffer) batch.gl.deleteBuffer(instanceBuffer);
  if (vao) batch.gl.deleteVertexArray(vao);
};

export const writeWaveInstance = (
  batch: WaveBatch,
  index: number,
  instance: WaveInstance
): void => {
  if (!batch.instanceBuffer || batch.disposed) return;
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
  if (batch.disposed) {
    batch.handle.activeCount = 0;
    return;
  }
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


