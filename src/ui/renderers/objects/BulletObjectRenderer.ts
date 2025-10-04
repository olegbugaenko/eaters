import type { BulletTailEmitterConfig } from "../../../db/bullets-db";
import {
  DynamicPrimitive,
  FILL_INFO_COMPONENTS,
  FILL_PARAMS0_COMPONENTS,
  FILL_PARAMS1_COMPONENTS,
  MAX_GRADIENT_STOPS,
  ObjectRegistration,
  ObjectRenderer,
  STOP_COLOR_COMPONENTS,
  STOP_OFFSETS_COMPONENTS,
  VERTEX_COMPONENTS,
  transformObjectPoint,
} from "./ObjectRenderer";
import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneLinearGradientFill,
  SceneObjectInstance,
  SceneVector2,
} from "../../../logic/services/SceneObjectManager";
import { createDynamicCirclePrimitive, createDynamicTrianglePrimitive } from "../primitives";
import { copyFillComponents, createFillVertexComponents } from "../primitives/fill";

interface BulletTailRenderConfig {
  lengthMultiplier: number;
  widthMultiplier: number;
  startColor: SceneColor;
  endColor: SceneColor;
}

interface BulletRendererCustomData {
  tail?: Partial<BulletTailRenderConfig>;
  tailEmitter?: BulletTailEmitterConfig;
}

interface BulletTailEmitterRenderConfig {
  particlesPerSecond: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  baseSpeed: number;
  speedVariation: number;
  sizeRange: { min: number; max: number };
  spread: number;
  offset: SceneVector2;
  color: SceneColor;
  fill?: SceneFill;
  capacity: number;
}

interface TailParticleState {
  position: SceneVector2;
  velocity: SceneVector2;
  ageMs: number;
  lifetimeMs: number;
  size: number;
}

interface TailEmitterState {
  config: BulletTailEmitterRenderConfig | null;
  particles: TailParticleState[];
  spawnAccumulator: number;
  lastTimestamp: number;
  data: Float32Array;
  capacity: number;
  signature: string;
}

const VERTICES_PER_PARTICLE = 6;
const MAX_DELTA_MS = 250;
const MIN_PARTICLE_SIZE = 0.0001;

const DEFAULT_TAIL_CONFIG: BulletTailRenderConfig = {
  lengthMultiplier: 4.5,
  widthMultiplier: 1.75,
  startColor: { r: 0.25, g: 0.45, b: 1, a: 0.65 },
  endColor: { r: 0.05, g: 0.15, b: 0.6, a: 0 },
};

const cloneColor = (color: SceneColor, fallback: SceneColor): SceneColor => ({
  r: typeof color.r === "number" ? color.r : fallback.r,
  g: typeof color.g === "number" ? color.g : fallback.g,
  b: typeof color.b === "number" ? color.b : fallback.b,
  a: typeof color.a === "number" ? color.a : fallback.a,
});

const getTailConfig = (instance: SceneObjectInstance): BulletTailRenderConfig => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  if (!data || typeof data !== "object" || !data.tail) {
    return DEFAULT_TAIL_CONFIG;
  }

  const { tail } = data;
  const lengthMultiplier =
    typeof tail.lengthMultiplier === "number"
      ? tail.lengthMultiplier
      : DEFAULT_TAIL_CONFIG.lengthMultiplier;
  const widthMultiplier =
    typeof tail.widthMultiplier === "number"
      ? tail.widthMultiplier
      : DEFAULT_TAIL_CONFIG.widthMultiplier;
  const startColor = tail.startColor
    ? cloneColor(tail.startColor, DEFAULT_TAIL_CONFIG.startColor)
    : { ...DEFAULT_TAIL_CONFIG.startColor };
  const endColor = tail.endColor
    ? cloneColor(tail.endColor, DEFAULT_TAIL_CONFIG.endColor)
    : { ...DEFAULT_TAIL_CONFIG.endColor };

  return {
    lengthMultiplier,
    widthMultiplier,
    startColor,
    endColor,
  };
};

const getTailEmitterConfig = (
  instance: SceneObjectInstance
): BulletTailEmitterRenderConfig | null => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  if (!data || typeof data !== "object" || !data.tailEmitter) {
    return null;
  }
  return sanitizeTailEmitterConfig(data.tailEmitter);
};

