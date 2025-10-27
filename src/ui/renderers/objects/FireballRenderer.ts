import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
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
import {
  createDynamicCirclePrimitive,
  createDynamicTrianglePrimitive,
  createParticleEmitterPrimitive,
} from "../primitives";
import {
  ParticleEmitterBaseConfig,
  ParticleEmitterParticleState,
  sanitizeParticleEmitterConfig,
} from "../primitives/ParticleEmitterPrimitive";
import type { FireballTrailEmitterConfig as FireballTrailEmitterPresetConfig } from "../../../logic/modules/scene/FireballModule";

interface FireballRendererTailData {
  lengthMultiplier?: number;
  widthMultiplier?: number;
}

interface FireballRendererCustomData {
  fireballId?: string;
  glowColor?: SceneColor;
  radius?: number;
  velocity?: SceneVector2;
  speed?: number;
  maxSpeed?: number;
  tail?: FireballRendererTailData;
  trailEmitter?: FireballTrailEmitterPresetConfig;
  smokeEmitter?: FireballTrailEmitterPresetConfig;
}

type FireballTrailEmitterRenderConfig = ParticleEmitterBaseConfig & {
  baseSpeed: number;
  lateralJitter: number;
};

const DEFAULT_RADIUS = 8;
const DEFAULT_GLOW_COLOR: SceneColor = { r: 1, g: 0.7, b: 0.3, a: 0.8 };
const CORE_INNER_COLOR: SceneColor = { r: 1, g: 0.96, b: 0.8, a: 1 };
const CORE_MID_COLOR: SceneColor = { r: 1, g: 0.83, b: 0.56, a: 0.95 };
const CORE_OUTER_COLOR: SceneColor = { r: 0.75, g: 0.55, b: 0.3, a: 0.85 };
const TAIL_START_COLOR: SceneColor = { r: 1, g: 0.75, b: 0.3, a: 0.7 };
const TAIL_MID_COLOR: SceneColor = { r: 1, g: 0.45, b: 0.1, a: 0.45 };
const TAIL_END_COLOR: SceneColor = { r: 0.2, g: 0.02, b: 0, a: 0 };
const DEFAULT_TAIL_LENGTH_MULTIPLIER = 4.5;
const DEFAULT_TAIL_WIDTH_MULTIPLIER = 1.6;
const MIN_SPEED = 0.01;

interface FireballTrailEmitterPreset {
  particlesPerSecond: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  sizeRange: { min: number; max: number };
  offsetFactor: number;
  color: SceneColor;
  fill?: SceneFill;
  maxParticles?: number;
  baseSpeed: number;
  lateralJitter: number;
}

const DEFAULT_TRAIL_EMITTER_PRESET: FireballTrailEmitterPreset = {
  particlesPerSecond: 115,
  particleLifetimeMs: 520,
  fadeStartMs: 320,
  sizeRange: { min: 0.55, max: 1.35 },
  offsetFactor: 0.65,
  color: { r: 1, g: 0.68, b: 0.28, a: 0.85 },
  fill: {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    end: 1,
    stops: [
      { offset: 0, color: { r: 1, g: 0.83, b: 0.55, a: 1 } },
      { offset: 0.45, color: { r: 1, g: 0.45, b: 0.05, a: 0.75 } },
      { offset: 1, color: { r: 0.75, g: 0.25, b: 0, a: 0 } },
    ],
  },
  maxParticles: 160,
  baseSpeed: 70,
  lateralJitter: 32,
};

const DEFAULT_SMOKE_EMITTER_PRESET: FireballTrailEmitterPreset = {
  particlesPerSecond: 65,
  particleLifetimeMs: 780,
  fadeStartMs: 560,
  sizeRange: { min: 0.9, max: 2.1 },
  offsetFactor: 0.9,
  color: { r: 0.32, g: 0.24, b: 0.2, a: 0.45 },
  fill: {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    end: 1,
    stops: [
      { offset: 0, color: { r: 0.6, g: 0.45, b: 0.35, a: 0.5 } },
      { offset: 0.55, color: { r: 0.3, g: 0.2, b: 0.18, a: 0.32 } },
      { offset: 1, color: { r: 0.12, g: 0.08, b: 0.08, a: 0 } },
    ],
  },
  maxParticles: 140,
  baseSpeed: 38,
  lateralJitter: 18,
};

