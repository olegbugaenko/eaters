import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneObjectInstance,
  SceneVector2,
} from "../../../logic/services/SceneObjectManager";
import {
  ParticleEmitterShape,
  cloneSceneFill,
  sanitizeSceneColor,
} from "../../../logic/services/particles/ParticleEmitterShared";
import {
  DynamicPrimitive,
  FILL_COMPONENTS,
  FILL_INFO_COMPONENTS,
  FILL_PARAMS0_COMPONENTS,
  FILL_PARAMS1_COMPONENTS,
  MAX_GRADIENT_STOPS,
  STOP_COLOR_COMPONENTS,
  STOP_OFFSETS_COMPONENTS,
  VERTEX_COMPONENTS,
} from "../objects/ObjectRenderer";
import { copyFillComponents, writeFillVertexComponents } from "./fill";
import { getParticleEmitterGlContext } from "./gpuContext";

export interface ParticleEmitterBaseConfig {
  particlesPerSecond: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  sizeRange: { min: number; max: number };
  offset: SceneVector2;
  color: SceneColor;
  fill?: SceneFill;
  shape: ParticleEmitterShape;
  emissionDurationMs?: number;
  capacity: number;
}

export interface ParticleEmitterParticleState {
  position: SceneVector2;
  velocity: SceneVector2;
  ageMs: number;
  lifetimeMs: number;
  size: number;
}

interface ParticleEmitterState<Config extends ParticleEmitterBaseConfig> {
  config: Config | null;
  particles: ParticleEmitterParticleState[];
  spawnAccumulator: number;
  lastTimestamp: number;
  data: Float32Array;
  capacity: number;
  signature: string;
  ageMs: number;
  gpu?: ParticleEmitterGpuState;
}

export interface ParticleEmitterPrimitiveOptions<
  Config extends ParticleEmitterBaseConfig
> {
  getConfig(instance: SceneObjectInstance): Config | null;
  getOrigin(
    instance: SceneObjectInstance,
    config: Config
  ): SceneVector2;
  spawnParticle(
    origin: SceneVector2,
    instance: SceneObjectInstance,
    config: Config
  ): ParticleEmitterParticleState;
  serializeConfig?(config: Config): string;
  updateParticle?(
    particle: ParticleEmitterParticleState,
    deltaMs: number,
    instance: SceneObjectInstance,
    config: Config
  ): boolean;
}

export interface ParticleEmitterSanitizerOptions {
  defaultColor?: SceneColor;
  defaultOffset?: SceneVector2;
  minCapacity?: number;
  defaultShape?: ParticleEmitterShape;
}

const VERTICES_PER_PARTICLE = 6;
const MIN_PARTICLE_SIZE = 0.0001;
const MAX_DELTA_MS = 250;
const PARTICLE_FILL_SCRATCH = new Float32Array(FILL_COMPONENTS);
const INACTIVE_PARTICLE_FILL = new Float32Array(FILL_COMPONENTS);
const PARTICLE_STATE_COMPONENTS = 8;
const PARTICLE_STATE_BYTES =
  PARTICLE_STATE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
const PARTICLE_POSITION_X_INDEX = 0;
const PARTICLE_POSITION_Y_INDEX = 1;
const PARTICLE_VELOCITY_X_INDEX = 2;
const PARTICLE_VELOCITY_Y_INDEX = 3;
const PARTICLE_AGE_INDEX = 4;
const PARTICLE_LIFETIME_INDEX = 5;
const PARTICLE_SIZE_INDEX = 6;
const PARTICLE_ACTIVE_INDEX = 7;

interface ParticleEmitterGpuState {
  gl: WebGL2RenderingContext;
  buffers: [WebGLBuffer, WebGLBuffer];
  transformFeedbacks: [WebGLTransformFeedback, WebGLTransformFeedback];
  vaos: [WebGLVertexArrayObject, WebGLVertexArrayObject];
  program: ParticleSimulationProgram;
  currentBufferIndex: 0 | 1;
  stateData: Float32Array;
  spawnScratch: Float32Array;
}

interface ParticleSimulationProgram {
  program: WebGLProgram;
  deltaUniform: WebGLUniformLocation | null;
  attributes: {
    position: number;
    velocity: number;
    age: number;
    lifetime: number;
    size: number;
    active: number;
  };
}

export const createParticleEmitterPrimitive = <
  Config extends ParticleEmitterBaseConfig