const sanitizeTailEmitterConfig = (
  config: BulletTailEmitterConfig
): BulletTailEmitterRenderConfig | null => {
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
  const baseSpeed = Math.max(
    0,
    Number.isFinite(config.baseSpeed) ? Number(config.baseSpeed) : 0
  );
  const speedVariation = Math.max(
    0,
    Number.isFinite(config.speedVariation) ? Number(config.speedVariation) : 0
  );
  const sizeMinRaw = config.sizeRange?.min;
  const sizeMaxRaw = config.sizeRange?.max;
  const sizeMin = Math.max(
    0,
    Number.isFinite(sizeMinRaw) ? Number(sizeMinRaw) : 0
  );
  const sizeMax = Math.max(
    sizeMin,
    Number.isFinite(sizeMaxRaw) ? Number(sizeMaxRaw) : sizeMin
  );
  const spread = Math.max(
    0,
    Number.isFinite(config.spread) ? Number(config.spread) : 0
  );
  const offset = config.offset
    ? {
        x: Number.isFinite(config.offset.x) ? Number(config.offset.x) : 0,
        y: Number.isFinite(config.offset.y) ? Number(config.offset.y) : 0,
      }
    : { x: -1, y: 0 };
  const color = sanitizeSceneColor(config.color, {
    r: 1,
    g: 1,
    b: 1,
    a: 1,
  });
  const fill = config.fill ? cloneFill(config.fill) : undefined;
  const maxParticles =
    typeof config.maxParticles === "number" && config.maxParticles > 0
      ? Math.floor(config.maxParticles)
      : undefined;
  const capacity = Math.max(
    1,
    Math.min(
      maxParticles ?? Number.MAX_SAFE_INTEGER,
      Math.ceil((particlesPerSecond * particleLifetimeMs) / 1000) + 1
    )
  );

  return {
    particlesPerSecond,
    particleLifetimeMs,
    fadeStartMs,
    baseSpeed,
    speedVariation,
    sizeRange: { min: sizeMin, max: sizeMax },
    spread,
    offset,
    color,
    fill,
    capacity,
  };
};

const sanitizeSceneColor = (
  color: SceneColor | undefined,
  fallback: SceneColor
): SceneColor => ({
  r: typeof color?.r === "number" && Number.isFinite(color.r)
    ? color.r
    : fallback.r,
  g: typeof color?.g === "number" && Number.isFinite(color.g)
    ? color.g
    : fallback.g,
  b: typeof color?.b === "number" && Number.isFinite(color.b)
    ? color.b
    : fallback.b,
  a: typeof color?.a === "number" && Number.isFinite(color.a)
    ? color.a
    : typeof fallback.a === "number"
    ? fallback.a
    : 1,
});

const cloneFill = (fill: SceneFill): SceneFill => {
  switch (fill.fillType) {
    case FILL_TYPES.SOLID:
      return {
        fillType: FILL_TYPES.SOLID,
        color: { ...fill.color },
      };
    case FILL_TYPES.LINEAR_GRADIENT:
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end ? { ...fill.end } : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
      };
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT:
      return {
        fillType: fill.fillType,
        start: fill.start ? { ...fill.start } : undefined,
        end: typeof fill.end === "number" ? fill.end : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
      } as SceneFill;
    default:
      return fill;
  }
};

const computeTailEmitterSignature = (
  config: BulletTailEmitterRenderConfig
): string => {
  const serializedFill = config.fill ? JSON.stringify(config.fill) : "";
  const alpha = typeof config.color.a === "number" ? config.color.a : 1;
  return [
    config.particlesPerSecond,
    config.particleLifetimeMs,
    config.fadeStartMs,
    config.baseSpeed,
    config.speedVariation,
    config.sizeRange.min,
    config.sizeRange.max,
    config.spread,
    config.offset.x,
    config.offset.y,
    config.color.r,
    config.color.g,
    config.color.b,
    alpha,
    config.capacity,
    serializedFill,
  ].join(":");
};

const getBulletRadius = (instance: SceneObjectInstance): number => {
  const size = instance.data.size;
  if (!size) {
    return 0;
  }
  return Math.max(size.width, size.height) / 2;
};

