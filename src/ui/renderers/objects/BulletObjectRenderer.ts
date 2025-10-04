import type { BulletTailEmitterConfig } from "../../../db/bullets-db";
import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
  transformObjectPoint,
} from "./ObjectRenderer";
import {
  FILL_TYPES,
  SceneColor,
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

type BulletTailEmitterRenderConfig = ParticleEmitterBaseConfig & {
  baseSpeed: number;
  speedVariation: number;
  spread: number;
};

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
  const base = sanitizeParticleEmitterConfig(config, {
    defaultOffset: { x: -1, y: 0 },
    defaultColor: { r: 1, g: 1, b: 1, a: 1 },
  });
  if (!base) {
    return null;
  }

  const baseSpeed = Math.max(
    0,
    Number.isFinite(config.baseSpeed) ? Number(config.baseSpeed) : 0
  );
  const speedVariation = Math.max(
    0,
    Number.isFinite(config.speedVariation) ? Number(config.speedVariation) : 0
  );
  const spread = Math.max(
    0,
    Number.isFinite(config.spread) ? Number(config.spread) : 0
  );

  return {
    ...base,
    baseSpeed,
    speedVariation,
    spread,
  };
};

const serializeTailEmitterConfig = (
  config: BulletTailEmitterRenderConfig
): string => {
  const serializedFill = config.fill ? JSON.stringify(config.fill) : "";
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
    config.color.a,
    config.capacity,
    serializedFill,
  ].join(":");
};

const createTailEmitterPrimitive = (
  instance: SceneObjectInstance
): DynamicPrimitive | null =>
  createParticleEmitterPrimitive<BulletTailEmitterRenderConfig>(instance, {
    getConfig: getTailEmitterConfig,
    getOrigin: getTailEmitterOrigin,
    spawnParticle: createTailParticle,
    serializeConfig: serializeTailEmitterConfig,
  });

const createTailParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: BulletTailEmitterRenderConfig
): ParticleEmitterParticleState => {
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

const randomBetween = (min: number, max: number): number => {
  if (max <= min) {
    return min;
  }
  return min + Math.random() * (max - min);
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