>(
  instance: SceneObjectInstance,
  options: ParticleEmitterPrimitiveOptions<Config>
): DynamicPrimitive | null => {
  const initialConfig = options.getConfig(instance);
  if (!initialConfig) {
    return null;
  }

  let state = createParticleEmitterState(instance, initialConfig, options);

  const primitive: DynamicPrimitive = {
    get data() {
      return state.data;
    },
    update(target: SceneObjectInstance) {
      const nextConfig = options.getConfig(target);
      if (!nextConfig) {
        if (state.data.length === 0) {
          return null;
        }
        destroyParticleEmitterGpuState(state);
        state = createEmptyParticleEmitterState();
        return state.data;
      }

      const nextSignature = serializeConfig(nextConfig, options);
      if (state.signature !== nextSignature || state.capacity !== nextConfig.capacity) {
        destroyParticleEmitterGpuState(state);
        state = createParticleEmitterState(target, nextConfig, options);
        return state.data;
      }

      state.config = nextConfig;
      state.capacity = nextConfig.capacity;
      state.signature = nextSignature;

      const now = getNowMs();
      const deltaMs = Math.max(0, Math.min(now - state.lastTimestamp, MAX_DELTA_MS));
      state.lastTimestamp = now;

      advanceParticleEmitterState(state, target, deltaMs, options);
      return state.data;
    },
  };

  return primitive;
};

const createParticleEmitterState = <Config extends ParticleEmitterBaseConfig>(
  instance: SceneObjectInstance,
  config: Config,
  options: ParticleEmitterPrimitiveOptions<Config>
): ParticleEmitterState<Config> => {
  const capacity = Math.max(0, config.capacity);
  const state: ParticleEmitterState<Config> = {
    config,
    particles: [],
    spawnAccumulator: 0,
    lastTimestamp: getNowMs(),
    capacity,
    data: new Float32Array(capacity * VERTICES_PER_PARTICLE * VERTEX_COMPONENTS),
    signature: serializeConfig(config, options),
    ageMs: 0,
  };
  if (capacity > 0) {
    const gl = getParticleEmitterGlContext();
    if (gl) {
      const gpu = createParticleEmitterGpuState(gl, capacity);
      if (gpu) {
        state.gpu = gpu;
      }
    }
  }
  writeEmitterBuffer(state, config, options.getOrigin(instance, config));
  return state;
};

const createEmptyParticleEmitterState = <
  Config extends ParticleEmitterBaseConfig
>(): ParticleEmitterState<Config> => ({
  config: null,
  particles: [],
  spawnAccumulator: 0,
  lastTimestamp: getNowMs(),
  capacity: 0,
  data: new Float32Array(0),
  signature: "",
  ageMs: 0,
});

const advanceParticleEmitterState = <Config extends ParticleEmitterBaseConfig>(
  state: ParticleEmitterState<Config>,
  instance: SceneObjectInstance,
  deltaMs: number,
  options: ParticleEmitterPrimitiveOptions<Config>
): void => {
  const config = state.config;
  if (!config || state.capacity <= 0) {
    state.particles = [];
    state.data = new Float32Array(0);
    state.capacity = 0;
    state.ageMs = 0;
    if (state.gpu) {
      resetParticleEmitterGpuState(state.gpu);
    }
    return;
  }

  if (state.gpu) {
    advanceParticleEmitterStateGpu(state, instance, deltaMs, options);
    return;
  }

  const spawnRate = config.particlesPerSecond / 1000;
  const emissionDuration = getEmissionDuration(config);
  const previousAge = state.ageMs;
  state.ageMs = previousAge + deltaMs;

  const activeDelta = computeActiveDelta(previousAge, deltaMs, emissionDuration);

  if (activeDelta > 0 && spawnRate > 0) {
    state.spawnAccumulator += spawnRate * activeDelta;
  } else {
    state.spawnAccumulator = 0;
  }

  const origin = options.getOrigin(instance, config);

  if (state.capacity > 0) {
    const availableSlots = Math.max(0, state.capacity - state.particles.length);
    const spawnBudget = Math.min(Math.floor(state.spawnAccumulator), availableSlots);
    if (spawnBudget > 0) {
      for (let i = 0; i < spawnBudget; i += 1) {
        state.particles.push(options.spawnParticle(origin, instance, config));
      }
      state.spawnAccumulator -= spawnBudget;
    }
    const remainingCapacity = Math.max(0, state.capacity - state.particles.length);
    state.spawnAccumulator = Math.min(state.spawnAccumulator, remainingCapacity);
  } else {
    state.spawnAccumulator = 0;
  }

  const updateParticle = options.updateParticle ?? defaultUpdateParticle;
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < state.particles.length; readIndex += 1) {
    const particle = state.particles[readIndex]!;
    const keep = updateParticle(particle, deltaMs, instance, config);
    if (!keep) {
      continue;
    }
    if (writeIndex !== readIndex) {
      state.particles[writeIndex] = particle;
    }
    writeIndex += 1;
  }
  if (writeIndex < state.particles.length) {
    state.particles.length = writeIndex;
  }

  writeEmitterBuffer(state, config, origin);
};