const createTailVertices = (
  instance: SceneObjectInstance
): [SceneVector2, SceneVector2, SceneVector2] => {
  const radius = getBulletRadius(instance);
  const tail = getTailConfig(instance);
  const tailLength = radius * tail.lengthMultiplier;
  const tailHalfWidth = (radius * tail.widthMultiplier) / 2;
  return [
    { x: -radius / 2, y: tailHalfWidth },
    { x: -radius / 2, y: -tailHalfWidth },
    { x: -radius / 2 - tailLength, y: 0 },
  ];
};

const createTailFill = (
  instance: SceneObjectInstance
): SceneLinearGradientFill => {
  const radius = getBulletRadius(instance);
  const tail = getTailConfig(instance);
  const tailLength = radius * tail.lengthMultiplier;
  return {
    fillType: FILL_TYPES.LINEAR_GRADIENT,
    start: { x: tailLength, y: 0 },
    end: { x: 0, y: 0 },
    stops: [
      { offset: 0, color: { ...tail.startColor } },
      { offset: 1, color: { ...tail.endColor } },
    ],
  };
};

const createTailEmitterState = (
  config: BulletTailEmitterRenderConfig,
  instance: SceneObjectInstance
): TailEmitterState => {
  const capacity = Math.max(0, config.capacity);
  const state: TailEmitterState = {
    config,
    particles: [],
    spawnAccumulator: 0,
    lastTimestamp: getNowMs(),
    capacity,
    data: new Float32Array(
      capacity * VERTICES_PER_PARTICLE * VERTEX_COMPONENTS
    ),
    signature: computeTailEmitterSignature(config),
  };
  writeTailEmitterBuffer(state, config, getTailEmitterOrigin(instance, config));
  return state;
};

const createEmptyTailEmitterState = (): TailEmitterState => ({
  config: null,
  particles: [],
  spawnAccumulator: 0,
  lastTimestamp: getNowMs(),
  capacity: 0,
  data: new Float32Array(0),
  signature: "",
});

const createTailEmitterPrimitive = (
  instance: SceneObjectInstance
): DynamicPrimitive | null => {
  const initialConfig = getTailEmitterConfig(instance);
  if (!initialConfig) {
    return null;
  }

  let state = createTailEmitterState(initialConfig, instance);

  const primitive: DynamicPrimitive = {
    get data() {
      return state.data;
    },
    update(target: SceneObjectInstance) {
      const nextConfig = getTailEmitterConfig(target);
      if (!nextConfig) {
        if (state.data.length === 0) {
          return null;
        }
        state = createEmptyTailEmitterState();
        return state.data;
      }

      const nextSignature = computeTailEmitterSignature(nextConfig);
      if (state.signature !== nextSignature || state.capacity !== nextConfig.capacity) {
        state = createTailEmitterState(nextConfig, target);
        return state.data;
      }

      state.config = nextConfig;
      state.capacity = nextConfig.capacity;
      state.signature = nextSignature;
      const now = getNowMs();
      const deltaMs = Math.max(
        0,
        Math.min(now - state.lastTimestamp, MAX_DELTA_MS)
      );
      state.lastTimestamp = now;
      advanceTailEmitterState(state, target, deltaMs);
      return state.data;
    },
  };

  return primitive;
};

const advanceTailEmitterState = (
  state: TailEmitterState,
  instance: SceneObjectInstance,
  deltaMs: number
): void => {
  const config = state.config;
  if (!config || state.capacity <= 0) {
    state.particles = [];
    state.data = new Float32Array(0);
    state.capacity = 0;
    return;
  }

  const spawnRate = config.particlesPerSecond / 1000;
  if (deltaMs > 0 && spawnRate > 0) {
    state.spawnAccumulator += spawnRate * deltaMs;
  }

  const origin = getTailEmitterOrigin(instance, config);

  while (state.spawnAccumulator >= 1 && state.capacity > 0) {
    state.spawnAccumulator -= 1;
    if (state.particles.length >= state.capacity) {
      state.particles.shift();
    }
    state.particles.push(createTailParticle(origin, instance, config));
  }

  const survivors: TailParticleState[] = [];
  state.particles.forEach((particle) => {
    particle.ageMs += deltaMs;
    if (particle.ageMs >= particle.lifetimeMs) {
      return;
    }
    particle.position = {
      x: particle.position.x + particle.velocity.x * deltaMs,
      y: particle.position.y + particle.velocity.y * deltaMs,
    };
    survivors.push(particle);
  });
  state.particles = survivors;

  writeTailEmitterBuffer(state, config, origin);
};

const createTailParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: BulletTailEmitterRenderConfig
): TailParticleState => {
  const baseDirection = (instance.data.rotation ?? 0) + Math.PI;
  const halfSpread = config.spread / 2;
  const direction =
    baseDirection +
    (config.spread > 0 ? randomBetween(-halfSpread, halfSpread) : 0);
  const speed = Math.max(
    0,
    config.baseSpeed +
      (config.speedVariation > 0
        ? randomBetween(-config.speedVariation, config.speedVariation)
        : 0)
  );
  const size =
    config.sizeRange.min === config.sizeRange.max
      ? config.sizeRange.min
      : randomBetween(config.sizeRange.min, config.sizeRange.max);

  return {
    position: { x: origin.x, y: origin.y },
    velocity: { x: Math.cos(direction) * speed, y: Math.sin(direction) * speed },
    ageMs: 0,
    lifetimeMs: config.particleLifetimeMs,
    size,
  };
};

const getTailEmitterOrigin = (
  instance: SceneObjectInstance,
  config: BulletTailEmitterRenderConfig
): SceneVector2 => {
  const radius = getBulletRadius(instance);
  const offset = {
    x: config.offset.x * radius,
    y: config.offset.y * radius,
  };
  return transformObjectPoint(instance.data.position, instance.data.rotation, offset);
};

const writeTailEmitterBuffer = (
  state: TailEmitterState,
  config: BulletTailEmitterRenderConfig,
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
  for (let i = 0; i < capacity; i += 1) {
    const particle = state.particles[i];
    const isActive = i < activeCount && particle;
    const center = isActive && particle ? particle.position : origin;
    const size = isActive && particle ? Math.max(particle.size, 0) : 0;
    const alpha = isActive && particle ? computeParticleAlpha(particle, config) : 0;
    const halfSize = size / 2;
    const fillComponents = createParticleFillComponents(
      config,
      center,
      size,
      alpha
    );
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
};

const createParticleFillComponents = (
  config: BulletTailEmitterRenderConfig,
  center: SceneVector2,
  size: number,
  alpha: number
): Float32Array => {
  const fill = config.fill ?? createSolidFill(config.color);
  const effectiveSize = Math.max(size, MIN_PARTICLE_SIZE);
  const fillComponents = createFillVertexComponents({
    fill,
    center,
    rotation: 0,
    size: { width: effectiveSize, height: effectiveSize },
    radius: effectiveSize / 2,
  });
  applyParticleAlpha(fillComponents, alpha);
  return fillComponents;
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

const computeParticleAlpha = (
  particle: TailParticleState,
  config: BulletTailEmitterRenderConfig
): number => {
  if (config.fadeStartMs >= particle.lifetimeMs) {
    return 1;
  }
  if (particle.ageMs <= config.fadeStartMs) {
    return 1;
  }
  const fadeDuration = Math.max(1, particle.lifetimeMs - config.fadeStartMs);
  const fadeProgress = clamp01(
    (particle.ageMs - config.fadeStartMs) / fadeDuration
  );
  return 1 - fadeProgress;
};

const applyParticleAlpha = (
  components: Float32Array,
  alpha: number
): void => {
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

const randomBetween = (min: number, max: number): number => {
  if (max <= min) {
    return min;
  }
  return min + Math.random() * (max - min);
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

export class BulletObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const emitterPrimitive = createTailEmitterPrimitive(instance);
    const dynamicPrimitives: DynamicPrimitive[] = [];
    if (emitterPrimitive) {
      dynamicPrimitives.push(emitterPrimitive);
    }
    dynamicPrimitives.push(
      createDynamicTrianglePrimitive(instance, {
        getVertices: createTailVertices,
        getFill: createTailFill,
      })
    );
    dynamicPrimitives.push(createDynamicCirclePrimitive(instance));

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
