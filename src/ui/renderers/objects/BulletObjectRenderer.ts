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

interface BulletTailRenderConfig {
  lengthMultiplier: number;
  widthMultiplier: number;
  startColor: SceneColor;
  endColor: SceneColor;
}

interface BulletGlowConfig {
  color?: SceneColor;
  radiusMultiplier?: number;
}

interface BulletRendererCustomData {
  tail?: Partial<BulletTailRenderConfig>;
  tailEmitter?: BulletTailEmitterConfig;
  trailEmitter?: BulletTailEmitterConfig;
  smokeEmitter?: BulletTailEmitterConfig;
  glow?: BulletGlowConfig;
  speed?: number;
  maxSpeed?: number;
  velocity?: SceneVector2;
  shape?: "circle" | "triangle";
  renderComponents?: {
    body?: boolean;
    tail?: boolean;
    glow?: boolean;
    emitters?: boolean;
  };
}

type BulletTailEmitterRenderConfig = ParticleEmitterBaseConfig & {
  baseSpeed: number;
  speedVariation: number;
  spread: number;
};

type BulletEmitterKey = "tailEmitter" | "trailEmitter" | "smokeEmitter";

const tailConfigCache = new WeakMap<
  SceneObjectInstance,
  {
    source: BulletRendererCustomData["tail"] | undefined;
    config: BulletTailRenderConfig;
  }
>();
const tailEmitterConfigCache = new WeakMap<
  SceneObjectInstance,
  {
    source: BulletRendererCustomData["tailEmitter"] | undefined;
    config: BulletTailEmitterRenderConfig | null;
  }
>();
const trailEmitterConfigCache = new WeakMap<
  SceneObjectInstance,
  {
    source: BulletRendererCustomData["trailEmitter"] | undefined;
    config: BulletTailEmitterRenderConfig | null;
  }
>();
const smokeEmitterConfigCache = new WeakMap<
  SceneObjectInstance,
  {
    source: BulletRendererCustomData["smokeEmitter"] | undefined;
    config: BulletTailEmitterRenderConfig | null;
  }
>();
const tailFillCache = new WeakMap<
  SceneObjectInstance,
  { radius: number; tailRef: BulletTailRenderConfig; fill: SceneLinearGradientFill }
>();
const glowFillCache = new WeakMap<
  SceneObjectInstance,
  {
    radius: number;
    source: BulletGlowConfig | undefined;
    fill: SceneFill;
  }
>();

// OPTIMIZATION: Cache vertices to avoid creating new objects every frame
const tailVerticesCache = new WeakMap<
  SceneObjectInstance,
  { radius: number; tailRef: BulletTailRenderConfig; vertices: [SceneVector2, SceneVector2, SceneVector2] }
>();
const triangleVerticesCache = new WeakMap<
  SceneObjectInstance,
  { radius: number; vertices: [SceneVector2, SceneVector2, SceneVector2] }
>();

const getRenderComponents = (instance: SceneObjectInstance) => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  const components = data?.renderComponents;
  // renderComponents lets callers (like GPU-driven projectiles that still need
  // CPU-only effects) selectively disable parts of the bullet without changing
  // its renderer type. By default everything renders unless explicitly turned off.
  return {
    body: components?.body !== false,
    tail: components?.tail !== false,
    glow: components?.glow !== false,
    emitters: components?.emitters !== false,
  };
};

const DEFAULT_TAIL_CONFIG: BulletTailRenderConfig = {
  lengthMultiplier: 4.5,
  widthMultiplier: 1.75,
  startColor: { r: 0.25, g: 0.45, b: 1, a: 0.65 },
  endColor: { r: 0.05, g: 0.15, b: 0.6, a: 0 },
};

const DEFAULT_GLOW_COLOR: SceneColor = { r: 1, g: 1, b: 1, a: 0.4 };
const DEFAULT_GLOW_RADIUS_MULTIPLIER = 1.8;
const MIN_SPEED = 0.01;
const DEFAULT_SPEED_FOR_TAIL_SCALE = 120;

const cloneColor = (
  color: SceneColor | undefined,
  fallback: SceneColor,
): SceneColor => ({
  r: typeof color?.r === "number" ? color.r : fallback.r,
  g: typeof color?.g === "number" ? color.g : fallback.g,
  b: typeof color?.b === "number" ? color.b : fallback.b,
  a: typeof color?.a === "number" ? color.a : fallback.a,
});

const clamp = (min: number, max: number, value: number): number => {
  if (value <= min) {
    return min;
  }
  if (value >= max) {
    return max;
  }
  return value;
};