export class FireballRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const tailPrimitive = createDynamicTrianglePrimitive(instance, {
      getVertices: createTailVertices,
      getFill: createTailFill,
    });

    const glowPrimitive = createDynamicCirclePrimitive(instance, {
      getRadius: (target) => getGlowRadius(target),
      getFill: (target) => createGlowFill(target),
    });

    const corePrimitive = createDynamicCirclePrimitive(instance, {
      getRadius: (target) => getCoreRadius(target),
      getFill: (target) => createCoreFill(getCoreRadius(target)),
    });

    const smokeEmitterPrimitive = createParticleEmitterPrimitive<FireballTrailEmitterRenderConfig>(
      instance,
      {
        getConfig: getSmokeEmitterConfig,
        getOrigin: getTrailEmitterOrigin,
        spawnParticle: createTrailParticle,
        forceGpu: true,
      }
    );

    const trailEmitterPrimitive = createParticleEmitterPrimitive<FireballTrailEmitterRenderConfig>(
      instance,
      {
        getConfig: getTrailEmitterConfig,
        getOrigin: getTrailEmitterOrigin,
        spawnParticle: createTrailParticle,
        forceGpu: true,
      }
    );

    const dynamicPrimitives: DynamicPrimitive[] = [tailPrimitive];

    if (smokeEmitterPrimitive) {
      dynamicPrimitives.push(smokeEmitterPrimitive);
    }

    if (trailEmitterPrimitive) {
      dynamicPrimitives.push(trailEmitterPrimitive);
    }

    dynamicPrimitives.push(glowPrimitive, corePrimitive);

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}

const getCustomData = (
  instance: SceneObjectInstance
): FireballRendererCustomData => {
  const data = instance.data.customData as FireballRendererCustomData | undefined;
  return data && typeof data === "object" ? data : {};
};

const getCoreRadius = (instance: SceneObjectInstance): number => {
  const data = getCustomData(instance);
  if (typeof data.radius === "number" && Number.isFinite(data.radius)) {
    return Math.max(0.5, data.radius);
  }
  const size = instance.data.size;
  if (size) {
    return Math.max(size.width, size.height) / 2;
  }
  return DEFAULT_RADIUS;
};

const getGlowColor = (instance: SceneObjectInstance): SceneColor => {
  const data = getCustomData(instance);
  return cloneColor(data.glowColor, DEFAULT_GLOW_COLOR);
};

const getVelocity = (instance: SceneObjectInstance): SceneVector2 => {
  const data = getCustomData(instance);
  if (data.velocity && typeof data.velocity === "object") {
    const { x, y } = data.velocity;
    return {
      x: Number.isFinite(x) ? Number(x) : 0,
      y: Number.isFinite(y) ? Number(y) : 0,
    };
  }
  return { x: 0, y: 0 };
};

const getSpeed = (instance: SceneObjectInstance): number => {
  const data = getCustomData(instance);
  if (typeof data.speed === "number" && Number.isFinite(data.speed)) {
    return Math.max(0, data.speed);
  }
  const velocity = getVelocity(instance);
  return Math.hypot(velocity.x, velocity.y);
};

const getMaxSpeed = (instance: SceneObjectInstance): number | undefined => {
  const data = getCustomData(instance);
  if (typeof data.maxSpeed === "number" && Number.isFinite(data.maxSpeed)) {
    return data.maxSpeed;
  }
  return undefined;
};

const cloneColor = (color: SceneColor | undefined, fallback: SceneColor): SceneColor => ({
  r: typeof color?.r === "number" ? color.r : fallback.r,
  g: typeof color?.g === "number" ? color.g : fallback.g,
  b: typeof color?.b === "number" ? color.b : fallback.b,
  a: typeof color?.a === "number" ? color.a : fallback.a,
});

const getTailMultipliers = (
  instance: SceneObjectInstance
): { lengthMultiplier: number; widthMultiplier: number } => {
  const data = getCustomData(instance);
  const tail = data.tail;
  const lengthMultiplier =
    typeof tail?.lengthMultiplier === "number" && Number.isFinite(tail.lengthMultiplier)
      ? Math.max(0, tail.lengthMultiplier)
      : DEFAULT_TAIL_LENGTH_MULTIPLIER;
  const widthMultiplier =
    typeof tail?.widthMultiplier === "number" && Number.isFinite(tail.widthMultiplier)
      ? Math.max(0, tail.widthMultiplier)
      : DEFAULT_TAIL_WIDTH_MULTIPLIER;
  return { lengthMultiplier, widthMultiplier };
};

const computeTailIntensity = (instance: SceneObjectInstance): number => {
  const speed = getSpeed(instance);
  if (speed <= MIN_SPEED) {
    return 0.4;
  }
  const maxSpeed = getMaxSpeed(instance);
  if (maxSpeed && maxSpeed > MIN_SPEED) {
    return clamp(0.5, 1.6, speed / maxSpeed);
  }
  return clamp(0.6, 1.4, speed / 120);
};

