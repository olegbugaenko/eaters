import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneGradientStop,
} from "../logic/services/SceneObjectManager";

export type ExplosionType = "plasmoid" | "magnetic";

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
};

export const getExplosionConfig = (type: ExplosionType): ExplosionConfig => {
  const config = EXPLOSION_DB[type];
  if (!config) {
    throw new Error(`Unknown explosion type: ${type}`);
  }
  return config;
};

export const EXPLOSION_TYPES = Object.keys(EXPLOSION_DB) as ExplosionType[];