const getTailScale = (instance: SceneObjectInstance): number => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  const speed =
    typeof data?.speed === "number" && Number.isFinite(data.speed)
      ? data.speed
      : (() => {
          const velocity =
            data?.velocity && typeof data.velocity === "object"
              ? data.velocity
              : null;
          if (!velocity) {
            return 0;
          }
          const { x, y } = velocity;
          return Math.hypot(x ?? 0, y ?? 0);
        })();

  if (speed <= MIN_SPEED) {
    return 0.8;
  }

  const maxSpeed =
    typeof data?.maxSpeed === "number" && Number.isFinite(data.maxSpeed)
      ? data.maxSpeed
      : undefined;

  if (maxSpeed && maxSpeed > MIN_SPEED) {
    return clamp(0.8, 1.8, speed / maxSpeed);
  }

  return clamp(0.8, 1.6, speed / DEFAULT_SPEED_FOR_TAIL_SCALE);
};

const getTailConfig = (instance: SceneObjectInstance): BulletTailRenderConfig => {
  const { tail: shouldRenderTail } = getRenderComponents(instance);
  if (!shouldRenderTail) {
    return DEFAULT_TAIL_CONFIG;
  }

  const data = instance.data.customData as BulletRendererCustomData | undefined;
  const tail = data && typeof data === "object" ? data.tail : undefined;
  const cached = tailConfigCache.get(instance);
  if (cached && cached.source === tail) {
    return cached.config;
  }

  if (!tail) {
    return DEFAULT_TAIL_CONFIG;
  }

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

  const scale = getTailScale(instance);

  const config: BulletTailRenderConfig = {
    lengthMultiplier: lengthMultiplier * scale,
    widthMultiplier: widthMultiplier * scale,
    startColor,
    endColor,
  };

  tailConfigCache.set(instance, { source: tail, config });

  return config;
};

const getEmitterConfig = (
  instance: SceneObjectInstance,
  key: BulletEmitterKey,
  cache:
    | typeof tailEmitterConfigCache
    | typeof trailEmitterConfigCache
    | typeof smokeEmitterConfigCache,
): BulletTailEmitterRenderConfig | null => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  const emitter = data && typeof data === "object" ? data[key] : undefined;
  const cached = cache.get(instance);
  if (cached && cached.source === emitter) {
    return cached.config;
  }

  const config = emitter ? sanitizeTailEmitterConfig(emitter) : null;
  cache.set(instance, { source: emitter, config });

  return config;
};

const getTailEmitterConfig = (
  instance: SceneObjectInstance
): BulletTailEmitterRenderConfig | null => getEmitterConfig(instance, "tailEmitter", tailEmitterConfigCache);

const getTrailEmitterConfig = (
  instance: SceneObjectInstance
): BulletTailEmitterRenderConfig | null => getEmitterConfig(instance, "trailEmitter", trailEmitterConfigCache);

const getSmokeEmitterConfig = (
  instance: SceneObjectInstance
): BulletTailEmitterRenderConfig | null => getEmitterConfig(instance, "smokeEmitter", smokeEmitterConfigCache);

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
    config.shape,
  ].join(":");
};

const createEmitterPrimitive = (
  instance: SceneObjectInstance,
  getConfig: (instance: SceneObjectInstance) => BulletTailEmitterRenderConfig | null,
): DynamicPrimitive | null =>
  createParticleEmitterPrimitive<BulletTailEmitterRenderConfig>(instance, {
    getConfig,
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

const getGlowConfig = (
  instance: SceneObjectInstance
): { color: SceneColor; radiusMultiplier: number } | null => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  const glow = data?.glow;
  if (!glow) {
    return null;
  }

  const radiusMultiplier =
    typeof glow.radiusMultiplier === "number" && Number.isFinite(glow.radiusMultiplier)
      ? Math.max(0, glow.radiusMultiplier)
      : DEFAULT_GLOW_RADIUS_MULTIPLIER;

  return {
    color: cloneColor(glow.color, DEFAULT_GLOW_COLOR),
    radiusMultiplier,
  };
};

const getGlowRadius = (instance: SceneObjectInstance): number => {
  const glow = getGlowConfig(instance);
  if (!glow) {
    return 0;
  }
  const radius = getBulletRadius(instance);
  const tailScale = getTailScale(instance);
  return radius * glow.radiusMultiplier * Math.max(1, tailScale * 0.9);
};

const createGlowFill = (
  instance: SceneObjectInstance,
  glow: { color: SceneColor; radiusMultiplier: number }
): SceneFill => {
  const customData = instance.data.customData as BulletRendererCustomData | undefined;
  const radius = getGlowRadius(instance);
  const cached = glowFillCache.get(instance);
  if (cached && cached.radius === radius && cached.source === customData?.glow) {
    return cached.fill;
  }

  const fill: SceneFill = {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    end: radius,
    stops: [
      { offset: 0, color: { ...glow.color, a: (glow.color.a ?? 0.4) * 0.7 } },
      { offset: 0.55, color: { ...glow.color, a: (glow.color.a ?? 0.4) * 0.35 } },
      { offset: 1, color: { ...glow.color, a: 0 } },
    ],
  };

  glowFillCache.set(instance, {
    radius,
    source: customData?.glow,
    fill,
  });

  return fill;
};

const getProjectileShape = (instance: SceneObjectInstance): "circle" | "triangle" => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  return data?.shape ?? "circle";
};

