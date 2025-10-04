import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneGradientStop,
  SceneVector2,
} from "../logic/services/SceneObjectManager";

export type ExplosionType =
  | "plasmoid"
  | "magnetic"
  | "grayBrickHit"
  | "grayBrickDestroy";

export interface ExplosionWaveConfig {
  radiusExtension: number;
  startAlpha: number;
  endAlpha: number;
  gradientStops: readonly SceneGradientStop[];
}

export interface ExplosionEmitterConfig {
  emissionDurationMs: number;
  particlesPerSecond: number;
  baseSpeed: number;
  speedVariation: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  sizeRange: { min: number; max: number };
  spawnRadius: { min: number; max: number };
  /**
   * Ensures the maximum spawn radius scales with the initial radius of the explosion.
   */
  spawnRadiusMultiplier: number;
  color: SceneColor;
  arc?: number;
  direction?: number;
  fill?: SceneFill;
}

export interface ExplosionRendererEmitterConfig {
  particlesPerSecond: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  emissionDurationMs: number;
  sizeRange: { min: number; max: number };
  spawnRadius: { min: number; max: number };
  baseSpeed: number;
  speedVariation: number;
  color: SceneColor;
  fill?: SceneFill;
  arc: number;
  direction: number;
  offset?: SceneVector2;
  maxParticles?: number;
}

export interface ExplosionConfig {
  lifetimeMs: number;
  defaultInitialRadius: number;
  wave: ExplosionWaveConfig;
  emitter: ExplosionEmitterConfig;
}

const PLASMOID_WAVE_GRADIENT_STOPS: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1, g: 0.75, b: 0.3, a: 0.8 } },
  { offset: 0.35, color: { r: 1, g: 0.45, b: 0.15, a: 0.55 } },
  { offset: 1, color: { r: 1, g: 0.1, b: 0, a: 0 } },
] as const;

const MAGNETIC_WAVE_GRADIENT_STOPS: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.6, g: 0.4, b: 1, a: 0.85 } },
  { offset: 0.45, color: { r: 0.45, g: 0.2, b: 0.95, a: 0.6 } },
  { offset: 1, color: { r: 0.25, g: 0.05, b: 0.7, a: 0 } },
] as const;

const GRAY_BRICK_HIT_WAVE_GRADIENT_STOPS: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.92, g: 0.92, b: 0.94, a: 0.45 } },
  { offset: 0.4, color: { r: 0.75, g: 0.77, b: 0.8, a: 0.25 } },
  { offset: 1, color: { r: 0.55, g: 0.58, b: 0.6, a: 0 } },
] as const;

const GRAY_BRICK_DESTROY_WAVE_GRADIENT_STOPS: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.95, g: 0.95, b: 0.97, a: 0.6 } },
  { offset: 0.35, color: { r: 0.78, g: 0.8, b: 0.84, a: 0.35 } },
  { offset: 1, color: { r: 0.45, g: 0.48, b: 0.52, a: 0 } },
] as const;

const DEFAULT_EMITTER_FILL: SceneFill = {
  fillType: FILL_TYPES.SOLID,
  color: { r: 1, g: 0.85, b: 0.55, a: 1 },
};

const MAGNETIC_EMITTER_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 8,
  stops: [
    { offset: 0, color: { r: 1, g: 1, b: 1, a: 0.95 } },
    { offset: 0.4, color: { r: 0.7, g: 0.6, b: 1, a: 0.6 } },
    { offset: 1, color: { r: 0.4, g: 0.2, b: 0.9, a: 0 } },
  ],
};

const GRAY_BRICK_EMITTER_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 5,
  stops: [
    { offset: 0, color: { r: 0.9, g: 0.9, b: 0.92, a: 0.85 } },
    { offset: 0.45, color: { r: 0.72, g: 0.74, b: 0.78, a: 0.4 } },
    { offset: 1, color: { r: 0.45, g: 0.48, b: 0.52, a: 0 } },
  ],
};

