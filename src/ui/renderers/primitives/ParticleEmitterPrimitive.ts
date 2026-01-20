import {
  SceneColor,
  SceneFill,
  SceneGradientStop,
  SceneObjectInstance,
  SceneVector2,
  SceneSolidFill,
  SceneLinearGradientFill,
  SceneRadialGradientFill,
  SceneDiamondGradientFill,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import {
  cloneSceneFill,
} from "@shared/helpers/scene-fill.helper";
import { ParticleEmitterShape } from "@/logic/services/particles/ParticleEmitterShared";
import { sanitizeSceneColor, cloneSceneColor, ensureColorAlpha, cloneColorWithAlpha } from "@shared/helpers/scene-color.helper";
import { createSolidFill } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.helpers";
import {
  DynamicPrimitive,
  FILL_COMPONENTS,
  FILL_FILAMENTS_COMPONENTS,
  FILL_INFO_COMPONENTS,
  FILL_PARAMS0_COMPONENTS,
  FILL_PARAMS1_COMPONENTS,
  MAX_GRADIENT_STOPS,
  STOP_COLOR_COMPONENTS,
  STOP_OFFSETS_COMPONENTS,
  VERTEX_COMPONENTS,
} from "../objects/ObjectRenderer";
import { copyFillComponents, writeFillVertexComponents } from "./utils/fill";
import { getParticleEmitterGlContext } from "./utils/gpuContext";
import { getNowMs } from "@shared/helpers/time.helper";
import { clamp01 } from "@shared/helpers/numbers.helper";
import { sanitizeVector as sanitizeVectorShared } from "@shared/helpers/vector.helper";
import { ZERO_VECTOR } from "@shared/helpers/geometry.const";
import {
  ParticleEmitterGpuDrawHandle,
  ParticleEmitterGpuRenderUniforms,
  ParticleRenderResources,
  getParticleRenderResources,
  refreshParticleUniformKeys,
  registerParticleEmitterHandle,
  unregisterParticleEmitterHandle,
} from "./gpu/particle-emitter";

export interface ParticleEmitterBaseConfig {
  particlesPerSecond: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  sizeRange: { min: number; max: number };
  offset: SceneVector2;
  color: SceneColor;
  fill?: SceneFill;
  shape: ParticleEmitterShape;
  // Optional rendering tweaks
  aspectRatio?: number; // width/height; 1 = square, >1 stretched along X
  alignToVelocity?: boolean; // if true, rotate quad to face particle velocity
  alignToVelocityFlip?: boolean; // if true, rotate 180 degrees when aligned to velocity
  emissionDurationMs?: number;
  capacity: number;
  sizeGrowthRate?: number; // Multiplier per second: 1.0 = no growth, 2.0 = doubles per second
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
  mode: "cpu" | "gpu" | "disabled";
  requireGpu: boolean;
  cpuCache: ParticleEmitterCpuCache | null;
  lastConfigRef: Config | null; // Cache config reference to avoid JSON.stringify on every frame
  warnedCpuSpawnFallback: boolean;
  warnedCpuMode: boolean;
}

interface ParticleEmitterCpuCache {
  lastOrigin: SceneVector2;
  lastActiveCount: number;
  lastCapacity: number;
  inactiveComponents: Float32Array;
  inactiveQuad: Float32Array;
  fillSignature: string;
  solidFillTemplate: Float32Array | null;
}

/**
 * Parameters for GPU-based particle spawning
 */
export interface GpuSpawnConfig {
  baseSpeed: number;
  speedVariation: number;
  sizeMin: number;
  sizeMax: number;
  spawnRadiusMin: number;
  spawnRadiusMax: number;
  arc: number;
  direction: number;
  spread: number;
  radialVelocity: boolean;
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
  forceGpu?: boolean;
  /**
   * Optional: Return GPU spawn config to enable full GPU particle generation.
   * If provided, particles will be generated entirely on GPU without bufferSubData calls.
   */
  getGpuSpawnConfig?(
    instance: SceneObjectInstance,
    config: Config
  ): GpuSpawnConfig | null;
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

/**
 * Global flag to enable/disable the global particle pool.
 * DISABLED: Transform feedback bindBufferRange has compatibility issues.
 */
let useGlobalParticlePool = false;
const DEBUG_POOL = false;

/**
 * Enable or disable the global particle pool.
 * Call this before creating emitters to change behavior.
 */
export const setUseGlobalParticlePool = (enabled: boolean): void => {
  useGlobalParticlePool = enabled;
};

/**
 * Check if global particle pool is enabled.
 */
export const isGlobalParticlePoolEnabled = (): boolean => {
  return useGlobalParticlePool;
};
const PARTICLE_STATE_BYTES =
  PARTICLE_STATE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
const SOLID_CENTER_X_INDEX = FILL_INFO_COMPONENTS;
const SOLID_CENTER_Y_INDEX = FILL_INFO_COMPONENTS + 1;
const PARTICLE_POSITION_X_INDEX = 0;
const PARTICLE_POSITION_Y_INDEX = 1;
const PARTICLE_VELOCITY_X_INDEX = 2;
const PARTICLE_VELOCITY_Y_INDEX = 3;
const PARTICLE_AGE_INDEX = 4;
const PARTICLE_LIFETIME_INDEX = 5;
const PARTICLE_SIZE_INDEX = 6;
const PARTICLE_ACTIVE_INDEX = 7;

interface ParticleEmitterGpuSlot {
  active: boolean;
  ageMs: number;
  lifetimeMs: number;
}

interface ParticleEmitterGpuState {
  gl: WebGL2RenderingContext;
  capacity: number;
  buffers: [WebGLBuffer | null, WebGLBuffer | null];
  transformFeedbacks: [WebGLTransformFeedback | null, WebGLTransformFeedback | null];
  simulationVaos: [WebGLVertexArrayObject | null, WebGLVertexArrayObject | null];
  renderVaos: [WebGLVertexArrayObject | null, WebGLVertexArrayObject | null];
  program: ParticleSimulationProgram;
  renderResources: ParticleRenderResources;
  currentBufferIndex: 0 | 1;
  spawnScratch: Float32Array;
  slots: ParticleEmitterGpuSlot[];
  uniforms: ParticleEmitterGpuRenderUniforms;
  handle: ParticleEmitterGpuDrawHandle;
  // Pool-based emitter fields
  poolHandle?: import("./gpu/particle-emitter").GlobalParticlePoolHandle;
  usesPool?: boolean;
}

interface ParticleSimulationProgram {
  program: WebGLProgram;
  attributes: {
    position: number;
    velocity: number;
    age: number;
    lifetime: number;
    size: number;
    isActive: number;
  };
  uniforms: {
    deltaMs: WebGLUniformLocation | null;
    // GPU spawn uniforms
    emitterPosition: WebGLUniformLocation | null;
    emitterRotation: WebGLUniformLocation | null;
    currentTime: WebGLUniformLocation | null;
    spawnStartIndex: WebGLUniformLocation | null;
    spawnCount: WebGLUniformLocation | null;
    // Particle config uniforms
    particleLifetime: WebGLUniformLocation | null;
    speedRange: WebGLUniformLocation | null; // vec2(baseSpeed, speedVariation)
    sizeRange: WebGLUniformLocation | null; // vec2(min, max)
    spawnRadiusRange: WebGLUniformLocation | null; // vec2(min, max)
    arc: WebGLUniformLocation | null;
    direction: WebGLUniformLocation | null;
    spread: WebGLUniformLocation | null;
    radialVelocity: WebGLUniformLocation | null;
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

  const requireGpu = Boolean(options.forceGpu);
  const initialGl = getParticleEmitterGlContext();
  if (requireGpu && (!initialGl || initialConfig.capacity <= 0)) {
    return null;
  }

  let state = createParticleEmitterState(
    instance,
    initialConfig,
    options,
    requireGpu
  );

  const primitive: DynamicPrimitive = {
    get data() {
      return state.data;
    },
    updatePositionOnly(target: SceneObjectInstance) {
      const nextConfig = options.getConfig(target);
      if (!nextConfig) {
        const hadGpu = Boolean(state.gpu);
        if (!hadGpu && state.data.length === 0) {
          return null;
        }
        destroyParticleEmitterGpuState(state);
        state = createEmptyParticleEmitterState(state.requireGpu);
        return state.data;
      }

      // Avoid expensive per-frame serialization; only recreate when capacity increases
      if (nextConfig.capacity > state.capacity) {
        destroyParticleEmitterGpuState(state);
        state = createParticleEmitterState(
          target,
          nextConfig,
          options,
          state.requireGpu
        );
        return state.data;
      }

      state.config = nextConfig;
      // keep buffer capacity stable to prevent frequent reallocations
      state.capacity = Math.max(state.capacity, nextConfig.capacity);

      if (state.mode === "cpu" && !state.gpu) {
        const gl = getParticleEmitterGlContext();
        if (gl && state.capacity > 0) {
          destroyParticleEmitterGpuState(state);
          state = createParticleEmitterState(
            target,
            nextConfig,
            options,
            state.requireGpu
          );
          return state.data;
        }
      }

      if (
        state.mode === "cpu" &&
        options.getGpuSpawnConfig &&
        !state.warnedCpuMode
      ) {
        const reason = !getParticleEmitterGlContext()
          ? "WebGL2 context unavailable"
          : state.capacity <= 0
          ? "capacity <= 0"
          : "GPU state not initialized";
        console.warn(
          `[ParticleEmitter] CPU mode active for GPU-capable emitter: ${reason}. ` +
            `shape=${nextConfig.shape}, particlesPerSecond=${nextConfig.particlesPerSecond}`
        );
        state.warnedCpuMode = true;
      }

      // Check if config object changed (by reference) and update GPU uniforms if needed
      if (state.lastConfigRef !== nextConfig && state.gpu) {
        state.lastConfigRef = nextConfig;
        state.signature = serializeConfig(nextConfig, options);
        updateParticleEmitterGpuUniforms(state.gpu, nextConfig);
      }

      return state.data;
    },
    update(target: SceneObjectInstance, frameDeltaMs = 0) {
      const nextConfig = options.getConfig(target);
      if (!nextConfig) {
        const hadGpu = Boolean(state.gpu);
        if (!hadGpu && state.data.length === 0) {
          return null;
        }
        destroyParticleEmitterGpuState(state);
        state = createEmptyParticleEmitterState(state.requireGpu);
        return state.data;
      }

      // Avoid expensive per-frame serialization; only recreate when capacity increases
      if (nextConfig.capacity > state.capacity) {
        destroyParticleEmitterGpuState(state);
        state = createParticleEmitterState(
          target,
          nextConfig,
          options,
          state.requireGpu
        );
        return state.data;
      }

      state.config = nextConfig;
      // keep buffer capacity stable to prevent frequent reallocations
      state.capacity = Math.max(state.capacity, nextConfig.capacity);

      if (state.mode === "cpu" && !state.gpu) {
        const gl = getParticleEmitterGlContext();
        if (gl && state.capacity > 0) {
          destroyParticleEmitterGpuState(state);
          state = createParticleEmitterState(
            target,
            nextConfig,
            options,
            state.requireGpu
          );
          return state.data;
        }
      }

      if (
        state.mode === "cpu" &&
        options.getGpuSpawnConfig &&
        !state.warnedCpuMode
      ) {
        const reason = !getParticleEmitterGlContext()
          ? "WebGL2 context unavailable"
          : state.capacity <= 0
          ? "capacity <= 0"
          : "GPU state not initialized";
        console.warn(
          `[ParticleEmitter] CPU mode active for GPU-capable emitter: ${reason}. ` +
            `shape=${nextConfig.shape}, particlesPerSecond=${nextConfig.particlesPerSecond}`
        );
        state.warnedCpuMode = true;
      }
      
      // Check if config object changed (by reference) and update GPU uniforms if needed
      if (state.lastConfigRef !== nextConfig && state.gpu) {
        state.lastConfigRef = nextConfig;
        state.signature = serializeConfig(nextConfig, options);
        updateParticleEmitterGpuUniforms(state.gpu, nextConfig);
      }

      const deltaMs = Math.max(0, Math.min(frameDeltaMs, MAX_DELTA_MS));

      return advanceParticleEmitterState(state, target, deltaMs, options);
    },
    dispose() {
      destroyParticleEmitterGpuState(state);
      state = createEmptyParticleEmitterState(state.requireGpu);
    },
  };

  return primitive;
};

const createParticleEmitterState = <Config extends ParticleEmitterBaseConfig>(
  instance: SceneObjectInstance,
  config: Config,
  options: ParticleEmitterPrimitiveOptions<Config>,
  requireGpu: boolean
): ParticleEmitterState<Config> => {
  const capacity = Math.max(0, config.capacity);
  const gl = getParticleEmitterGlContext();
  
  // Try pool-based state first if enabled, fall back to individual buffers
  let gpu: ParticleEmitterGpuState | null = null;
  if (capacity > 0 && gl) {
    if (useGlobalParticlePool) {
      gpu = createParticleEmitterGpuStateFromPool(gl, capacity);
    }
    // Fall back to individual buffers if pool failed or is disabled
    if (!gpu) {
      gpu = createParticleEmitterGpuState(gl, capacity);
    }
  }

  if (requireGpu && !gpu) {
    return {
      config,
      particles: [],
      spawnAccumulator: 0,
      lastTimestamp: getNowMs(),
      capacity: 0,
      data: new Float32Array(0),
      signature: serializeConfig(config, options),
      ageMs: 0,
      gpu: undefined,
      mode: "disabled",
      requireGpu,
      cpuCache: null,
      lastConfigRef: config,
      warnedCpuSpawnFallback: false,
      warnedCpuMode: false,
    };
  }

  const state: ParticleEmitterState<Config> = {
    config,
    particles: [],
    spawnAccumulator: 0,
    lastTimestamp: getNowMs(),
    capacity,
    data: new Float32Array(
      gpu ? 0 : capacity * VERTICES_PER_PARTICLE * VERTEX_COMPONENTS
    ),
    signature: serializeConfig(config, options),
    ageMs: 0,
    gpu: undefined,
    mode: gpu ? "gpu" : "cpu",
    requireGpu,
    cpuCache: null,
    lastConfigRef: config,
    warnedCpuSpawnFallback: false,
    warnedCpuMode: false,
  };

  if (gpu) {
    state.gpu = gpu;
    resetParticleEmitterGpuState(gpu);
    updateParticleEmitterGpuUniforms(gpu, config);
  } else {
    writeEmitterBufferCpu(state, config, options.getOrigin(instance, config));
  }
  return state;
};

const createEmptyParticleEmitterState = <
  Config extends ParticleEmitterBaseConfig
>(requireGpu: boolean): ParticleEmitterState<Config> => ({
  config: null,
  particles: [],
  spawnAccumulator: 0,
  lastTimestamp: getNowMs(),
  capacity: 0,
  data: new Float32Array(0),
  signature: "",
  ageMs: 0,
  gpu: undefined,
  mode: requireGpu ? "disabled" : "cpu",
  requireGpu,
  cpuCache: null,
  lastConfigRef: null,
  warnedCpuSpawnFallback: false,
  warnedCpuMode: false,
});

const advanceParticleEmitterState = <Config extends ParticleEmitterBaseConfig>(
  state: ParticleEmitterState<Config>,
  instance: SceneObjectInstance,
  deltaMs: number,
  options: ParticleEmitterPrimitiveOptions<Config>
): Float32Array | null => {
  const config = state.config;
  if (!config || state.capacity <= 0) {
    state.particles = [];
    state.data = new Float32Array(0);
    state.capacity = 0;
    state.ageMs = 0;
    if (state.gpu) {
      resetParticleEmitterGpuState(state.gpu);
    }
    state.cpuCache = null;
    return state.data;
  }

  if (state.mode === "disabled") {
    if (state.data.length !== 0) {
      state.data = new Float32Array(0);
    }
    state.cpuCache = null;
    return state.data;
  }

  if (state.mode === "gpu" && state.gpu) {
    // GPU uniforms update is only needed when config actually changes.
    // Since configs are typically stable during emitter lifetime, we skip
    // the expensive serializeConfig call. If uniforms need updating,
    // the emitter should be recreated with new capacity.
    advanceParticleEmitterStateGpu(state, instance, deltaMs, options);
    state.cpuCache = null;
    return null;
  }

  if (state.mode !== "cpu") {
    state.cpuCache = null;
    return state.data;
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

  writeEmitterBufferCpu(state, config, origin);
  return state.data;
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
  
  // Check if GPU spawn is available
  const gpuSpawnConfig = options.getGpuSpawnConfig?.(instance, config);
  const useGpuSpawn = gpuSpawnConfig !== null && gpuSpawnConfig !== undefined;
  
  let spawnParams: GpuSpawnParams | undefined;
  
  if (useGpuSpawn) {
    // GPU SPAWN PATH: No CPU slot tracking needed!
    // GPU shader handles slot availability via isActive flag
    const spawnBudget = Math.min(
      Math.floor(state.spawnAccumulator),
      state.capacity // Can't spawn more than capacity
    );
    
    if (spawnBudget > 0) {
      spawnParams = {
        emitterPosition: origin,
        emitterRotation: instance.data.rotation ?? 0,
        spawnStartIndex: state.capacity, // Pass capacity for probability calculation
        spawnCount: spawnBudget,
        particleLifetime: config.particleLifetimeMs,
        baseSpeed: gpuSpawnConfig.baseSpeed,
        speedVariation: gpuSpawnConfig.speedVariation,
        sizeMin: gpuSpawnConfig.sizeMin,
        sizeMax: gpuSpawnConfig.sizeMax,
        spawnRadiusMin: gpuSpawnConfig.spawnRadiusMin,
        spawnRadiusMax: gpuSpawnConfig.spawnRadiusMax,
        arc: gpuSpawnConfig.arc,
        direction: gpuSpawnConfig.direction,
        spread: gpuSpawnConfig.spread,
        radialVelocity: gpuSpawnConfig.radialVelocity,
      };
      state.spawnAccumulator -= spawnBudget;
    }
    
    // Cap accumulator to prevent runaway growth
    state.spawnAccumulator = Math.min(state.spawnAccumulator, state.capacity);
  } else {
    // CPU SPAWN PATH: Legacy - requires slot tracking
    if (!state.warnedCpuSpawnFallback && options.getGpuSpawnConfig) {
      console.warn(
        "[ParticleEmitter] Falling back to CPU spawn in GPU mode: " +
          `getGpuSpawnConfig returned null/undefined. ` +
          `shape=${config.shape}, particlesPerSecond=${config.particlesPerSecond}`
      );
      state.warnedCpuSpawnFallback = true;
    }
    const currentTimeMs = state.ageMs;
    const slots = gpu.slots;
    const freeSlots: number[] = [];
    let activeCount = 0;
    
    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      if (!slot) {
        freeSlots.push(i);
        continue;
      }
      if (slot.active && deltaMs > 0 && slot.lifetimeMs > 0) {
        const age = currentTimeMs - slot.ageMs;
        if (age >= slot.lifetimeMs) {
          slot.active = false;
        }
      }
      if (!slot.active) {
        freeSlots.push(i);
      } else {
        activeCount += 1;
      }
    }
    
    const MAX_CPU_SPAWN_PER_FRAME = 32;
    const spawnBudget = Math.min(
      Math.floor(state.spawnAccumulator),
      freeSlots.length,
      MAX_CPU_SPAWN_PER_FRAME
    );
    
    if (spawnBudget > 0) {
      const gl = gpu.gl;
      const buffers = gpu.buffers;
      const scratch = gpu.spawnScratch;
      // For pool-based emitters, add global offset
      const globalSlotOffset = gpu.usesPool && gpu.poolHandle 
        ? gpu.poolHandle.range.startIndex 
        : 0;
      
      for (let i = 0; i < spawnBudget; i += 1) {
        const slotIndex = freeSlots[i]!;
        const particle = options.spawnParticle(origin, instance, config);
        scratch[PARTICLE_POSITION_X_INDEX] = particle.position.x;
        scratch[PARTICLE_POSITION_Y_INDEX] = particle.position.y;
        scratch[PARTICLE_VELOCITY_X_INDEX] = particle.velocity.x;
        scratch[PARTICLE_VELOCITY_Y_INDEX] = particle.velocity.y;
        scratch[PARTICLE_AGE_INDEX] = 0;
        scratch[PARTICLE_LIFETIME_INDEX] = particle.lifetimeMs;
        scratch[PARTICLE_SIZE_INDEX] = Math.max(particle.size, 0);
        scratch[PARTICLE_ACTIVE_INDEX] = 1;
        
        // Calculate byte offset: local slotIndex + global offset for pool
        const byteOffset = (globalSlotOffset + slotIndex) * PARTICLE_STATE_BYTES;
        
        for (let b = 0; b < buffers.length; b += 1) {
          const buffer = buffers[b];
          if (!buffer) {
            continue;
          }
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.bufferSubData(gl.ARRAY_BUFFER, byteOffset, scratch);
        }
        const slot = slots[slotIndex]!;
        slot.active = true;
        slot.ageMs = currentTimeMs;
        slot.lifetimeMs = particle.lifetimeMs;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      state.spawnAccumulator -= spawnBudget;
    }
    
    const remainingCapacity = Math.max(0, freeSlots.length - spawnBudget);
    state.spawnAccumulator = Math.min(state.spawnAccumulator, remainingCapacity);
    
    // Update active count for CPU path
    if (gpu.handle) {
      gpu.handle.activeCount = activeCount;
    }
  }

  // Run GPU simulation to update particle ages and positions (and spawn if using GPU spawn)
  if (deltaMs > 0 || spawnParams) {
    stepParticleSimulation(gpu, state.capacity, deltaMs, spawnParams);
  }

  // For GPU spawn path: always render full capacity, shader handles inactive particles
  // For CPU spawn path: activeCount is already set above
  if (useGpuSpawn && gpu.handle) {
    gpu.handle.activeCount = state.capacity;
  }
};

// CPU-only vertex buffer population. Callers only invoke this in CPU mode, but we
// still guard against accidental reuse from the GPU path.
const writeEmitterBufferCpu = <Config extends ParticleEmitterBaseConfig>(
  state: ParticleEmitterState<Config>,
  config: Config,
  origin: SceneVector2
): void => {
  if (state.mode !== "cpu") {
    if (state.data.length !== 0) {
      state.data = new Float32Array(0);
    }
    state.cpuCache = null;
    return;
  }

  const capacity = Math.max(0, state.capacity);
  const stride = VERTICES_PER_PARTICLE * VERTEX_COMPONENTS;
  const requiredLength = capacity * stride;
  if (state.data.length !== requiredLength) {
    state.data = new Float32Array(requiredLength);
  }
  const buffer = state.data;
  const activeCount = Math.min(state.particles.length, capacity);
  let offset = 0;
  const fill = resolveParticleFillForCpu(config);
  const fillSignature = serializeSceneFill(fill);

  const inactiveComponents = writeFillVertexComponents(INACTIVE_PARTICLE_FILL, {
    fill,
    center: origin,
    rotation: 0,
    size: { width: MIN_PARTICLE_SIZE, height: MIN_PARTICLE_SIZE },
    radius: MIN_PARTICLE_SIZE / 2,
  });
  applyParticleAlpha(inactiveComponents, 0);

  const existingCache = state.cpuCache;
  const cache =
    existingCache ?? {
      lastOrigin: { x: origin.x, y: origin.y },
      lastActiveCount: 0,
      lastCapacity: capacity,
      inactiveComponents: new Float32Array(inactiveComponents.length),
      inactiveQuad: new Float32Array(stride),
      fillSignature: "",
      solidFillTemplate: null,
    };
  if (!existingCache) {
    state.cpuCache = cache;
  }

  const fillChanged = cache.fillSignature !== fillSignature;
  if (fillChanged) {
    cache.fillSignature = fillSignature;
    cache.solidFillTemplate =
      fill.fillType === FILL_TYPES.SOLID ? createSolidFillTemplate(fill) : null;
  }

  const originChanged =
    !existingCache ||
    cache.lastOrigin.x !== origin.x ||
    cache.lastOrigin.y !== origin.y;
  const capacityChanged = !existingCache || cache.lastCapacity !== capacity;
  const inactiveFillChanged =
    fillChanged ||
    !existingCache ||
    !floatArrayEquals(inactiveComponents, cache.inactiveComponents);

  if (inactiveFillChanged || originChanged || capacityChanged) {
    cache.inactiveComponents.set(inactiveComponents);
    writeParticleQuad(
      cache.inactiveQuad,
      0,
      origin.x,
      origin.y,
      origin.x,
      origin.y,
      inactiveComponents
    );
  }

  for (let i = 0; i < activeCount; i += 1) {
    const particle = state.particles[i]!;
    const size = Math.max(particle.size, 0);
    const effectiveSize = Math.max(size, MIN_PARTICLE_SIZE);
    const aspect = Math.max(config.aspectRatio ?? 1, 0.01);
    const width = effectiveSize * aspect;
    const height = effectiveSize;
    const halfW = Math.max(width / 2, MIN_PARTICLE_SIZE / 2);
    const halfH = Math.max(height / 2, MIN_PARTICLE_SIZE / 2);
    const defaultRadius = Math.max(halfW, halfH);
    const fallbackRadius =
      !config.fill && fill.fillType === FILL_TYPES.DIAMOND_GRADIENT
        ? halfW + halfH
        : defaultRadius;
    const center = particle.position;
    const rotation = config.alignToVelocity === true
      ? Math.atan2(particle.velocity.y, particle.velocity.x)
      : 0;
    const fillComponents = PARTICLE_FILL_SCRATCH;
    if (cache.solidFillTemplate) {
      fillComponents.set(cache.solidFillTemplate);
      fillComponents[SOLID_CENTER_X_INDEX] = center.x;
      fillComponents[SOLID_CENTER_Y_INDEX] = center.y;
    } else {
      writeFillVertexComponents(fillComponents, {
        fill,
        center,
        rotation,
        size: { width, height },
        radius: fallbackRadius,
      });
    }
    applyParticleAlpha(fillComponents, computeParticleAlpha(particle, config));
    if (rotation === 0) {
      offset = writeParticleQuad(
        buffer,
        offset,
        center.x - halfW,
        center.y - halfH,
        center.x + halfW,
        center.y + halfH,
        fillComponents
      );
    } else {
      offset = writeRotatedParticleQuad(
        buffer,
        offset,
        center.x,
        center.y,
        halfW,
        halfH,
        rotation,
        fillComponents
      );
    }
  }

  if (capacity > 0) {
    const startIndex = activeCount;
    let endIndex = startIndex;
    if (inactiveFillChanged || originChanged || capacityChanged) {
      endIndex = capacity;
    } else if (cache.lastActiveCount > activeCount) {
      endIndex = Math.min(cache.lastActiveCount, capacity);
    }
    fillInactiveParticleRange(buffer, startIndex, endIndex, stride, cache.inactiveQuad);
  }

  cache.lastActiveCount = activeCount;
  cache.lastCapacity = capacity;
  cache.lastOrigin.x = origin.x;
  cache.lastOrigin.y = origin.y;
};

const SIMULATION_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_velocity;
in float a_age;
in float a_lifetime;
in float a_size;
in float a_isActive;

// Core simulation uniform
uniform float u_deltaMs;

// GPU spawn uniforms
uniform vec2 u_emitterPosition;
uniform float u_emitterRotation;
uniform float u_currentTime;
uniform float u_spawnStartIndex;
uniform float u_spawnCount;

// Particle config uniforms
uniform float u_particleLifetime;
uniform vec2 u_speedRange;       // (baseSpeed, speedVariation)
uniform vec2 u_sizeRange;        // (min, max)
uniform vec2 u_spawnRadiusRange; // (min, max)
uniform float u_arc;
uniform float u_direction;
uniform float u_spread;
uniform float u_radialVelocity;  // 0.0 or 1.0

out vec2 v_position;
out vec2 v_velocity;
out float v_age;
out float v_lifetime;
out float v_size;
out float v_isActive;

// Pseudo-random functions
float hash(float n) {
  return fract(sin(n * 12.9898) * 43758.5453123);
}

float rand(int particleId, int paramId) {
  float seed = float(particleId) * 7.1831 + float(paramId) * 13.7297 + u_currentTime * 0.001;
  return hash(seed);
}

float randRange(int particleId, int paramId, float minVal, float maxVal) {
  return mix(minVal, maxVal, rand(particleId, paramId));
}

void main() {
  int particleId = gl_VertexID;
  float isActive = a_isActive;
  float age = a_age;
  vec2 position = a_position;
  vec2 velocity = a_velocity;
  float size = a_size;
  float lifetime = a_lifetime;

  if (isActive > 0.5) {
    // === EXISTING PARTICLE: update position and age ===
    float nextAge = age + u_deltaMs;
    if (lifetime > 0.0 && nextAge >= lifetime) {
      isActive = 0.0;
      age = 0.0;
    } else {
      age = nextAge;
      position = position + velocity * u_deltaMs;
    }
  } else if (u_spawnCount > 0.0) {
    // === INACTIVE SLOT: check if should spawn ===
    // Probability-based spawning: spawn in inactive slots with probability
    // proportional to desired spawn count vs total capacity
    // u_spawnStartIndex contains capacity for this calculation
    float capacity = max(u_spawnStartIndex, 1.0);
    float spawnProbability = min(u_spawnCount / capacity, 1.0);
    float randomVal = rand(particleId, 99);
    if (randomVal < spawnProbability) {
      // Generate new particle on GPU!
      isActive = 1.0;
      age = 0.0;
      lifetime = u_particleLifetime;
      
      // Random size
      size = randRange(particleId, 0, u_sizeRange.x, u_sizeRange.y);
      
      // Random speed
      float speedVar = randRange(particleId, 1, -1.0, 1.0) * u_speedRange.y;
      float speed = max(0.0, u_speedRange.x + speedVar);
      
      // Calculate spawn angle
      float spawnAngle;
      if (u_arc >= 6.28318) {
        // Full circle - random angle
        spawnAngle = rand(particleId, 2) * 6.28318;
      } else if (u_spread > 0.0) {
        // Directional with spread (for player units, bullets)
        // u_direction already includes rotation + offset, don't add u_emitterRotation again
        float halfSpread = u_spread * 0.5;
        float spreadOffset = randRange(particleId, 2, -halfSpread, halfSpread);
        spawnAngle = u_direction + spreadOffset;
      } else {
        // Limited arc (for explosions with direction)
        float halfArc = u_arc * 0.5;
        float arcOffset = randRange(particleId, 2, -halfArc, halfArc);
        spawnAngle = u_direction + arcOffset;
      }
      
      // Random spawn radius
      float spawnRadius = randRange(particleId, 3, u_spawnRadiusRange.x, u_spawnRadiusRange.y);
      
      // Calculate spawn position
      position = u_emitterPosition + vec2(cos(spawnAngle), sin(spawnAngle)) * spawnRadius;
      
      // Calculate velocity direction
      float velocityAngle;
      if (u_radialVelocity > 0.5) {
        // Radial velocity: move away from emitter center
        velocityAngle = spawnAngle;
      } else {
        velocityAngle = spawnAngle;
      }
      
      velocity = vec2(cos(velocityAngle), sin(velocityAngle)) * speed;
    }
  }

  // Output to transform feedback
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  v_position = position;
  v_velocity = velocity;
  v_age = age;
  v_lifetime = lifetime;
  v_size = size;
  v_isActive = isActive;
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
  "v_isActive",
];

const simulationProgramCache = new WeakMap<
  WebGL2RenderingContext,
  ParticleSimulationProgram | null
>();

interface GpuSpawnParams {
  emitterPosition: { x: number; y: number };
  emitterRotation: number;
  spawnStartIndex: number;
  spawnCount: number;
  particleLifetime: number;
  baseSpeed: number;
  speedVariation: number;
  sizeMin: number;
  sizeMax: number;
  spawnRadiusMin: number;
  spawnRadiusMax: number;
  arc: number;
  direction: number;
  spread: number;
  radialVelocity: boolean;
}

const stepParticleSimulation = (
  gpu: ParticleEmitterGpuState,
  capacity: number,
  deltaMs: number,
  spawnParams?: GpuSpawnParams
): 0 | 1 | null => {
  const gl = gpu.gl;
  const program = gpu.program;
  
  gl.useProgram(program.program);
  
  // Core simulation uniform
  if (program.uniforms.deltaMs) {
    gl.uniform1f(program.uniforms.deltaMs, deltaMs);
  }
  
  // GPU spawn uniforms
  const u = program.uniforms;
  if (spawnParams && spawnParams.spawnCount > 0) {
    if (u.emitterPosition) {
      gl.uniform2f(u.emitterPosition, spawnParams.emitterPosition.x, spawnParams.emitterPosition.y);
    }
    if (u.emitterRotation) {
      gl.uniform1f(u.emitterRotation, spawnParams.emitterRotation);
    }
    if (u.currentTime) {
      gl.uniform1f(u.currentTime, performance.now());
    }
    if (u.spawnStartIndex) {
      gl.uniform1f(u.spawnStartIndex, spawnParams.spawnStartIndex);
    }
    if (u.spawnCount) {
      gl.uniform1f(u.spawnCount, spawnParams.spawnCount);
    }
    if (u.particleLifetime) {
      gl.uniform1f(u.particleLifetime, spawnParams.particleLifetime);
    }
    if (u.speedRange) {
      gl.uniform2f(u.speedRange, spawnParams.baseSpeed, spawnParams.speedVariation);
    }
    if (u.sizeRange) {
      gl.uniform2f(u.sizeRange, spawnParams.sizeMin, spawnParams.sizeMax);
    }
    if (u.spawnRadiusRange) {
      gl.uniform2f(u.spawnRadiusRange, spawnParams.spawnRadiusMin, spawnParams.spawnRadiusMax);
    }
    if (u.arc) {
      gl.uniform1f(u.arc, spawnParams.arc);
    }
    if (u.direction) {
      gl.uniform1f(u.direction, spawnParams.direction);
    }
    if (u.spread) {
      gl.uniform1f(u.spread, spawnParams.spread);
    }
    if (u.radialVelocity) {
      gl.uniform1f(u.radialVelocity, spawnParams.radialVelocity ? 1.0 : 0.0);
    }
  } else {
    // No spawn this frame
    if (u.spawnCount) {
      gl.uniform1f(u.spawnCount, 0);
    }
  }
  
  const sourceIndex = gpu.currentBufferIndex;
  const targetIndex: 0 | 1 = sourceIndex === 0 ? 1 : 0;
  const sourceVao = gpu.simulationVaos[sourceIndex];
  const targetTransformFeedback = gpu.transformFeedbacks[targetIndex];
  const targetBuffer = gpu.buffers[targetIndex];
  if (!sourceVao || !targetTransformFeedback || !targetBuffer) {
    return null;
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

  gpu.currentBufferIndex = targetIndex;
  return targetIndex;
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
  const isActive = gl.getAttribLocation(program, "a_isActive");

  if (
    position < 0 ||
    velocity < 0 ||
    age < 0 ||
    lifetime < 0 ||
    size < 0 ||
    isActive < 0
  ) {
    console.error("Particle simulation attributes are missing");
    gl.deleteProgram(program);
    simulationProgramCache.set(gl, null);
    return null;
  }

  // Get all uniform locations
  const uniforms = {
    deltaMs: gl.getUniformLocation(program, "u_deltaMs"),
    // GPU spawn uniforms
    emitterPosition: gl.getUniformLocation(program, "u_emitterPosition"),
    emitterRotation: gl.getUniformLocation(program, "u_emitterRotation"),
    currentTime: gl.getUniformLocation(program, "u_currentTime"),
    spawnStartIndex: gl.getUniformLocation(program, "u_spawnStartIndex"),
    spawnCount: gl.getUniformLocation(program, "u_spawnCount"),
    // Particle config uniforms
    particleLifetime: gl.getUniformLocation(program, "u_particleLifetime"),
    speedRange: gl.getUniformLocation(program, "u_speedRange"),
    sizeRange: gl.getUniformLocation(program, "u_sizeRange"),
    spawnRadiusRange: gl.getUniformLocation(program, "u_spawnRadiusRange"),
    arc: gl.getUniformLocation(program, "u_arc"),
    direction: gl.getUniformLocation(program, "u_direction"),
    spread: gl.getUniformLocation(program, "u_spread"),
    radialVelocity: gl.getUniformLocation(program, "u_radialVelocity"),
  };

  const programInfo: ParticleSimulationProgram = {
    program,
    attributes: {
      position,
      velocity,
      age,
      lifetime,
      size,
      isActive,
    },
    uniforms,
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

  const renderResources = getParticleRenderResources(gl);
  if (!renderResources) {
    return null;
  }

  const bufferA = gl.createBuffer();
  const bufferB = gl.createBuffer();
  const simulationVaoA = gl.createVertexArray();
  const simulationVaoB = gl.createVertexArray();
  const feedbackA = gl.createTransformFeedback();
  const feedbackB = gl.createTransformFeedback();
  const renderVaoA = gl.createVertexArray();
  const renderVaoB = gl.createVertexArray();

  if (
    !bufferA ||
    !bufferB ||
    !simulationVaoA ||
    !simulationVaoB ||
    !feedbackA ||
    !feedbackB ||
    !renderVaoA ||
    !renderVaoB
  ) {
    if (bufferA) gl.deleteBuffer(bufferA);
    if (bufferB) gl.deleteBuffer(bufferB);
    if (simulationVaoA) gl.deleteVertexArray(simulationVaoA);
    if (simulationVaoB) gl.deleteVertexArray(simulationVaoB);
    if (feedbackA) gl.deleteTransformFeedback(feedbackA);
    if (feedbackB) gl.deleteTransformFeedback(feedbackB);
    if (renderVaoA) gl.deleteVertexArray(renderVaoA);
    if (renderVaoB) gl.deleteVertexArray(renderVaoB);
    return null;
  }

  const stride = PARTICLE_STATE_BYTES;

  const bindSimulationAttributes = (
    vao: WebGLVertexArrayObject,
    buffer: WebGLBuffer
  ) => {
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
      program.attributes.isActive,
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

  bindSimulationAttributes(simulationVaoA, bufferA);
  bindSimulationAttributes(simulationVaoB, bufferB);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const configureRenderVao = (
    vao: WebGLVertexArrayObject,
    buffer: WebGLBuffer
  ) => {
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderResources.quadBuffer);
    gl.enableVertexAttribArray(renderResources.program.attributes.unitPosition);
    gl.vertexAttribPointer(
      renderResources.program.attributes.unitPosition,
      2,
      gl.FLOAT,
      false,
      2 * Float32Array.BYTES_PER_ELEMENT,
      0
    );
    gl.vertexAttribDivisor(renderResources.program.attributes.unitPosition, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(renderResources.program.attributes.position);
    gl.vertexAttribPointer(
      renderResources.program.attributes.position,
      2,
      gl.FLOAT,
      false,
      stride,
      PARTICLE_POSITION_X_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    gl.vertexAttribDivisor(renderResources.program.attributes.position, 1);

    // velocity for GPU-oriented quads
    gl.enableVertexAttribArray(renderResources.program.attributes.velocity);
    gl.vertexAttribPointer(
      renderResources.program.attributes.velocity,
      2,
      gl.FLOAT,
      false,
      stride,
      PARTICLE_VELOCITY_X_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    gl.vertexAttribDivisor(renderResources.program.attributes.velocity, 1);

    gl.enableVertexAttribArray(renderResources.program.attributes.size);
    gl.vertexAttribPointer(
      renderResources.program.attributes.size,
      1,
      gl.FLOAT,
      false,
      stride,
      PARTICLE_SIZE_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    gl.vertexAttribDivisor(renderResources.program.attributes.size, 1);

    gl.enableVertexAttribArray(renderResources.program.attributes.age);
    gl.vertexAttribPointer(
      renderResources.program.attributes.age,
      1,
      gl.FLOAT,
      false,
      stride,
      PARTICLE_AGE_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    gl.vertexAttribDivisor(renderResources.program.attributes.age, 1);

    gl.enableVertexAttribArray(renderResources.program.attributes.lifetime);
    gl.vertexAttribPointer(
      renderResources.program.attributes.lifetime,
      1,
      gl.FLOAT,
      false,
      stride,
      PARTICLE_LIFETIME_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    gl.vertexAttribDivisor(renderResources.program.attributes.lifetime, 1);

    gl.enableVertexAttribArray(renderResources.program.attributes.isActive);
    gl.vertexAttribPointer(
      renderResources.program.attributes.isActive,
      1,
      gl.FLOAT,
      false,
      stride,
      PARTICLE_ACTIVE_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    gl.vertexAttribDivisor(renderResources.program.attributes.isActive, 1);
  };

  configureRenderVao(renderVaoA, bufferA);
  configureRenderVao(renderVaoB, bufferB);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const slots: ParticleEmitterGpuSlot[] = [];
  for (let i = 0; i < capacity; i += 1) {
    slots.push({ active: false, ageMs: 0, lifetimeMs: 0 });
  }

  const uniforms: ParticleEmitterGpuRenderUniforms = {
    fillType: FILL_TYPES.SOLID,
    stopCount: 1,
    stopOffsets: new Float32Array(5),
    stopColor0: new Float32Array([1, 1, 1, 1]),
    stopColor1: new Float32Array([1, 1, 1, 0]),
    stopColor2: new Float32Array([1, 1, 1, 0]),
    stopColor3: new Float32Array([1, 1, 1, 0]),
    stopColor4: new Float32Array([1, 1, 1, 0]),
    noiseColorAmplitude: 0,
    noiseAlphaAmplitude: 0,
    noiseScale: 1,
    noiseDensity: 1,
    filamentColorContrast: 0,
    filamentAlphaContrast: 0,
    filamentWidth: 0,
    filamentDensity: 0,
    filamentEdgeBlur: 0,
    hasLinearStart: false,
    linearStart: { x: 0, y: 0 },
    hasLinearEnd: false,
    linearEnd: { x: 0, y: 0 },
    hasRadialOffset: false,
    radialOffset: { x: 0, y: 0 },
    hasExplicitRadius: false,
    explicitRadius: 0,
    fadeStartMs: 0,
    defaultLifetimeMs: 0,
    shape: 0,
    minParticleSize: MIN_PARTICLE_SIZE,
    lengthMultiplier: 1,
    alignToVelocity: false,
    alignToVelocityFlip: false,
    sizeGrowthRate: 1.0,
  };
  refreshParticleUniformKeys(uniforms);

  const gpu: ParticleEmitterGpuState = {
    gl,
    capacity,
    buffers: [bufferA, bufferB],
    transformFeedbacks: [feedbackA, feedbackB],
    simulationVaos: [simulationVaoA, simulationVaoB],
    renderVaos: [renderVaoA, renderVaoB],
    program,
    renderResources,
    currentBufferIndex: 0,
    spawnScratch: new Float32Array(PARTICLE_STATE_COMPONENTS),
    slots,
    uniforms,
    handle: null as unknown as ParticleEmitterGpuDrawHandle,
  };

  gpu.handle = {
    gl,
    capacity,
    uniforms,
    getCurrentVao: () => gpu.renderVaos[gpu.currentBufferIndex],
    activeCount: 0,
  };

  registerParticleEmitterHandle(gpu.handle);

  return gpu;
};

/**
 * Create GPU state using the global particle pool instead of individual buffers.
 * This reduces memory fragmentation and enables batched rendering.
 */
const createParticleEmitterGpuStateFromPool = (
  gl: WebGL2RenderingContext,
  capacity: number
): ParticleEmitterGpuState | null => {
  // Lazy import to avoid circular dependencies
  const poolModule = require("./gpu/particle-emitter/GlobalParticlePool") as typeof import("./gpu/particle-emitter/GlobalParticlePool");
  
  // Initialize pool if not already done
  if (!poolModule.isPoolInitialized()) {
    if (!poolModule.initGlobalParticlePool(gl)) {
      console.warn("[ParticleEmitter] Failed to initialize global particle pool, falling back to individual buffers");
      return createParticleEmitterGpuState(gl, capacity);
    }
  }
  
  // Allocate slots from pool
  const poolHandle = poolModule.allocateSlots(capacity);
  if (!poolHandle) {
    console.warn("[ParticleEmitter] Failed to allocate slots from pool, falling back to individual buffers");
    return createParticleEmitterGpuState(gl, capacity);
  }
  
  const program = getSimulationProgram(gl);
  if (!program) {
    poolModule.freeSlots(poolHandle);
    return null;
  }

  const renderResources = getParticleRenderResources(gl);
  if (!renderResources) {
    poolModule.freeSlots(poolHandle);
    return null;
  }
  
  // Get shared buffers from pool
  const stateBuffers = poolModule.getStateBuffers();
  if (!stateBuffers) {
    poolModule.freeSlots(poolHandle);
    return null;
  }
  
  // Create VAOs that point to our slot range in the shared buffers
  const renderVaoA = gl.createVertexArray();
  const renderVaoB = gl.createVertexArray();
  const simulationVaoA = gl.createVertexArray();
  const simulationVaoB = gl.createVertexArray();
  const feedbackA = gl.createTransformFeedback();
  const feedbackB = gl.createTransformFeedback();
  
  if (!renderVaoA || !renderVaoB || !simulationVaoA || !simulationVaoB || !feedbackA || !feedbackB) {
    if (renderVaoA) gl.deleteVertexArray(renderVaoA);
    if (renderVaoB) gl.deleteVertexArray(renderVaoB);
    if (simulationVaoA) gl.deleteVertexArray(simulationVaoA);
    if (simulationVaoB) gl.deleteVertexArray(simulationVaoB);
    if (feedbackA) gl.deleteTransformFeedback(feedbackA);
    if (feedbackB) gl.deleteTransformFeedback(feedbackB);
    poolModule.freeSlots(poolHandle);
    return null;
  }
  
  const stride = PARTICLE_STATE_BYTES;
  const slotByteOffset = poolHandle.range.startIndex * PARTICLE_STATE_BYTES;
  
  // Setup simulation VAOs for our range
  const bindSimulationAttributes = (
    vao: WebGLVertexArrayObject,
    buffer: WebGLBuffer
  ) => {
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    
    // Position
    gl.enableVertexAttribArray(program.attributes.position);
    gl.vertexAttribPointer(
      program.attributes.position,
      2,
      gl.FLOAT,
      false,
      stride,
      slotByteOffset + PARTICLE_POSITION_X_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    
    // Velocity
    gl.enableVertexAttribArray(program.attributes.velocity);
    gl.vertexAttribPointer(
      program.attributes.velocity,
      2,
      gl.FLOAT,
      false,
      stride,
      slotByteOffset + PARTICLE_VELOCITY_X_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    
    // Age
    gl.enableVertexAttribArray(program.attributes.age);
    gl.vertexAttribPointer(
      program.attributes.age,
      1,
      gl.FLOAT,
      false,
      stride,
      slotByteOffset + PARTICLE_AGE_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    
    // Lifetime
    gl.enableVertexAttribArray(program.attributes.lifetime);
    gl.vertexAttribPointer(
      program.attributes.lifetime,
      1,
      gl.FLOAT,
      false,
      stride,
      slotByteOffset + PARTICLE_LIFETIME_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    
    // Size
    gl.enableVertexAttribArray(program.attributes.size);
    gl.vertexAttribPointer(
      program.attributes.size,
      1,
      gl.FLOAT,
      false,
      stride,
      slotByteOffset + PARTICLE_SIZE_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    
    // IsActive
    gl.enableVertexAttribArray(program.attributes.isActive);
    gl.vertexAttribPointer(
      program.attributes.isActive,
      1,
      gl.FLOAT,
      false,
      stride,
      slotByteOffset + PARTICLE_ACTIVE_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
  };
  
  bindSimulationAttributes(simulationVaoA, stateBuffers[0]);
  bindSimulationAttributes(simulationVaoB, stateBuffers[1]);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  
  // Setup render VAOs
  const configureRenderVao = (
    vao: WebGLVertexArrayObject,
    buffer: WebGLBuffer
  ) => {
    gl.bindVertexArray(vao);
    
    // Unit quad (shared)
    gl.bindBuffer(gl.ARRAY_BUFFER, renderResources.quadBuffer);
    gl.enableVertexAttribArray(renderResources.program.attributes.unitPosition);
    gl.vertexAttribPointer(
      renderResources.program.attributes.unitPosition,
      2,
      gl.FLOAT,
      false,
      2 * Float32Array.BYTES_PER_ELEMENT,
      0
    );
    gl.vertexAttribDivisor(renderResources.program.attributes.unitPosition, 0);
    
    // Instance data from pool buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    
    // Position
    gl.enableVertexAttribArray(renderResources.program.attributes.position);
    gl.vertexAttribPointer(
      renderResources.program.attributes.position,
      2,
      gl.FLOAT,
      false,
      stride,
      slotByteOffset + PARTICLE_POSITION_X_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    gl.vertexAttribDivisor(renderResources.program.attributes.position, 1);
    
    // Velocity
    gl.enableVertexAttribArray(renderResources.program.attributes.velocity);
    gl.vertexAttribPointer(
      renderResources.program.attributes.velocity,
      2,
      gl.FLOAT,
      false,
      stride,
      slotByteOffset + PARTICLE_VELOCITY_X_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    gl.vertexAttribDivisor(renderResources.program.attributes.velocity, 1);
    
    // Size
    gl.enableVertexAttribArray(renderResources.program.attributes.size);
    gl.vertexAttribPointer(
      renderResources.program.attributes.size,
      1,
      gl.FLOAT,
      false,
      stride,
      slotByteOffset + PARTICLE_SIZE_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    gl.vertexAttribDivisor(renderResources.program.attributes.size, 1);
    
    // Age
    gl.enableVertexAttribArray(renderResources.program.attributes.age);
    gl.vertexAttribPointer(
      renderResources.program.attributes.age,
      1,
      gl.FLOAT,
      false,
      stride,
      slotByteOffset + PARTICLE_AGE_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    gl.vertexAttribDivisor(renderResources.program.attributes.age, 1);
    
    // Lifetime
    gl.enableVertexAttribArray(renderResources.program.attributes.lifetime);
    gl.vertexAttribPointer(
      renderResources.program.attributes.lifetime,
      1,
      gl.FLOAT,
      false,
      stride,
      slotByteOffset + PARTICLE_LIFETIME_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    gl.vertexAttribDivisor(renderResources.program.attributes.lifetime, 1);
    
    // IsActive
    gl.enableVertexAttribArray(renderResources.program.attributes.isActive);
    gl.vertexAttribPointer(
      renderResources.program.attributes.isActive,
      1,
      gl.FLOAT,
      false,
      stride,
      slotByteOffset + PARTICLE_ACTIVE_INDEX * Float32Array.BYTES_PER_ELEMENT
    );
    gl.vertexAttribDivisor(renderResources.program.attributes.isActive, 1);
  };
  
  configureRenderVao(renderVaoA, stateBuffers[0]);
  configureRenderVao(renderVaoB, stateBuffers[1]);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  
  // Initialize slot tracking (minimal - just for spawn logic)
  const slots: ParticleEmitterGpuSlot[] = [];
  for (let i = 0; i < capacity; i += 1) {
    slots.push({ active: false, ageMs: 0, lifetimeMs: 0 });
  }
  
  const uniforms: ParticleEmitterGpuRenderUniforms = {
    fillType: FILL_TYPES.SOLID,
    stopCount: 1,
    stopOffsets: new Float32Array(5),
    stopColor0: new Float32Array([1, 1, 1, 1]),
    stopColor1: new Float32Array([1, 1, 1, 0]),
    stopColor2: new Float32Array([1, 1, 1, 0]),
    stopColor3: new Float32Array([1, 1, 1, 0]),
    stopColor4: new Float32Array([1, 1, 1, 0]),
    noiseColorAmplitude: 0,
    noiseAlphaAmplitude: 0,
    noiseScale: 1,
    noiseDensity: 1,
    filamentColorContrast: 0,
    filamentAlphaContrast: 0,
    filamentWidth: 0,
    filamentDensity: 0,
    filamentEdgeBlur: 0,
    hasLinearStart: false,
    linearStart: { x: 0, y: 0 },
    hasLinearEnd: false,
    linearEnd: { x: 0, y: 0 },
    hasRadialOffset: false,
    radialOffset: { x: 0, y: 0 },
    hasExplicitRadius: false,
    explicitRadius: 0,
    fadeStartMs: 0,
    defaultLifetimeMs: 0,
    shape: 0,
    minParticleSize: MIN_PARTICLE_SIZE,
    lengthMultiplier: 1,
    alignToVelocity: false,
    alignToVelocityFlip: false,
    sizeGrowthRate: 1.0,
  };
  refreshParticleUniformKeys(uniforms);
  
  const gpu: ParticleEmitterGpuState = {
    gl,
    capacity,
    // Use shared buffers from pool
    buffers: [stateBuffers[0], stateBuffers[1]],
    transformFeedbacks: [feedbackA, feedbackB],
    simulationVaos: [simulationVaoA, simulationVaoB],
    renderVaos: [renderVaoA, renderVaoB],
    program,
    renderResources,
    currentBufferIndex: 0,
    spawnScratch: new Float32Array(PARTICLE_STATE_COMPONENTS),
    slots,
    uniforms,
    handle: null as unknown as ParticleEmitterGpuDrawHandle,
    // Pool-specific
    poolHandle,
    usesPool: true,
  };
  
  gpu.handle = {
    gl,
    capacity,
    uniforms,
    getCurrentVao: () => gpu.renderVaos[gpu.currentBufferIndex],
    activeCount: 0,
  };
  
  registerParticleEmitterHandle(gpu.handle);
  
  return gpu;
};

const resetParticleEmitterGpuState = (gpu: ParticleEmitterGpuState): void => {
  const gl = gpu.gl;
  gpu.currentBufferIndex = 0;
  
  // Reset slot tracking
  for (let i = 0; i < gpu.slots.length; i += 1) {
    const slot = gpu.slots[i];
    if (!slot) {
      continue;
    }
    slot.active = false;
    slot.ageMs = 0;
    slot.lifetimeMs = 0;
  }
  
  // Clear particle data
  if (gpu.usesPool && gpu.poolHandle) {
    // Use pool's clear function for pool-based emitters
    const poolModule = require("./gpu/particle-emitter/GlobalParticlePool") as typeof import("./gpu/particle-emitter/GlobalParticlePool");
    poolModule.clearSlotRange(gpu.poolHandle);
  } else {
    // Clear individual buffers for non-pool emitters
    const zero = new Float32Array(gpu.capacity * PARTICLE_STATE_COMPONENTS);
    for (let i = 0; i < gpu.buffers.length; i += 1) {
      const buffer = gpu.buffers[i];
      if (!buffer) {
        continue;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, zero);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
};

const destroyParticleEmitterGpuState = <
  Config extends ParticleEmitterBaseConfig
>(state: ParticleEmitterState<Config>): void => {
  const gpu = state.gpu;
  if (!gpu) {
    return;
  }
  const gl = gpu.gl;
  unregisterParticleEmitterHandle(gpu.handle);
  
  // If using pool, free slots and only delete VAOs (buffers are shared)
  if (gpu.usesPool && gpu.poolHandle) {
    const poolModule = require("./gpu/particle-emitter/GlobalParticlePool") as typeof import("./gpu/particle-emitter/GlobalParticlePool");
    poolModule.freeSlots(gpu.poolHandle);
    // Don't delete buffers - they belong to the pool
  } else {
    // Delete individual buffers for non-pool emitters
    gpu.buffers.forEach((buffer) => {
      if (buffer) {
        gl.deleteBuffer(buffer);
      }
    });
  }
  
  gpu.transformFeedbacks.forEach((feedback) => {
    if (feedback) {
      gl.deleteTransformFeedback(feedback);
    }
  });
  gpu.simulationVaos.forEach((vao) => {
    if (vao) {
      gl.deleteVertexArray(vao);
    }
  });
  gpu.renderVaos.forEach((vao) => {
    if (vao) {
      gl.deleteVertexArray(vao);
    }
  });
  state.gpu = undefined;
};

const sanitizeVector = (value: SceneVector2 | undefined): SceneVector2 =>
  sanitizeVectorShared(value, ZERO_VECTOR) ?? ZERO_VECTOR;

const assignVector = (target: SceneVector2, source: SceneVector2): void => {
  target.x = source.x;
  target.y = source.y;
};

const limitParticleStops = (stops: readonly SceneGradientStop[]): SceneGradientStop[] => {
  if (stops.length <= MAX_GRADIENT_STOPS) {
    return stops.slice();
  }
  const limited: SceneGradientStop[] = [];
  const lastIndex = stops.length - 1;
  limited.push(stops[0]!);
  const middleCount = MAX_GRADIENT_STOPS - 2;
  if (middleCount > 0) {
    const step = lastIndex / (middleCount + 1);
    for (let i = 1; i <= middleCount; i += 1) {
      const rawIndex = Math.round(i * step);
      const index = Math.min(lastIndex - 1, Math.max(1, rawIndex));
      const candidate = (stops[index] ?? stops[lastIndex])!;
      limited.push(candidate);
    }
  }
  limited.push(stops[lastIndex]!);
  return limited;
};

const ensureParticleStops = (fill: SceneFill): SceneGradientStop[] => {
  if (fill.fillType === FILL_TYPES.SOLID) {
    const solidFill = fill as SceneSolidFill;
    return [
      {
        offset: 0,
        color: solidFill.color,
      },
    ];
  }
  const gradientFill = fill as SceneLinearGradientFill | SceneRadialGradientFill | SceneDiamondGradientFill;
  if (!gradientFill.stops || gradientFill.stops.length === 0) {
    return [
      {
        offset: 0,
        color: { r: 1, g: 1, b: 1, a: 1 },
      },
    ];
  }
  return limitParticleStops(gradientFill.stops);
};

const updateParticleEmitterGpuUniforms = <
  Config extends ParticleEmitterBaseConfig
>(gpu: ParticleEmitterGpuState, config: Config): void => {
  const uniforms = gpu.uniforms;
  uniforms.fadeStartMs = config.fadeStartMs;
  uniforms.defaultLifetimeMs = config.particleLifetimeMs;
  uniforms.shape = config.shape === "circle" ? 1 : config.shape === "triangle" ? 2 : 0;
  uniforms.minParticleSize = MIN_PARTICLE_SIZE;
  uniforms.lengthMultiplier = Math.max(config.aspectRatio ?? 1, 1);
  uniforms.alignToVelocity = config.alignToVelocity === true;
  uniforms.alignToVelocityFlip = config.alignToVelocityFlip === true;
  uniforms.sizeGrowthRate = typeof config.sizeGrowthRate === "number" && Number.isFinite(config.sizeGrowthRate) ? config.sizeGrowthRate : 1.0;

  const fill = resolveParticleFill(config);
  uniforms.fillType = fill.fillType;
  const noise = fill.noise;
  uniforms.noiseColorAmplitude = noise ? clamp01(noise.colorAmplitude) : 0;
  uniforms.noiseAlphaAmplitude = noise ? clamp01(noise.alphaAmplitude) : 0;
  uniforms.noiseScale = noise ? Math.max(noise.scale, 0.0001) : 1;
  uniforms.noiseDensity = noise?.density ?? 1;

  const filaments = fill.filaments;
  uniforms.filamentColorContrast = filaments
    ? clamp01(filaments.colorContrast)
    : 0;
  uniforms.filamentAlphaContrast = filaments
    ? clamp01(filaments.alphaContrast)
    : 0;
  uniforms.filamentWidth = filaments ? clamp01(filaments.width) : 0;
  uniforms.filamentDensity = filaments ? Math.max(filaments.density, 0) : 0;
  uniforms.filamentEdgeBlur = filaments ? clamp01(filaments.edgeBlur) : 0;

  const stops = ensureParticleStops(fill);
  const stopCount = Math.min(MAX_GRADIENT_STOPS, stops.length);
  uniforms.stopCount = stopCount;
  const effectiveStops = stopCount > 0 ? stops.slice(0, stopCount) : stops;
  const referenceStop = effectiveStops[Math.max(0, effectiveStops.length - 1)]!;
  for (let i = 0; i < STOP_OFFSETS_COMPONENTS; i += 1) {
    const stop = i < effectiveStops.length ? effectiveStops[i]! : referenceStop;
    uniforms.stopOffsets[i] = clamp01(stop.offset);
  }

  const applyColor = (target: Float32Array, stop: SceneGradientStop) => {
    const fallback: SceneColor = {
      r:
        typeof stop.color?.r === "number" && Number.isFinite(stop.color.r)
          ? stop.color.r
          : 1,
      g:
        typeof stop.color?.g === "number" && Number.isFinite(stop.color.g)
          ? stop.color.g
          : 1,
      b:
        typeof stop.color?.b === "number" && Number.isFinite(stop.color.b)
          ? stop.color.b
          : 1,
      a:
        typeof stop.color?.a === "number" && Number.isFinite(stop.color.a)
          ? stop.color.a
          : 1,
    };
    const color = sanitizeSceneColor(stop.color, fallback);
    target[0] = color.r;
    target[1] = color.g;
    target[2] = color.b;
    target[3] = clamp01(typeof color.a === "number" ? color.a : 1);
  };

  applyColor(uniforms.stopColor0, effectiveStops[0] ?? referenceStop);
  applyColor(uniforms.stopColor1, effectiveStops[1] ?? referenceStop);
  applyColor(uniforms.stopColor2, effectiveStops[2] ?? referenceStop);

  uniforms.hasLinearStart = false;
  uniforms.hasLinearEnd = false;
  uniforms.hasRadialOffset = false;
  uniforms.hasExplicitRadius = false;
  assignVector(uniforms.linearStart, { x: 0, y: 0 });
  assignVector(uniforms.linearEnd, { x: 0, y: 0 });
  assignVector(uniforms.radialOffset, { x: 0, y: 0 });
  uniforms.explicitRadius = 0;

  if (fill.fillType === FILL_TYPES.LINEAR_GRADIENT) {
    const linearFill = fill as SceneLinearGradientFill;
    if (linearFill.start) {
      uniforms.hasLinearStart = true;
      assignVector(uniforms.linearStart, sanitizeVector(linearFill.start));
    }
    if (linearFill.end && typeof linearFill.end === "object") {
      uniforms.hasLinearEnd = true;
      assignVector(uniforms.linearEnd, sanitizeVector(linearFill.end));
    }
  } else if (
    fill.fillType === FILL_TYPES.RADIAL_GRADIENT ||
    fill.fillType === FILL_TYPES.DIAMOND_GRADIENT
  ) {
    const radialOrDiamondFill = fill as SceneRadialGradientFill | SceneDiamondGradientFill;
    if (radialOrDiamondFill.start) {
      uniforms.hasRadialOffset = true;
      assignVector(uniforms.radialOffset, sanitizeVector(radialOrDiamondFill.start));
    }
    const explicitRadius =
      typeof radialOrDiamondFill.end === "number" && Number.isFinite(radialOrDiamondFill.end) ? radialOrDiamondFill.end : 0;
    uniforms.hasExplicitRadius = explicitRadius > 0;
    uniforms.explicitRadius = uniforms.hasExplicitRadius ? explicitRadius : 0;
  }

  refreshParticleUniformKeys(uniforms);
};

const resolveParticleFill = (config: ParticleEmitterBaseConfig): SceneFill => {
  const shape = config.shape === "circle" ? "circle" : "square"; // triangle treated as square in GPU defaults
  if (config.fill) {
    return config.fill;
  }
  if (shape === "circle") {
    return createCircularFill(config.color);
  }
  return createSolidFill(config.color);
};

const resolveParticleFillForCpu = (
  config: ParticleEmitterBaseConfig
): SceneFill => {
  if (config.fill) {
    return config.fill;
  }

  if (config.shape === "circle") {
    return createCircularFill(config.color);
  }

  if (config.shape === "triangle") {
    return createTriangleFill(config);
  }

  return createDiamondFill(config);
};


const getMaxParticleSize = (config: ParticleEmitterBaseConfig): number =>
  Math.max(config.sizeRange.max, config.sizeRange.min, MIN_PARTICLE_SIZE);

const getHalfExtents = (
  config: ParticleEmitterBaseConfig
): { halfWidth: number; halfHeight: number } => {
  const maxSize = getMaxParticleSize(config);
  const halfHeight = Math.max(maxSize / 2, MIN_PARTICLE_SIZE / 2);
  const aspect = Math.max(config.aspectRatio ?? 1, 0.01);
  const halfWidth = Math.max(halfHeight * aspect, MIN_PARTICLE_SIZE / 2);
  return { halfWidth, halfHeight };
};

const createDiamondFill = (config: ParticleEmitterBaseConfig): SceneFill => {
  const { halfWidth, halfHeight } = getHalfExtents(config);
  const baseAlpha = ensureColorAlpha(config.color);
  return {
    fillType: FILL_TYPES.DIAMOND_GRADIENT,
    start: { x: 0, y: 0 },
    end: halfWidth + halfHeight,
    stops: [
      { offset: 0, color: cloneColorWithAlpha(config.color, baseAlpha) },
      { offset: 0.7, color: cloneColorWithAlpha(config.color, baseAlpha) },
      { offset: 1, color: cloneColorWithAlpha(config.color, 0) },
    ],
  };
};

const createTriangleFill = (config: ParticleEmitterBaseConfig): SceneFill => {
  const { halfWidth } = getHalfExtents(config);
  const baseAlpha = ensureColorAlpha(config.color);
  return {
    fillType: FILL_TYPES.LINEAR_GRADIENT,
    start: { x: -halfWidth, y: 0 },
    end: { x: halfWidth, y: 0 },
    stops: [
      { offset: 0, color: cloneColorWithAlpha(config.color, baseAlpha) },
      { offset: 0.6, color: cloneColorWithAlpha(config.color, baseAlpha) },
      { offset: 1, color: cloneColorWithAlpha(config.color, 0) },
    ],
  };
};

// createSolidFill is now imported from scene-object-manager.helpers

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

const applyParticleAlpha = (components: Float32Array, alpha: number): void => {
  const effectiveAlpha = clamp01(alpha);
  if (effectiveAlpha >= 1) {
    return;
  }
  const colorsOffset =
    FILL_INFO_COMPONENTS +
    FILL_PARAMS0_COMPONENTS +
    FILL_PARAMS1_COMPONENTS +
    FILL_FILAMENTS_COMPONENTS +
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

const floatArrayEquals = (a: Float32Array, b: Float32Array): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av === bv || (Number.isNaN(av) && Number.isNaN(bv))) {
      continue;
    }
    return false;
  }
  return true;
};

const serializeSceneFill = (fill: SceneFill): string => {
  switch (fill.fillType) {
    case FILL_TYPES.SOLID: {
      const solidFill = fill as SceneSolidFill;
      return JSON.stringify({
        fillType: solidFill.fillType,
        color: solidFill.color,
        noise: solidFill.noise,
        filaments: solidFill.filaments,
      });
    }
    case FILL_TYPES.LINEAR_GRADIENT: {
      const linearFill = fill as SceneLinearGradientFill;
      return JSON.stringify({
        fillType: linearFill.fillType,
        start: linearFill.start,
        end: linearFill.end,
        stops: linearFill.stops,
        noise: linearFill.noise,
        filaments: linearFill.filaments,
      });
    }
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT: {
      const radialOrDiamondFill = fill as SceneRadialGradientFill | SceneDiamondGradientFill;
      return JSON.stringify({
        fillType: radialOrDiamondFill.fillType,
        start: radialOrDiamondFill.start,
        end: radialOrDiamondFill.end,
        stops: radialOrDiamondFill.stops,
        noise: radialOrDiamondFill.noise,
        filaments: radialOrDiamondFill.filaments,
      });
    }
    default:
      return JSON.stringify(fill);
  }
};

const createSolidFillTemplate = (fill: SceneFill): Float32Array | null => {
  if (fill.fillType !== FILL_TYPES.SOLID) {
    return null;
  }

  const solidFill = fill as SceneSolidFill;
  const template = new Float32Array(FILL_COMPONENTS);
  template[0] = FILL_TYPES.SOLID;
  template[1] = 1;

  const color = sanitizeSceneColor(solidFill.color, solidFill.color);
  const colorBase =
    FILL_INFO_COMPONENTS +
    FILL_PARAMS0_COMPONENTS +
    FILL_PARAMS1_COMPONENTS +
    FILL_FILAMENTS_COMPONENTS +
    STOP_OFFSETS_COMPONENTS;
  for (let i = 0; i < MAX_GRADIENT_STOPS; i += 1) {
    const base = colorBase + i * STOP_COLOR_COMPONENTS;
    template[base + 0] = color.r;
    template[base + 1] = color.g;
    template[base + 2] = color.b;
    template[base + 3] = typeof color.a === "number" ? color.a : 1;
  }

  return template;
};

const fillInactiveParticleRange = (
  target: Float32Array,
  startIndex: number,
  endIndex: number,
  stride: number,
  quad: Float32Array
): void => {
  const count = endIndex - startIndex;
  if (count <= 0) {
    return;
  }
  const offset = startIndex * stride;
  target.set(quad, offset);
  let filled = 1;
  while (filled < count) {
    const copy = Math.min(filled, count - filled);
    const sourceStart = offset;
    const sourceEnd = offset + copy * stride;
    target.set(target.subarray(sourceStart, sourceEnd), offset + filled * stride);
    filled += copy;
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

const writeRotatedParticleQuad = (
  target: Float32Array,
  offset: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  rotation: number,
  fillComponents: Float32Array
): number => {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const x0 = -halfW, y0 = -halfH;
  const x1 =  halfW, y1 = -halfH;
  const x2 =  halfW, y2 =  halfH;
  const x3 = -halfW, y3 =  halfH;

  const rx0 = cx + x0 * cos - y0 * sin;
  const ry0 = cy + x0 * sin + y0 * cos;
  const rx1 = cx + x1 * cos - y1 * sin;
  const ry1 = cy + x1 * sin + y1 * cos;
  const rx2 = cx + x2 * cos - y2 * sin;
  const ry2 = cy + x2 * sin + y2 * cos;
  const rx3 = cx + x3 * cos - y3 * sin;
  const ry3 = cy + x3 * sin + y3 * cos;

  offset = writeParticleVertex(target, offset, rx0, ry0, fillComponents);
  offset = writeParticleVertex(target, offset, rx1, ry1, fillComponents);
  offset = writeParticleVertex(target, offset, rx2, ry2, fillComponents);
  offset = writeParticleVertex(target, offset, rx0, ry0, fillComponents);
  offset = writeParticleVertex(target, offset, rx2, ry2, fillComponents);
  offset = writeParticleVertex(target, offset, rx3, ry3, fillComponents);
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
    aspectRatio?: number;
    alignToVelocity?: boolean;
    alignToVelocityFlip?: boolean;
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
  const defaultShape = options.defaultShape === "circle" ? "circle" : options.defaultShape === "triangle" ? "triangle" : "square";
  const shape: ParticleEmitterShape =
    config.shape === "circle" ? "circle" : config.shape === "triangle" ? "triangle" : defaultShape;
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
    aspectRatio: Number.isFinite(config.aspectRatio) ? Math.max(Number(config.aspectRatio), 0.01) : undefined,
    alignToVelocity: config.alignToVelocity === true,
    alignToVelocityFlip: config.alignToVelocityFlip === true,
  };
};
