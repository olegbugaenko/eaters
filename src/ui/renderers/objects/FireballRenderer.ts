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
}

type FireballTrailEmitterConfig = ParticleEmitterBaseConfig & {
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
const PARTICLE_LIFETIME_MS = 420;
const PARTICLE_FADE_START_MS = 260;
const BASE_PARTICLES_PER_SECOND = 70;

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

    const emitterPrimitive = createParticleEmitterPrimitive<FireballTrailEmitterConfig>(
      instance,
      {
        getConfig: getTrailEmitterConfig,
        getOrigin: getTrailEmitterOrigin,
        spawnParticle: createTrailParticle,
      }
    );

    const dynamicPrimitives: DynamicPrimitive[] = [
      tailPrimitive,
      glowPrimitive,
      corePrimitive,
    ];

    if (emitterPrimitive) {
      dynamicPrimitives.push(emitterPrimitive);
    }

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
): FireballTrailEmitterConfig | null => {
  const radius = getCoreRadius(instance);
  if (radius <= 0) {
    return null;
  }
  const glowColor = getGlowColor(instance);
  const intensity = computeTailIntensity(instance);
  const particlesPerSecond = Math.max(
    20,
    Math.round(BASE_PARTICLES_PER_SECOND * (0.6 + intensity * 0.8))
  );
  const base = sanitizeParticleEmitterConfig(
    {
      particlesPerSecond,
      particleLifetimeMs: PARTICLE_LIFETIME_MS,
      fadeStartMs: PARTICLE_FADE_START_MS,
      sizeRange: {
        min: Math.max(0.5, radius * 0.3),
        max: Math.max(0.5, radius * 0.75),
      },
      offset: getTrailOffset(instance, radius, intensity),
      color: { ...glowColor, a: 0.85 },
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: { x: 0, y: 0 },
        end: radius,
        stops: [
          {
            offset: 0,
            color: { r: glowColor.r, g: glowColor.g, b: glowColor.b, a: 0.9 },
          },
          {
            offset: 1,
            color: { r: glowColor.r, g: glowColor.g, b: glowColor.b, a: 0 },
          },
        ],
      },
      shape: "circle",
      maxParticles: Math.ceil((particlesPerSecond * PARTICLE_LIFETIME_MS) / 1000 * 1.5),
    },
    {
      defaultColor: glowColor,
      minCapacity: 24,
      defaultShape: "circle",
    }
  );

  if (!base) {
    return null;
  }

  const speedScale = computeTrailSpeedScale(instance);
  return {
    ...base,
    baseSpeed: 45 + speedScale * 55,
    lateralJitter: 25 + speedScale * 25,
  };
};

const getTrailOffset = (
  instance: SceneObjectInstance,
  radius: number,
  intensity: number
): SceneVector2 => {
  const rotation = instance.data.rotation ?? 0;
  const forward = { x: Math.cos(rotation), y: Math.sin(rotation) };
  const distance = radius * (0.5 + intensity * 0.4);
  return { x: -forward.x * distance, y: -forward.y * distance };
};

const computeTrailSpeedScale = (instance: SceneObjectInstance): number => {
  const speed = getSpeed(instance);
  if (speed <= MIN_SPEED) {
    return 0;
  }
  const maxSpeed = getMaxSpeed(instance);
  if (maxSpeed && maxSpeed > MIN_SPEED) {
    return clamp(0, 1, speed / maxSpeed);
  }
  return clamp(0, 1, speed / 200);
};

const getTrailEmitterOrigin = (
  instance: SceneObjectInstance,
  config: FireballTrailEmitterConfig
): SceneVector2 => {
  return transformObjectPoint(instance.data.position, instance.data.rotation, config.offset);
};

const createTrailParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: FireballTrailEmitterConfig
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