const defaultUpdateParticle = (
  particle: ParticleEmitterParticleState,
  deltaMs: number
): boolean => {
  particle.ageMs += deltaMs;
  if (particle.ageMs >= particle.lifetimeMs) {
    return false;
  }
  particle.position.x += particle.velocity.x * deltaMs;
  particle.position.y += particle.velocity.y * deltaMs;
  return true;
};

const advanceParticleEmitterStateGpu = <
  Config extends ParticleEmitterBaseConfig
>(
  state: ParticleEmitterState<Config>,
  instance: SceneObjectInstance,
  deltaMs: number,
  options: ParticleEmitterPrimitiveOptions<Config>
): void => {
  const config = state.config;
  const gpu = state.gpu;
  if (!config || !gpu) {
    return;
  }

  const spawnRate = config.particlesPerSecond / 1000;
  const emissionDuration = getEmissionDuration(config);
  const previousAge = state.ageMs;
  state.ageMs = previousAge + deltaMs;

  const activeDelta = computeActiveDelta(previousAge, deltaMs, emissionDuration);

  if (activeDelta > 0 && spawnRate > 0) {
    state.spawnAccumulator += spawnRate * activeDelta;
  } else {
    state.spawnAccumulator = 0;
  }

  const origin = options.getOrigin(instance, config);
  const freeSlots: number[] = [];
  for (let i = 0; i < state.capacity; i += 1) {
    const base = i * PARTICLE_STATE_COMPONENTS;
    const active = gpu.stateData[base + PARTICLE_ACTIVE_INDEX] ?? 0;
    if (active < 0.5) {
      freeSlots.push(i);
    }
  }

  const spawnBudget = Math.min(Math.floor(state.spawnAccumulator), freeSlots.length);
  if (spawnBudget > 0) {
    const gl = gpu.gl;
    const buffers = gpu.buffers;
    const scratch = gpu.spawnScratch;
    for (let i = 0; i < spawnBudget; i += 1) {
      const slot = freeSlots[i]!;
      const particle = options.spawnParticle(origin, instance, config);
      scratch[PARTICLE_POSITION_X_INDEX] = particle.position.x;
      scratch[PARTICLE_POSITION_Y_INDEX] = particle.position.y;
      scratch[PARTICLE_VELOCITY_X_INDEX] = particle.velocity.x;
      scratch[PARTICLE_VELOCITY_Y_INDEX] = particle.velocity.y;
      scratch[PARTICLE_AGE_INDEX] = 0;
      scratch[PARTICLE_LIFETIME_INDEX] = particle.lifetimeMs;
      scratch[PARTICLE_SIZE_INDEX] = Math.max(particle.size, 0);
      scratch[PARTICLE_ACTIVE_INDEX] = 1;
      for (let b = 0; b < buffers.length; b += 1) {
        const buffer = buffers[b];
        if (!buffer) {
          continue;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferSubData(
          gl.ARRAY_BUFFER,
          slot * PARTICLE_STATE_BYTES,
          scratch
        );
      }
      const base = slot * PARTICLE_STATE_COMPONENTS;
      for (let j = 0; j < PARTICLE_STATE_COMPONENTS; j += 1) {
        gpu.stateData[base + j] = scratch[j] ?? 0;
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    state.spawnAccumulator -= spawnBudget;
  }

  const remainingCapacity = Math.max(0, freeSlots.length - spawnBudget);
  state.spawnAccumulator = Math.min(state.spawnAccumulator, remainingCapacity);

  if (deltaMs > 0) {
    stepParticleSimulation(gpu, state.capacity, deltaMs);
  }

  const gl = gpu.gl;
  const currentBuffer = gpu.buffers[gpu.currentBufferIndex];
  if (currentBuffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, currentBuffer);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, gpu.stateData);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  writeEmitterBufferFromGpuState(state, config, origin);
};

const writeEmitterBuffer = <Config extends ParticleEmitterBaseConfig>(
  state: ParticleEmitterState<Config>,
  config: Config,
  origin: SceneVector2
): void => {
  if (state.gpu) {
    writeEmitterBufferFromGpuState(state, config, origin);
    return;
  }

  const capacity = Math.max(0, state.capacity);
  const requiredLength = capacity * VERTICES_PER_PARTICLE * VERTEX_COMPONENTS;
  if (state.data.length !== requiredLength) {
    state.data = new Float32Array(requiredLength);
  }
  const buffer = state.data;
  const activeCount = Math.min(state.particles.length, capacity);
  let offset = 0;
  const fill = resolveParticleFill(config);

  const inactiveComponents = writeFillVertexComponents(INACTIVE_PARTICLE_FILL, {
    fill,
    center: origin,
    rotation: 0,
    size: { width: MIN_PARTICLE_SIZE, height: MIN_PARTICLE_SIZE },
    radius: MIN_PARTICLE_SIZE / 2,
  });
  applyParticleAlpha(inactiveComponents, 0);

  for (let i = 0; i < activeCount; i += 1) {
    const particle = state.particles[i]!;
    const size = Math.max(particle.size, 0);
    const effectiveSize = Math.max(size, MIN_PARTICLE_SIZE);
    const halfSize = effectiveSize / 2;
    const center = particle.position;
    const fillComponents = writeFillVertexComponents(PARTICLE_FILL_SCRATCH, {
      fill,
      center,
      rotation: 0,
      size: { width: effectiveSize, height: effectiveSize },
      radius: effectiveSize / 2,
    });
    applyParticleAlpha(fillComponents, computeParticleAlpha(particle, config));
    offset = writeParticleQuad(
      buffer,
      offset,
      center.x - halfSize,
      center.y - halfSize,
      center.x + halfSize,
      center.y + halfSize,
      fillComponents
    );
  }

  if (activeCount < capacity) {
    for (let i = activeCount; i < capacity; i += 1) {
      offset = writeParticleQuad(
        buffer,
        offset,
        origin.x,
        origin.y,
        origin.x,
        origin.y,
        inactiveComponents
      );
    }
  }
};

const writeEmitterBufferFromGpuState = <
  Config extends ParticleEmitterBaseConfig
>(
  state: ParticleEmitterState<Config>,
  config: Config,
  origin: SceneVector2
): void => {
  const gpu = state.gpu;
  if (!gpu) {
    return;
  }

  const capacity = Math.max(0, state.capacity);
  const requiredLength = capacity * VERTICES_PER_PARTICLE * VERTEX_COMPONENTS;
  if (state.data.length !== requiredLength) {
    state.data = new Float32Array(requiredLength);
  }

  const buffer = state.data;
  const fill = resolveParticleFill(config);
  const inactiveComponents = writeFillVertexComponents(INACTIVE_PARTICLE_FILL, {
    fill,
    center: origin,
    rotation: 0,
    size: { width: MIN_PARTICLE_SIZE, height: MIN_PARTICLE_SIZE },
    radius: MIN_PARTICLE_SIZE / 2,
  });
  applyParticleAlpha(inactiveComponents, 0);

  const stateData = gpu.stateData;
  let offset = 0;
  let renderedParticles = 0;

  for (let i = 0; i < capacity; i += 1) {
    const base = i * PARTICLE_STATE_COMPONENTS;
    const active = stateData[base + PARTICLE_ACTIVE_INDEX] ?? 0;
    if (active < 0.5) {
      continue;
    }

    renderedParticles += 1;
    const posX = stateData[base + PARTICLE_POSITION_X_INDEX] ?? origin.x;
    const posY = stateData[base + PARTICLE_POSITION_Y_INDEX] ?? origin.y;
    const size = Math.max(stateData[base + PARTICLE_SIZE_INDEX] ?? 0, 0);
    const effectiveSize = Math.max(size, MIN_PARTICLE_SIZE);
    const halfSize = effectiveSize / 2;
    const age = stateData[base + PARTICLE_AGE_INDEX] ?? 0;
    const lifetime = stateData[base + PARTICLE_LIFETIME_INDEX] ?? config.particleLifetimeMs;

    const fillComponents = writeFillVertexComponents(PARTICLE_FILL_SCRATCH, {
      fill,
      center: { x: posX, y: posY },
      rotation: 0,
      size: { width: effectiveSize, height: effectiveSize },
      radius: effectiveSize / 2,
    });
    applyParticleAlpha(
      fillComponents,
      computeParticleAlphaFromValues(age, lifetime, config)
    );
    offset = writeParticleQuad(
      buffer,
      offset,
      posX - halfSize,
      posY - halfSize,
      posX + halfSize,
      posY + halfSize,
      fillComponents
    );
  }

  if (renderedParticles < capacity) {
    for (let i = renderedParticles; i < capacity; i += 1) {
      offset = writeParticleQuad(
        buffer,
        offset,
        origin.x,
        origin.y,
        origin.x,
        origin.y,
        inactiveComponents
      );
    }
  }
};

const SIMULATION_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_velocity;
in float a_age;
in float a_lifetime;
in float a_size;
in float a_active;

uniform float u_deltaMs;

out vec2 v_position;
out vec2 v_velocity;
out float v_age;
out float v_lifetime;
out float v_size;
out float v_active;

void main() {
  float active = a_active;
  float age = a_age;
  vec2 position = a_position;
  if (active > 0.5) {
    float nextAge = a_age + u_deltaMs;
    if (a_lifetime > 0.0 && nextAge >= a_lifetime) {
      active = 0.0;
      age = 0.0;
    } else {
      age = nextAge;
      position = a_position + a_velocity * u_deltaMs;
    }
  }
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  v_position = position;
  v_velocity = a_velocity;
  v_age = age;
  v_lifetime = a_lifetime;
  v_size = a_size;
  v_active = active;
}
`;

const SIMULATION_FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  fragColor = vec4(0.0);
}
`;

const SIMULATION_VARYINGS = [
  "v_position",
  "v_velocity",
  "v_age",
  "v_lifetime",
  "v_size",
  "v_active",
];

const simulationProgramCache = new WeakMap<
  WebGL2RenderingContext,
  ParticleSimulationProgram | null
>();

const stepParticleSimulation = (
  gpu: ParticleEmitterGpuState,
  capacity: number,
  deltaMs: number
): void => {
  const gl = gpu.gl;
  const program = gpu.program;
  gl.useProgram(program.program);
  if (program.deltaUniform) {
    gl.uniform1f(program.deltaUniform, deltaMs);
  }
  const sourceIndex = gpu.currentBufferIndex;
  const targetIndex = sourceIndex === 0 ? 1 : 0;
  const sourceVao = gpu.vaos[sourceIndex];
  const targetTransformFeedback = gpu.transformFeedbacks[targetIndex];
  const targetBuffer = gpu.buffers[targetIndex];
  if (!sourceVao || !targetTransformFeedback || !targetBuffer) {
    return;
  }

  gl.bindVertexArray(sourceVao);
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, targetTransformFeedback);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, targetBuffer);
  gl.enable(gl.RASTERIZER_DISCARD);
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, capacity);
  gl.endTransformFeedback();
  gl.disable(gl.RASTERIZER_DISCARD);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
  gl.bindVertexArray(null);

  gpu.currentBufferIndex = (targetIndex === 0 ? 0 : 1);
};