const DEFAULT_EMITTER: ExplosionEmitterConfig = {
  emissionDurationMs: 700,
  particlesPerSecond: 260,
  baseSpeed: 0.1,
  speedVariation: 0.05,
  particleLifetimeMs: 1_400,
  fadeStartMs: 700,
  sizeRange: { min: 1, max: 2 },
  spawnRadius: { min: 0, max: 12 },
  spawnRadiusMultiplier: 1.5,
  color: { r: 1, g: 0.85, b: 0.55, a: 1 },
  arc: Math.PI * 2,
  direction: 0,
  fill: DEFAULT_EMITTER_FILL,
};

const GRAY_BRICK_DAMAGE_EMITTER: ExplosionEmitterConfig = {
  emissionDurationMs: 240,
  particlesPerSecond: 130,
  baseSpeed: 0.08,
  speedVariation: 0.03,
  particleLifetimeMs: 650,
  fadeStartMs: 280,
  sizeRange: { min: 0.6, max: 1.4 },
  spawnRadius: { min: 0, max: 5 },
  spawnRadiusMultiplier: 1.2,
  color: { r: 0.82, g: 0.84, b: 0.88, a: 1 },
  arc: Math.PI * 2,
  direction: 0,
  fill: GRAY_BRICK_EMITTER_FILL,
};

const GRAY_BRICK_DESTRUCTION_EMITTER: ExplosionEmitterConfig = {
  emissionDurationMs: 520,
  particlesPerSecond: 280,
  baseSpeed: 0.12,
  speedVariation: 0.06,
  particleLifetimeMs: 1_000,
  fadeStartMs: 480,
  sizeRange: { min: 0.8, max: 1.9 },
  spawnRadius: { min: 0, max: 8 },
  spawnRadiusMultiplier: 1.5,
  color: { r: 0.85, g: 0.87, b: 0.92, a: 1 },
  arc: Math.PI * 2,
  direction: 0,
  fill: GRAY_BRICK_EMITTER_FILL,
};

const EXPLOSION_DB: Record<ExplosionType, ExplosionConfig> = {
  plasmoid: {
    lifetimeMs: 3_000,
    defaultInitialRadius: 12,
    wave: {
      radiusExtension: 180,
      startAlpha: 0.85,
      endAlpha: 0,
      gradientStops: PLASMOID_WAVE_GRADIENT_STOPS,
    },
    emitter: DEFAULT_EMITTER,
  },
  magnetic: {
    lifetimeMs: 3_000,
    defaultInitialRadius: 12,
    wave: {
      radiusExtension: 180,
      startAlpha: 0.85,
      endAlpha: 0,
      gradientStops: MAGNETIC_WAVE_GRADIENT_STOPS,
    },
    emitter: {
      ...DEFAULT_EMITTER,
      color: { r: 1, g: 1, b: 1, a: 1 },
      fill: MAGNETIC_EMITTER_FILL,
      arc: Math.PI / 2,
      direction: Math.PI,
    },
  },
  grayBrickHit: {
    lifetimeMs: 1_000,
    defaultInitialRadius: 6,
    wave: {
      radiusExtension: 40,
      startAlpha: 0.4,
      endAlpha: 0,
      gradientStops: GRAY_BRICK_HIT_WAVE_GRADIENT_STOPS,
    },
    emitter: GRAY_BRICK_DAMAGE_EMITTER,
  },
  grayBrickDestroy: {
    lifetimeMs: 1_600,
    defaultInitialRadius: 10,
    wave: {
      radiusExtension: 90,
      startAlpha: 0.55,
      endAlpha: 0,
      gradientStops: GRAY_BRICK_DESTROY_WAVE_GRADIENT_STOPS,
    },
    emitter: GRAY_BRICK_DESTRUCTION_EMITTER,
  },
};

export const getExplosionConfig = (type: ExplosionType): ExplosionConfig => {
  const config = EXPLOSION_DB[type];
  if (!config) {
    throw new Error(`Unknown explosion type: ${type}`);
  }
  return config;
};

export const EXPLOSION_TYPES = Object.keys(EXPLOSION_DB) as ExplosionType[];