const getGlowRadius = (instance: SceneObjectInstance): number => {
  const base = getCoreRadius(instance);
  const intensity = computeTailIntensity(instance);
  return base * (1.6 + intensity * 0.2);
};

const createCoreFill = (radius: number): SceneFill => ({
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: radius,
  stops: [
    { offset: 0, color: { ...CORE_INNER_COLOR } },
    { offset: 0.45, color: { ...CORE_MID_COLOR } },
    { offset: 1, color: { ...CORE_OUTER_COLOR } },
  ],
});

const createGlowFill = (instance: SceneObjectInstance): SceneFill => {
  const radius = getGlowRadius(instance);
  const glowColor = getGlowColor(instance);
  return {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    end: radius,
    stops: [
      {
        offset: 0,
        color: { r: glowColor.r, g: glowColor.g, b: glowColor.b, a: 0.7 },
      },
      {
        offset: 0.55,
        color: { r: glowColor.r, g: glowColor.g, b: glowColor.b, a: 0.32 },
      },
      {
        offset: 1,
        color: { r: glowColor.r, g: glowColor.g, b: glowColor.b, a: 0 },
      },
    ],
  };
};

const createTailVertices = (
  instance: SceneObjectInstance
): [SceneVector2, SceneVector2, SceneVector2] => {
  const radius = getCoreRadius(instance);
  const { lengthMultiplier, widthMultiplier } = getTailMultipliers(instance);
  const intensity = computeTailIntensity(instance);
  const tailLength = radius * lengthMultiplier * (0.65 + intensity * 0.55);
  const tailHalfWidth = (radius * widthMultiplier * (0.6 + intensity * 0.25)) / 2;
  const anchor = radius * 0.35;
  return [
    { x: anchor, y: tailHalfWidth },
    { x: anchor, y: -tailHalfWidth },
    { x: anchor - tailLength, y: 0 },
  ];
};

const createTailFill = (instance: SceneObjectInstance): SceneLinearGradientFill => {
  const radius = getCoreRadius(instance);
  const { lengthMultiplier } = getTailMultipliers(instance);
  const intensity = computeTailIntensity(instance);
  const anchor = radius * 0.35;
  const tailLength = radius * lengthMultiplier * (0.65 + intensity * 0.55);
  const endX = anchor - tailLength;
  return {
    fillType: FILL_TYPES.LINEAR_GRADIENT,
    start: { x: anchor, y: 0 },
    end: { x: endX, y: 0 },
    stops: [
      { offset: 0, color: { ...TAIL_START_COLOR } },
      { offset: 0.4, color: { ...TAIL_MID_COLOR } },
      { offset: 1, color: { ...TAIL_END_COLOR } },
    ],
  };
};

const getTrailEmitterConfig = (
  instance: SceneObjectInstance
): FireballTrailEmitterRenderConfig | null => {
  const preset = getEmitterPreset(instance, "trailEmitter");
  const intensity = computeTailIntensity(instance);
  return buildEmitterRenderConfig(instance, preset, intensity, {
    minParticleRate: 28,
    particleBase: 0.55,
    particleIntensity: 0.85,
    sizeMinBase: 0.78,
    sizeMinIntensity: 0.35,
    sizeMaxBase: 0.92,
    sizeMaxIntensity: 0.55,
    alphaBase: 0.55,
    alphaIntensity: 0.5,
    offsetBase: 0.65,
    offsetIntensity: 0.45,
    speedBase: 0.78,
    speedIntensity: 0.55,
    jitterBase: 0.55,
    jitterIntensity: 0.5,
  });
};

const getSmokeEmitterConfig = (
  instance: SceneObjectInstance
): FireballTrailEmitterRenderConfig | null => {
  const preset = getEmitterPreset(instance, "smokeEmitter");
  const intensity = computeTailIntensity(instance);
  return buildEmitterRenderConfig(instance, preset, intensity, {
    minParticleRate: 18,
    particleBase: 0.45,
    particleIntensity: 0.6,
    sizeMinBase: 0.95,
    sizeMinIntensity: 0.4,
    sizeMaxBase: 1.05,
    sizeMaxIntensity: 0.65,
    alphaBase: 0.35,
    alphaIntensity: 0.4,
    offsetBase: 0.85,
    offsetIntensity: 0.5,
    speedBase: 0.55,
    speedIntensity: 0.45,
    jitterBase: 0.6,
    jitterIntensity: 0.55,
  });
};

type FireballEmitterPresetKey = "trailEmitter" | "smokeEmitter";