const getSimulationProgram = (
  gl: WebGL2RenderingContext
): ParticleSimulationProgram | null => {
  const existing = simulationProgramCache.get(gl);
  if (existing !== undefined) {
    return existing;
  }

  const vertexShader = createSimulationShader(
    gl,
    gl.VERTEX_SHADER,
    SIMULATION_VERTEX_SHADER
  );
  const fragmentShader = createSimulationShader(
    gl,
    gl.FRAGMENT_SHADER,
    SIMULATION_FRAGMENT_SHADER
  );
  if (!vertexShader || !fragmentShader) {
    simulationProgramCache.set(gl, null);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    simulationProgramCache.set(gl, null);
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.transformFeedbackVaryings(program, SIMULATION_VARYINGS, gl.INTERLEAVED_ATTRIBS);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Failed to link particle simulation program", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    simulationProgramCache.set(gl, null);
    return null;
  }

  const position = gl.getAttribLocation(program, "a_position");
  const velocity = gl.getAttribLocation(program, "a_velocity");
  const age = gl.getAttribLocation(program, "a_age");
  const lifetime = gl.getAttribLocation(program, "a_lifetime");
  const size = gl.getAttribLocation(program, "a_size");
  const active = gl.getAttribLocation(program, "a_active");

  if (
    position < 0 ||
    velocity < 0 ||
    age < 0 ||
    lifetime < 0 ||
    size < 0 ||
    active < 0
  ) {
    console.error("Particle simulation attributes are missing");
    gl.deleteProgram(program);
    simulationProgramCache.set(gl, null);
    return null;
  }

  const deltaUniform = gl.getUniformLocation(program, "u_deltaMs");

  const programInfo: ParticleSimulationProgram = {
    program,
    deltaUniform,
    attributes: {
      position,
      velocity,
      age,
      lifetime,
      size,
      active,
    },
  };

  simulationProgramCache.set(gl, programInfo);
  return programInfo;
};

