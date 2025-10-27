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
import type { FireballTrailEmitterConfig } from "../../../logic/modules/scene/FireballModule";

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
  trailEmitter?: FireballTrailEmitterConfig;
  smokeEmitter?: FireballTrailEmitterConfig;
}

type FireballEmitterRenderConfig = ParticleEmitterBaseConfig & {
  baseSpeed: number;
  speedVariation: number;
  spread: number;
  physicalSize: number;
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

type FireballEmitterKey = "trailEmitter" | "smokeEmitter";

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

    const smokeEmitterPrimitive = createParticleEmitterPrimitive<FireballEmitterRenderConfig>(
      instance,
      {
        getConfig: getSmokeEmitterConfig,
        getOrigin: getEmitterOrigin,
        spawnParticle: createEmitterParticle,
        serializeConfig: serializeEmitterConfig,
      }
    );

    const trailEmitterPrimitive = createParticleEmitterPrimitive<FireballEmitterRenderConfig>(
      instance,
      {
        getConfig: getTrailEmitterConfig,
        getOrigin: getEmitterOrigin,
        spawnParticle: createEmitterParticle,
        serializeConfig: serializeEmitterConfig,
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
): FireballEmitterRenderConfig | null => getEmitterConfig(instance, "trailEmitter");

const getSmokeEmitterConfig = (
  instance: SceneObjectInstance
): FireballEmitterRenderConfig | null => getEmitterConfig(instance, "smokeEmitter");

const getEmitterConfig = (
  instance: SceneObjectInstance,
  key: FireballEmitterKey
): FireballEmitterRenderConfig | null => {
  const data = getCustomData(instance);
  const raw = key === "trailEmitter" ? data.trailEmitter : data.smokeEmitter;
  if (!raw) {
    return null;
  }

  const base = sanitizeParticleEmitterConfig(raw, {
    defaultColor: raw.color,
    defaultOffset: raw.offset,
    minCapacity: Math.max(
      8,
      Math.ceil((raw.particlesPerSecond * raw.particleLifetimeMs) / 1000)
    ),
    defaultShape: raw.shape === "circle" ? "circle" : "square",
  });
  if (!base) {
    return null;
  }

  const radius = getCoreRadius(instance);

  const baseSpeed =
    typeof raw.baseSpeed === "number" && Number.isFinite(raw.baseSpeed)
      ? Math.max(0, raw.baseSpeed)
      : 0;
  const speedVariation =
    typeof raw.speedVariation === "number" && Number.isFinite(raw.speedVariation)
      ? Math.max(0, raw.speedVariation)
      : 0;
  const spread =
    typeof raw.spread === "number" && Number.isFinite(raw.spread)
      ? Math.max(0, raw.spread)
      : 0;

  return {
    ...base,
    baseSpeed,
    speedVariation,
    spread,
    physicalSize: Math.max(radius, 1),
  };
};

const getEmitterOrigin = (
  instance: SceneObjectInstance,
  config: FireballEmitterRenderConfig
): SceneVector2 => {
  const scale = Math.max(config.physicalSize, 1);
  const offset = {
    x: config.offset.x * scale,
    y: config.offset.y * scale,
  };
  return transformObjectPoint(instance.data.position, instance.data.rotation, offset);
};

const createEmitterParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: FireballEmitterRenderConfig
): ParticleEmitterParticleState => {
  const baseDirection = (instance.data.rotation ?? 0) + Math.PI;
  const halfSpread = config.spread / 2;
  const direction =
    baseDirection + (config.spread > 0 ? randomBetween(-halfSpread, halfSpread) : 0);
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

const serializeEmitterConfig = (
  config: FireballEmitterRenderConfig
): string => {
  const serializedFill = config.fill ? JSON.stringify(config.fill) : "";
  const alpha = typeof config.color.a === "number" ? config.color.a : 1;
  return [
    config.particlesPerSecond,
    config.particleLifetimeMs,
    config.fadeStartMs,
    config.sizeRange.min.toFixed(3),
    config.sizeRange.max.toFixed(3),
    config.offset.x.toFixed(3),
    config.offset.y.toFixed(3),
    config.color.r.toFixed(3),
    config.color.g.toFixed(3),
    config.color.b.toFixed(3),
    alpha.toFixed(3),
    config.emissionDurationMs ?? -1,
    config.capacity,
    config.baseSpeed.toFixed(3),
    config.speedVariation.toFixed(3),
    config.spread.toFixed(3),
    config.physicalSize.toFixed(3),
    serializedFill,
  ].join(":");
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