const getEmitterPreset = (
  instance: SceneObjectInstance,
  key: FireballEmitterPresetKey
): FireballTrailEmitterPreset => {
  const data = getCustomData(instance);
  const raw = key === "trailEmitter" ? data.trailEmitter : data.smokeEmitter;
  const fallback =
    key === "trailEmitter"
      ? DEFAULT_TRAIL_EMITTER_PRESET
      : DEFAULT_SMOKE_EMITTER_PRESET;
  return sanitizeTrailEmitterPreset(raw, fallback);
};

interface FireballEmitterBuildOptions {
  minParticleRate: number;
  particleBase: number;
  particleIntensity: number;
  sizeMinBase: number;
  sizeMinIntensity: number;
  sizeMaxBase: number;
  sizeMaxIntensity: number;
  alphaBase: number;
  alphaIntensity: number;
  offsetBase: number;
  offsetIntensity: number;
  speedBase: number;
  speedIntensity: number;
  jitterBase: number;
  jitterIntensity: number;
}

const buildEmitterRenderConfig = (
  instance: SceneObjectInstance,
  preset: FireballTrailEmitterPreset,
  intensity: number,
  options: FireballEmitterBuildOptions
): FireballTrailEmitterRenderConfig | null => {
  const radius = getCoreRadius(instance);
  if (radius <= 0) {
    return null;
  }

  const particlesPerSecond = Math.max(
    options.minParticleRate,
    Math.round(
      preset.particlesPerSecond *
        (options.particleBase + intensity * options.particleIntensity)
    )
  );

  const sizeMin = Math.max(
    0.05,
    radius *
      preset.sizeRange.min *
      (options.sizeMinBase + intensity * options.sizeMinIntensity)
  );
  const sizeMax = Math.max(
    sizeMin,
    radius *
      preset.sizeRange.max *
      (options.sizeMaxBase + intensity * options.sizeMaxIntensity)
  );

  const color = {
    r: preset.color.r,
    g: preset.color.g,
    b: preset.color.b,
    a: clamp01(
      (typeof preset.color.a === "number" ? preset.color.a : 1) *
        (options.alphaBase + intensity * options.alphaIntensity)
    ),
  };

  const fill = scaleFillAlpha(
    preset.fill,
    options.alphaBase + intensity * options.alphaIntensity
  );

  const base = sanitizeParticleEmitterConfig(
    {
      particlesPerSecond,
      particleLifetimeMs: preset.particleLifetimeMs,
      fadeStartMs: Math.min(preset.fadeStartMs, preset.particleLifetimeMs),
      sizeRange: { min: sizeMin, max: sizeMax },
      offset: { x: 0, y: 0 },
      color,
      fill,
      shape: "circle",
      maxParticles: preset.maxParticles,
    },
    {
      defaultColor: color,
      minCapacity: Math.max(
        16,
        Math.ceil((particlesPerSecond * preset.particleLifetimeMs) / 1000)
      ),
      defaultShape: "circle",
    }
  );

  if (!base) {
    return null;
  }

  const offsetDistance =
    radius *
    preset.offsetFactor *
    (options.offsetBase + intensity * options.offsetIntensity);
  const offset = computeEmitterOffset(instance, offsetDistance);

  const baseSpeed = Math.max(
    0,
    preset.baseSpeed * (options.speedBase + intensity * options.speedIntensity)
  );
  const lateralJitter = Math.max(
    0,
    preset.lateralJitter *
      (options.jitterBase + intensity * options.jitterIntensity)
  );

  return {
    ...base,
    offset,
    baseSpeed,
    lateralJitter,
  };
};

const computeEmitterOffset = (
  instance: SceneObjectInstance,
  distance: number
): SceneVector2 => {
  const rotation = instance.data.rotation ?? 0;
  const forward = { x: Math.cos(rotation), y: Math.sin(rotation) };
  return { x: -forward.x * distance, y: -forward.y * distance };
};

