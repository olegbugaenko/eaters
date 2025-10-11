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
        state = createEmptyParticleEmitterState();
        return state.data;
      }

      const nextSignature = serializeConfig(nextConfig, options);
      if (state.signature !== nextSignature || state.capacity !== nextConfig.capacity) {
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

  while (state.spawnAccumulator >= 1 && state.capacity > 0) {
    state.spawnAccumulator -= 1;
    if (state.particles.length >= state.capacity) {
      state.particles.shift();
    }
    state.particles.push(options.spawnParticle(origin, instance, config));
  }

  const survivors: ParticleEmitterParticleState[] = [];
  const updateParticle = options.updateParticle ?? defaultUpdateParticle;
  state.particles.forEach((particle) => {
    const keep = updateParticle(particle, deltaMs, instance, config);
    if (keep) {
      survivors.push(particle);
    }
  });
  state.particles = survivors;

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
  particle.position = {
    x: particle.position.x + particle.velocity.x * deltaMs,
    y: particle.position.y + particle.velocity.y * deltaMs,
  };
  return true;
};

const writeEmitterBuffer = <Config extends ParticleEmitterBaseConfig>(
  state: ParticleEmitterState<Config>,
  config: Config,
  origin: SceneVector2
): void => {
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
    const halfSize = size / 2;
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