const createSimulationShader = (
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
    console.error("Failed to compile particle simulation shader", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const enableSimulationAttribute = (
  gl: WebGL2RenderingContext,
  location: number,
  size: number,
  stride: number,
  offset: number
): void => {
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
};

const createParticleEmitterGpuState = (
  gl: WebGL2RenderingContext,
  capacity: number
): ParticleEmitterGpuState | null => {
  const program = getSimulationProgram(gl);
  if (!program) {
    return null;
  }

  const bufferA = gl.createBuffer();
  const bufferB = gl.createBuffer();
  const vaoA = gl.createVertexArray();
  const vaoB = gl.createVertexArray();
  const feedbackA = gl.createTransformFeedback();
  const feedbackB = gl.createTransformFeedback();

  if (!bufferA || !bufferB || !vaoA || !vaoB || !feedbackA || !feedbackB) {
    if (bufferA) gl.deleteBuffer(bufferA);
    if (bufferB) gl.deleteBuffer(bufferB);
    if (vaoA) gl.deleteVertexArray(vaoA);
    if (vaoB) gl.deleteVertexArray(vaoB);
    if (feedbackA) gl.deleteTransformFeedback(feedbackA);
    if (feedbackB) gl.deleteTransformFeedback(feedbackB);
    return null;
  }

  const stride = PARTICLE_STATE_BYTES;

  const bindAttributes = (vao: WebGLVertexArrayObject, buffer: WebGLBuffer) => {
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    enableSimulationAttribute(
      gl,
      program.attributes.position,
      2,
      stride,
      PARTICLE_POSITION_X_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    enableSimulationAttribute(
      gl,
      program.attributes.velocity,
      2,
      stride,
      PARTICLE_VELOCITY_X_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    enableSimulationAttribute(
      gl,
      program.attributes.age,
      1,
      stride,
      PARTICLE_AGE_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    enableSimulationAttribute(
      gl,
      program.attributes.lifetime,
      1,
      stride,
      PARTICLE_LIFETIME_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    enableSimulationAttribute(
      gl,
      program.attributes.size,
      1,
      stride,
      PARTICLE_SIZE_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    enableSimulationAttribute(
      gl,
      program.attributes.active,
      1,
      stride,
      PARTICLE_ACTIVE_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
  };

  gl.bindBuffer(gl.ARRAY_BUFFER, bufferA);
  gl.bufferData(gl.ARRAY_BUFFER, capacity * PARTICLE_STATE_BYTES, gl.DYNAMIC_COPY);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferB);
  gl.bufferData(gl.ARRAY_BUFFER, capacity * PARTICLE_STATE_BYTES, gl.DYNAMIC_COPY);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  bindAttributes(vaoA, bufferA);
  bindAttributes(vaoB, bufferB);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const stateData = new Float32Array(capacity * PARTICLE_STATE_COMPONENTS);

  return {
    gl,
    buffers: [bufferA, bufferB],
    transformFeedbacks: [feedbackA, feedbackB],
    vaos: [vaoA, vaoB],
    program,
    currentBufferIndex: 0,
    stateData,
    spawnScratch: new Float32Array(PARTICLE_STATE_COMPONENTS),
  };
};

const resetParticleEmitterGpuState = (gpu: ParticleEmitterGpuState): void => {
  const gl = gpu.gl;
  gpu.currentBufferIndex = 0;
  gpu.stateData.fill(0);
  for (let i = 0; i < gpu.buffers.length; i += 1) {
    const buffer = gpu.buffers[i];
    if (!buffer) {
      continue;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, gpu.stateData);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
};

const destroyParticleEmitterGpuState = <
  Config extends ParticleEmitterBaseConfig
>(state: ParticleEmitterState<Config>): void => {
  const gpu = state.gpu;
  if (!gpu) {
    return;
  }
  const gl = gpu.gl;
  gpu.buffers.forEach((buffer) => {
    if (buffer) {
      gl.deleteBuffer(buffer);
    }
  });
  gpu.transformFeedbacks.forEach((feedback) => {
    if (feedback) {
      gl.deleteTransformFeedback(feedback);
    }
  });
  gpu.vaos.forEach((vao) => {
    if (vao) {
      gl.deleteVertexArray(vao);
    }
  });
  state.gpu = undefined;
};

const resolveParticleFill = (config: ParticleEmitterBaseConfig): SceneFill => {
  const shape = config.shape === "circle" ? "circle" : "square";
  if (config.fill) {
    return config.fill;
  }
  if (shape === "circle") {
    return createCircularFill(config.color);
  }
  return createSolidFill(config.color);
};

const createSolidFill = (color: SceneColor): SceneFill => ({
  fillType: FILL_TYPES.SOLID,
  color: {
    r: color.r,
    g: color.g,
    b: color.b,
    a: typeof color.a === "number" ? color.a : 1,
  },
});

const createCircularFill = (color: SceneColor): SceneFill => ({
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    {
      offset: 0,
      color: {
        r: color.r,
        g: color.g,
        b: color.b,
        a: typeof color.a === "number" ? color.a : 1,
      },
    },
    {
      offset: 1,
      color: {
        r: color.r,
        g: color.g,
        b: color.b,
        a: 0,
      },
    },
  ],
});

const computeParticleAlpha = (
  particle: ParticleEmitterParticleState,
  config: ParticleEmitterBaseConfig
): number => {
  if (config.fadeStartMs >= particle.lifetimeMs) {
    return 1;
  }
  if (particle.ageMs <= config.fadeStartMs) {
    return 1;
  }
  const fadeDuration = Math.max(1, particle.lifetimeMs - config.fadeStartMs);
  const fadeProgress = clamp01((particle.ageMs - config.fadeStartMs) / fadeDuration);
  return 1 - fadeProgress;
};

const computeParticleAlphaFromValues = (
  ageMs: number,
  lifetimeMs: number,
  config: ParticleEmitterBaseConfig
): number => {
  const effectiveLifetime = lifetimeMs > 0 ? lifetimeMs : config.particleLifetimeMs;
  if (config.fadeStartMs >= effectiveLifetime) {
    return 1;
  }
  if (ageMs <= config.fadeStartMs) {
    return 1;
  }
  const fadeDuration = Math.max(1, effectiveLifetime - config.fadeStartMs);
  const fadeProgress = clamp01((ageMs - config.fadeStartMs) / fadeDuration);
  return 1 - fadeProgress;
};

const applyParticleAlpha = (components: Float32Array, alpha: number): void => {
  const effectiveAlpha = clamp01(alpha);
  if (effectiveAlpha >= 1) {
    return;
  }
  const colorsOffset =
    FILL_INFO_COMPONENTS +
    FILL_PARAMS0_COMPONENTS +
    FILL_PARAMS1_COMPONENTS +
    STOP_OFFSETS_COMPONENTS;
  for (let i = 0; i < MAX_GRADIENT_STOPS; i += 1) {
    const base = colorsOffset + i * STOP_COLOR_COMPONENTS;
    const alphaIndex = base + 3;
    if (alphaIndex < components.length) {
      const current = components[alphaIndex] ?? 0;
      components[alphaIndex] = current * effectiveAlpha;
    }
  }
};

const writeParticleQuad = (
  target: Float32Array,
  offset: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  fillComponents: Float32Array
): number => {
  offset = writeParticleVertex(target, offset, minX, minY, fillComponents);
  offset = writeParticleVertex(target, offset, maxX, minY, fillComponents);
  offset = writeParticleVertex(target, offset, maxX, maxY, fillComponents);
  offset = writeParticleVertex(target, offset, minX, minY, fillComponents);
  offset = writeParticleVertex(target, offset, maxX, maxY, fillComponents);
  offset = writeParticleVertex(target, offset, minX, maxY, fillComponents);
  return offset;
};

const writeParticleVertex = (
  target: Float32Array,
  offset: number,
  x: number,
  y: number,
  fillComponents: Float32Array
): number => {
  target[offset + 0] = x;
  target[offset + 1] = y;
  copyFillComponents(target, offset, fillComponents);
  return offset + VERTEX_COMPONENTS;
};

const getEmissionDuration = (config: ParticleEmitterBaseConfig): number => {
  const duration = config.emissionDurationMs;
  if (typeof duration !== "number" || !Number.isFinite(duration)) {
    return Number.POSITIVE_INFINITY;
  }
  if (duration <= 0) {
    return 0;
  }
  return duration;
};

const computeActiveDelta = (
  previousAge: number,
  deltaMs: number,
  emissionDuration: number
): number => {
  if (!Number.isFinite(emissionDuration)) {
    return deltaMs;
  }
  if (emissionDuration <= previousAge) {
    return 0;
  }
  const available = emissionDuration - previousAge;
  if (available <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(deltaMs, available));
};

const serializeConfig = <Config extends ParticleEmitterBaseConfig>(
  config: Config,
  options: ParticleEmitterPrimitiveOptions<Config>
): string => {
  if (typeof options.serializeConfig === "function") {
    return options.serializeConfig(config);
  }
  return JSON.stringify(config);
};

export const sanitizeParticleEmitterConfig = (
  config: {
    particlesPerSecond?: number;
    particleLifetimeMs?: number;
    fadeStartMs?: number;
    emissionDurationMs?: number;
    sizeRange?: { min?: number; max?: number };
    offset?: SceneVector2;
    color?: SceneColor;
    fill?: SceneFill;
    shape?: ParticleEmitterShape;
    maxParticles?: number;
  },
  options: ParticleEmitterSanitizerOptions = {}
): ParticleEmitterBaseConfig | null => {
  const particlesPerSecond = Math.max(
    0,
    Number.isFinite(config.particlesPerSecond)
      ? Number(config.particlesPerSecond)
      : 0
  );
  const particleLifetimeMs = Math.max(
    0,
    Number.isFinite(config.particleLifetimeMs)
      ? Number(config.particleLifetimeMs)
      : 0
  );
  if (particlesPerSecond <= 0 || particleLifetimeMs <= 0) {
    return null;
  }

  const fadeStartMs = Math.max(
    0,
    Math.min(
      particleLifetimeMs,
      Number.isFinite(config.fadeStartMs) ? Number(config.fadeStartMs) : 0
    )
  );
  const sizeMinRaw = config.sizeRange?.min;
  const sizeMaxRaw = config.sizeRange?.max;
  const sizeMin = Math.max(0, Number.isFinite(sizeMinRaw) ? Number(sizeMinRaw) : 0);
  const sizeMax = Math.max(
    sizeMin,
    Number.isFinite(sizeMaxRaw) ? Number(sizeMaxRaw) : sizeMin
  );
  const offset = config.offset
    ? {
        x: Number.isFinite(config.offset.x) ? Number(config.offset.x) : 0,
        y: Number.isFinite(config.offset.y) ? Number(config.offset.y) : 0,
      }
    : options.defaultOffset
    ? { ...options.defaultOffset }
    : { x: 0, y: 0 };
  const color = sanitizeSceneColor(
    config.color,
    options.defaultColor ?? { r: 1, g: 1, b: 1, a: 1 }
  );
  const fill = config.fill ? cloneSceneFill(config.fill) : undefined;
  const defaultShape = options.defaultShape === "circle" ? "circle" : "square";
  const shape: ParticleEmitterShape =
    config.shape === "circle" ? "circle" : defaultShape;
  const emissionDurationMs =
    typeof config.emissionDurationMs === "number" &&
    Number.isFinite(config.emissionDurationMs)
      ? Math.max(0, Number(config.emissionDurationMs))
      : undefined;
  const maxParticles =
    typeof config.maxParticles === "number" && config.maxParticles > 0
      ? Math.floor(config.maxParticles)
      : undefined;
  const capacity = Math.max(
    options.minCapacity ?? 1,
    Math.min(
      maxParticles ?? Number.MAX_SAFE_INTEGER,
      Math.ceil((particlesPerSecond * particleLifetimeMs) / 1000) + 1
    )
  );

  return {
    particlesPerSecond,
    particleLifetimeMs,
    fadeStartMs,
    sizeRange: { min: sizeMin, max: sizeMax },
    offset,
    color,
    fill,
    shape,
    emissionDurationMs,
    capacity,
  };
};

const getNowMs = (): number => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
};

const clamp01 = (value: number): number => {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
};