const createTriangleVertices = (instance: SceneObjectInstance): [SceneVector2, SceneVector2, SceneVector2] => {
  const radius = getBulletRadius(instance);
  
  // OPTIMIZATION: Cache vertices to avoid creating new objects every frame
  const cached = triangleVerticesCache.get(instance);
  if (cached && cached.radius === radius) {
    return cached.vertices;
  }
  
  // Трикутник, спрямований вершиною вперед (у напрямку руху)
  // Вершина вперед
  const tip = { x: radius*2, y: 0 };
  // Дві задні вершини
  const baseLeft = { x: -radius * 0.6, y: radius * 0.8 };
  const baseRight = { x: -radius * 0.6, y: -radius * 0.8 };
  const vertices: [SceneVector2, SceneVector2, SceneVector2] = [tip, baseLeft, baseRight];
  
  triangleVerticesCache.set(instance, { radius, vertices });
  return vertices;
};

const createTailVertices = (
  instance: SceneObjectInstance
): [SceneVector2, SceneVector2, SceneVector2] => {
  const radius = getBulletRadius(instance);
  const tail = getTailConfig(instance);
  
  // OPTIMIZATION: Cache vertices to avoid creating new objects every frame
  const cached = tailVerticesCache.get(instance);
  if (cached && cached.radius === radius && cached.tailRef === tail) {
    return cached.vertices;
  }
  
  const tailLength = radius * tail.lengthMultiplier;
  const tailHalfWidth = (radius * tail.widthMultiplier) / 2;
  const vertices: [SceneVector2, SceneVector2, SceneVector2] = [
    { x: -radius / 2, y: tailHalfWidth },
    { x: -radius / 2, y: -tailHalfWidth },
    { x: -radius / 2 - tailLength, y: 0 },
  ];
  
  tailVerticesCache.set(instance, { radius, tailRef: tail, vertices });
  return vertices;
};

const createTailFill = (
  instance: SceneObjectInstance
): SceneLinearGradientFill => {
  const radius = getBulletRadius(instance);
  const tail = getTailConfig(instance);
  const cached = tailFillCache.get(instance);
  if (cached && cached.radius === radius && cached.tailRef === tail) {
    return cached.fill;
  }

  const tailLength = radius * tail.lengthMultiplier;
  const fill: SceneLinearGradientFill = {
    fillType: FILL_TYPES.LINEAR_GRADIENT,
    start: { x: tailLength, y: 0 },
    end: { x: 0, y: 0 },
    stops: [
      { offset: 0, color: { ...tail.startColor } },
      { offset: 1, color: { ...tail.endColor } },
    ],
  };

  tailFillCache.set(instance, { radius, tailRef: tail, fill });

  return fill;
};

const randomBetween = (min: number, max: number): number => {
  if (max <= min) {
    return min;
  }
  return min + Math.random() * (max - min);
};

export class BulletObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const components = getRenderComponents(instance);

    const emitterPrimitive =
      components.emitters && createEmitterPrimitive(instance, getTailEmitterConfig);
    const trailEmitter =
      components.emitters && createEmitterPrimitive(instance, getTrailEmitterConfig);
    const smokeEmitter =
      components.emitters && createEmitterPrimitive(instance, getSmokeEmitterConfig);
    const dynamicPrimitives: DynamicPrimitive[] = [];
    if (emitterPrimitive) {
      dynamicPrimitives.push(emitterPrimitive);
    }
    if (trailEmitter) {
      dynamicPrimitives.push(trailEmitter);
    }
    if (smokeEmitter) {
      dynamicPrimitives.push(smokeEmitter);
    }

    // OPTIMIZATION: Pre-compute vertices and fill at registration time
    // This allows primitives to use their fast-path (skip update when position unchanged)
    if (components.tail) {
      const tailVertices = createTailVertices(instance);
      const tailFill = createTailFill(instance);
      dynamicPrimitives.push(
        createDynamicTrianglePrimitive(instance, {
          vertices: tailVertices,
          fill: tailFill,
        })
      );
    }

    const glowConfig = components.glow ? getGlowConfig(instance) : null;
    if (glowConfig) {
      const glowFill = createGlowFill(instance, glowConfig);
      dynamicPrimitives.push(
        createDynamicCirclePrimitive(instance, {
          getRadius: getGlowRadius,
          fill: glowFill,
        }),
      );
    }

    if (components.body) {
      const shape = getProjectileShape(instance);
      if (shape === "triangle") {
        // Рендеримо трикутник як основну форму проджектайла
        const triangleVertices = createTriangleVertices(instance);
        dynamicPrimitives.push(
          createDynamicTrianglePrimitive(instance, {
            vertices: triangleVertices,
            fill: instance.data.fill,
          })
        );
      } else {
        // Рендеримо коло як основну форму проджектайла
        // Pre-resolve fill to enable fast-path
        dynamicPrimitives.push(createDynamicCirclePrimitive(instance, {
          fill: instance.data.fill,
        }));
      }
    }

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