const sanitizeTrailEmitterPreset = (
  config: FireballTrailEmitterPresetConfig | undefined,
  fallback: FireballTrailEmitterPreset
): FireballTrailEmitterPreset => {
  if (!config || typeof config !== "object") {
    return cloneTrailEmitterPreset(fallback);
  }

  const particlesPerSecond = sanitizeNumber(
    config.particlesPerSecond,
    fallback.particlesPerSecond,
    0
  );
  const particleLifetimeMs = sanitizeNumber(
    config.particleLifetimeMs,
    fallback.particleLifetimeMs,
    0
  );
  const fadeStartMs = Math.min(
    sanitizeNumber(config.fadeStartMs, fallback.fadeStartMs, 0),
    particleLifetimeMs
  );
  const sizeMin = sanitizeNumber(
    config.sizeRange?.min,
    fallback.sizeRange.min,
    0
  );
  const sizeMax = Math.max(
    sizeMin,
    sanitizeNumber(config.sizeRange?.max, fallback.sizeRange.max, 0)
  );
  const offsetFactor = sanitizeNumber(config.offsetFactor, fallback.offsetFactor, 0);
  const baseSpeed = sanitizeNumber(config.baseSpeed, fallback.baseSpeed, 0);
  const lateralJitter = sanitizeNumber(
    config.lateralJitter,
    fallback.lateralJitter,
    0
  );
  const maxParticles =
    typeof config.maxParticles === "number" && config.maxParticles > 0
      ? Math.floor(config.maxParticles)
      : fallback.maxParticles;

  return {
    particlesPerSecond,
    particleLifetimeMs,
    fadeStartMs,
    sizeRange: { min: sizeMin, max: sizeMax },
    offsetFactor,
    color: cloneColor(config.color ?? fallback.color, fallback.color),
    fill: config.fill
      ? cloneFill(config.fill)
      : fallback.fill
      ? cloneFill(fallback.fill)
      : undefined,
    maxParticles,
    baseSpeed,
    lateralJitter,
  };
};

const cloneTrailEmitterPreset = (
  preset: FireballTrailEmitterPreset
): FireballTrailEmitterPreset => ({
  particlesPerSecond: preset.particlesPerSecond,
  particleLifetimeMs: preset.particleLifetimeMs,
  fadeStartMs: preset.fadeStartMs,
  sizeRange: { min: preset.sizeRange.min, max: preset.sizeRange.max },
  offsetFactor: preset.offsetFactor,
  color: { ...preset.color },
  fill: preset.fill ? cloneFill(preset.fill) : undefined,
  maxParticles: preset.maxParticles,
  baseSpeed: preset.baseSpeed,
  lateralJitter: preset.lateralJitter,
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

const scaleFillAlpha = (
  fill: SceneFill | undefined,
  multiplier: number
): SceneFill | undefined => {
  if (!fill) {
    return undefined;
  }
  const clampedMultiplier = clamp(0, 4, multiplier);
  const cloned = cloneFill(fill);
  switch (cloned.fillType) {
    case FILL_TYPES.SOLID: {
      const baseAlpha =
        typeof cloned.color.a === "number" ? cloned.color.a : 1;
      cloned.color.a = clamp01(baseAlpha * clampedMultiplier);
      break;
    }
    case FILL_TYPES.LINEAR_GRADIENT:
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT:
      cloned.stops = cloned.stops.map((stop) => ({
        offset: stop.offset,
        color: {
          r: stop.color.r,
          g: stop.color.g,
          b: stop.color.b,
          a: clamp01(
            (typeof stop.color.a === "number" ? stop.color.a : 1) *
              clampedMultiplier
          ),
        },
      }));
      break;
    default:
      break;
  }
  return cloned;
};

const sanitizeNumber = (
  value: unknown,
  fallback: number,
  min: number
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return Math.max(min, fallback);
  }
  return value < min ? min : value;
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

const getTrailEmitterOrigin = (
  instance: SceneObjectInstance,
  config: FireballTrailEmitterRenderConfig
): SceneVector2 => {
  return transformObjectPoint(instance.data.position, instance.data.rotation, config.offset);
};

const createTrailParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: FireballTrailEmitterRenderConfig
): ParticleEmitterParticleState => {
  const rotation = (instance.data.rotation ?? 0) + Math.PI; // emit backwards
  const forward = { x: Math.cos(rotation), y: Math.sin(rotation) };
  const perpendicular = { x: -forward.y, y: forward.x };
  const baseSpeed = Math.max(0, config.baseSpeed);
  const jitter = config.lateralJitter;
  const speed = baseSpeed;
  const lateral = (Math.random() - 0.5) * jitter;
  const size = randomBetween(config.sizeRange.min, config.sizeRange.max);

  return {
    position: { x: origin.x, y: origin.y },
    velocity: {
      x: forward.x * speed + perpendicular.x * lateral,
      y: forward.y * speed + perpendicular.y * lateral,
    },
    ageMs: 0,
    lifetimeMs: config.particleLifetimeMs,
    size,
  };
};

const randomBetween = (min: number, max: number): number => {
  if (max <= min) {
    return min;
  }
  return min + Math.random() * (max - min);
};

const clamp = (min: number, max: number, value: number): number => {
  if (value <= min) {
    return min;
  }
  if (value >= max) {
    return max;
  }
  return value;
};
