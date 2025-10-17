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
  | "grayBrickDestroy"
  | "yellowBrickHit"
  | "yellowBrickDestroy"
  | "organicBrickHit"
  | "organicBrickDestroy"
  | "ironBrickHit"
  | "ironBrickDestroy"
  | "woodBrickHit"
  | "woodBrickDestroy"
  | "copperBrickHit"
  | "copperBrickDestroy"
  | "silverBrickHit"
  | "silverBrickDestroy"
  | "coalBrickHit"
  | "coalBrickDestroy"
  | "criticalHit";

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

const CRITICAL_HIT_WAVE_GRADIENT_STOPS: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1, g: 0.35, b: 0.35, a: 0.85 } },
  { offset: 0.4, color: { r: 0.9, g: 0.12, b: 0.12, a: 0.55 } },
  { offset: 1, color: { r: 0.55, g: 0, b: 0, a: 0 } },
] as const;

// Color-themed waves for non-gray bricks
const YELLOW_BRICK_HIT_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.95, g: 0.92, b: 0.55, a: 0.45 } },
  { offset: 0.4, color: { r: 0.85, g: 0.8, b: 0.35, a: 0.25 } },
  { offset: 1, color: { r: 0.65, g: 0.6, b: 0.2, a: 0 } },
] as const;
const YELLOW_BRICK_DESTROY_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1, g: 0.95, b: 0.6, a: 0.6 } },
  { offset: 0.35, color: { r: 0.9, g: 0.82, b: 0.4, a: 0.35 } },
  { offset: 1, color: { r: 0.7, g: 0.6, b: 0.25, a: 0 } },
] as const;

const GREEN_BRICK_HIT_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.6, g: 0.95, b: 0.65, a: 0.45 } },
  { offset: 0.4, color: { r: 0.35, g: 0.85, b: 0.45, a: 0.25 } },
  { offset: 1, color: { r: 0.1, g: 0.55, b: 0.15, a: 0 } },
] as const;
const GREEN_BRICK_DESTROY_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.6, g: 1, b: 0.7, a: 0.6 } },
  { offset: 0.35, color: { r: 0.4, g: 0.9, b: 0.5, a: 0.35 } },
  { offset: 1, color: { r: 0.1, g: 0.6, b: 0.15, a: 0 } },
] as const;

const ORANGE_BRICK_HIT_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1, g: 0.8, b: 0.55, a: 0.5 } },
  { offset: 0.4, color: { r: 0.95, g: 0.55, b: 0.2, a: 0.28 } },
  { offset: 1, color: { r: 0.75, g: 0.35, b: 0.1, a: 0 } },
] as const;
const ORANGE_BRICK_DESTROY_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1, g: 0.85, b: 0.6, a: 0.65 } },
  { offset: 0.35, color: { r: 0.95, g: 0.6, b: 0.25, a: 0.4 } },
  { offset: 1, color: { r: 0.8, g: 0.4, b: 0.12, a: 0 } },
] as const;

const BROWN_BRICK_HIT_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.7, g: 0.5, b: 0.3, a: 0.45 } },
  { offset: 0.4, color: { r: 0.55, g: 0.4, b: 0.2, a: 0.25 } },
  { offset: 1, color: { r: 0.35, g: 0.25, b: 0.12, a: 0 } },
] as const;
const BROWN_BRICK_DESTROY_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.75, g: 0.55, b: 0.35, a: 0.6 } },
  { offset: 0.35, color: { r: 0.6, g: 0.45, b: 0.25, a: 0.35 } },
  { offset: 1, color: { r: 0.4, g: 0.3, b: 0.15, a: 0 } },
] as const;

const SILVER_BRICK_HIT_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.92, g: 0.93, b: 0.96, a: 0.5 } },
  { offset: 0.45, color: { r: 0.82, g: 0.83, b: 0.88, a: 0.3 } },
  { offset: 1, color: { r: 0.72, g: 0.73, b: 0.78, a: 0 } },
] as const;
const SILVER_BRICK_DESTROY_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1, g: 1, b: 1, a: 0.65 } },
  { offset: 0.45, color: { r: 0.85, g: 0.87, b: 0.9, a: 0.4 } },
  { offset: 1, color: { r: 0.75, g: 0.76, b: 0.8, a: 0 } },
] as const;

const COAL_BRICK_HIT_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.3, g: 0.3, b: 0.32, a: 0.5 } },
  { offset: 0.5, color: { r: 0.18, g: 0.18, b: 0.2, a: 0.3 } },
  { offset: 1, color: { r: 0.08, g: 0.08, b: 0.1, a: 0 } },
] as const;
const COAL_BRICK_DESTROY_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.36, g: 0.36, b: 0.38, a: 0.65 } },
  { offset: 0.5, color: { r: 0.22, g: 0.22, b: 0.25, a: 0.4 } },
  { offset: 1, color: { r: 0.1, g: 0.1, b: 0.12, a: 0 } },
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
const YELLOW_BRICK_EMITTER_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 6,
  stops: [
    { offset: 0, color: { r: 1, g: 0.95, b: 0.6, a: 0.95 } },
    { offset: 0.45, color: { r: 0.95, g: 0.85, b: 0.45, a: 0.6 } },
    { offset: 1, color: { r: 0.8, g: 0.7, b: 0.35, a: 0 } },
  ],
};
const GREEN_BRICK_EMITTER_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 6,
  stops: [
    { offset: 0, color: { r: 0.6, g: 1, b: 0.7, a: 0.95 } },
    { offset: 0.45, color: { r: 0.4, g: 0.9, b: 0.5, a: 0.6 } },
    { offset: 1, color: { r: 0.15, g: 0.65, b: 0.2, a: 0 } },
  ],
};
const ORANGE_BRICK_EMITTER_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 6,
  stops: [
    { offset: 0, color: { r: 1, g: 0.85, b: 0.6, a: 0.95 } },
    { offset: 0.45, color: { r: 1, g: 0.6, b: 0.25, a: 0.6 } },
    { offset: 1, color: { r: 0.85, g: 0.4, b: 0.12, a: 0 } },
  ],
};
const BROWN_BRICK_EMITTER_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 6,
  stops: [
    { offset: 0, color: { r: 0.75, g: 0.55, b: 0.35, a: 0.95 } },
    { offset: 0.45, color: { r: 0.6, g: 0.45, b: 0.25, a: 0.6 } },
    { offset: 1, color: { r: 0.4, g: 0.3, b: 0.15, a: 0 } },
  ],
};
const SILVER_BRICK_EMITTER_FILL2: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 6,
  stops: [
    { offset: 0, color: { r: 0.95, g: 0.96, b: 0.98, a: 0.95 } },
    { offset: 0.45, color: { r: 0.85, g: 0.86, b: 0.9, a: 0.6 } },
    { offset: 1, color: { r: 0.75, g: 0.76, b: 0.8, a: 0 } },
  ],
};
const COAL_BRICK_EMITTER_FILL2: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 6,
  stops: [
    { offset: 0, color: { r: 0.3, g: 0.3, b: 0.32, a: 0.95 } },
    { offset: 0.45, color: { r: 0.18, g: 0.18, b: 0.2, a: 0.6 } },
    { offset: 1, color: { r: 0.1, g: 0.1, b: 0.12, a: 0 } },
  ],
};

const CRITICAL_HIT_EMITTER_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 6,
  stops: [
    { offset: 0, color: { r: 1, g: 0.65, b: 0.65, a: 0.95 } },
    { offset: 0.45, color: { r: 0.95, g: 0.28, b: 0.28, a: 0.5 } },
    { offset: 1, color: { r: 0.7, g: 0.05, b: 0.05, a: 0 } },
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
  emissionDurationMs: 340,
  particlesPerSecond: 60,
  baseSpeed: 0.08,
  speedVariation: 0.03,
  particleLifetimeMs: 550,
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
  particlesPerSecond: 140,
  baseSpeed: 0.12,
  speedVariation: 0.06,
  particleLifetimeMs: 750,
  fadeStartMs: 480,
  sizeRange: { min: 0.8, max: 1.9 },
  spawnRadius: { min: 0, max: 8 },
  spawnRadiusMultiplier: 1.5,
  color: { r: 0.85, g: 0.87, b: 0.92, a: 1 },
  arc: Math.PI * 2,
  direction: 0,
  fill: GRAY_BRICK_EMITTER_FILL,
};

const CRITICAL_HIT_EMITTER: ExplosionEmitterConfig = {
  emissionDurationMs: 240,
  particlesPerSecond: 220,
  baseSpeed: 0.16,
  speedVariation: 0.05,
  particleLifetimeMs: 520,
  fadeStartMs: 220,
  sizeRange: { min: 0.8, max: 1.6 },
  spawnRadius: { min: 0, max: 6 },
  spawnRadiusMultiplier: 1.1,
  color: { r: 0.95, g: 0.2, b: 0.2, a: 1 },
  arc: Math.PI * 2,
  direction: 0,
  fill: CRITICAL_HIT_EMITTER_FILL,
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
  yellowBrickHit: {
    lifetimeMs: 1_000,
    defaultInitialRadius: 6,
    wave: {
      radiusExtension: 40,
      startAlpha: 0.45,
      endAlpha: 0,
      gradientStops: YELLOW_BRICK_HIT_WAVE,
    },
    emitter: { ...GRAY_BRICK_DAMAGE_EMITTER, color: { r: 1, g: 0.95, b: 0.6, a: 1 }, fill: YELLOW_BRICK_EMITTER_FILL },
  },
  yellowBrickDestroy: {
    lifetimeMs: 1_600,
    defaultInitialRadius: 10,
    wave: {
      radiusExtension: 90,
      startAlpha: 0.6,
      endAlpha: 0,
      gradientStops: YELLOW_BRICK_DESTROY_WAVE,
    },
    emitter: { ...GRAY_BRICK_DESTRUCTION_EMITTER, color: { r: 1, g: 0.95, b: 0.6, a: 1 }, fill: YELLOW_BRICK_EMITTER_FILL },
  },
  organicBrickHit: {
    lifetimeMs: 1_000,
    defaultInitialRadius: 6,
    wave: {
      radiusExtension: 40,
      startAlpha: 0.45,
      endAlpha: 0,
      gradientStops: GREEN_BRICK_HIT_WAVE,
    },
    emitter: { ...GRAY_BRICK_DAMAGE_EMITTER, color: { r: 0.6, g: 1, b: 0.7, a: 1 }, fill: GREEN_BRICK_EMITTER_FILL },
  },
  organicBrickDestroy: {
    lifetimeMs: 1_600,
    defaultInitialRadius: 10,
    wave: {
      radiusExtension: 90,
      startAlpha: 0.6,
      endAlpha: 0,
      gradientStops: GREEN_BRICK_DESTROY_WAVE,
    },
    emitter: { ...GRAY_BRICK_DESTRUCTION_EMITTER, color: { r: 0.6, g: 1, b: 0.7, a: 1 }, fill: GREEN_BRICK_EMITTER_FILL },
  },
  ironBrickHit: {
    lifetimeMs: 1_000,
    defaultInitialRadius: 6,
    wave: {
      radiusExtension: 40,
      startAlpha: 0.5,
      endAlpha: 0,
      gradientStops: ORANGE_BRICK_HIT_WAVE,
    },
    emitter: { ...GRAY_BRICK_DAMAGE_EMITTER, color: { r: 1, g: 0.8, b: 0.55, a: 1 }, fill: ORANGE_BRICK_EMITTER_FILL },
  },
  ironBrickDestroy: {
    lifetimeMs: 1_600,
    defaultInitialRadius: 10,
    wave: {
      radiusExtension: 90,
      startAlpha: 0.65,
      endAlpha: 0,
      gradientStops: ORANGE_BRICK_DESTROY_WAVE,
    },
    emitter: { ...GRAY_BRICK_DESTRUCTION_EMITTER, color: { r: 1, g: 0.8, b: 0.55, a: 1 }, fill: ORANGE_BRICK_EMITTER_FILL },
  },
  woodBrickHit: {
    lifetimeMs: 1_000,
    defaultInitialRadius: 6,
    wave: {
      radiusExtension: 40,
      startAlpha: 0.45,
      endAlpha: 0,
      gradientStops: BROWN_BRICK_HIT_WAVE,
    },
    emitter: { ...GRAY_BRICK_DAMAGE_EMITTER, color: { r: 0.75, g: 0.55, b: 0.35, a: 1 }, fill: BROWN_BRICK_EMITTER_FILL },
  },
  woodBrickDestroy: {
    lifetimeMs: 1_600,
    defaultInitialRadius: 10,
    wave: {
      radiusExtension: 90,
      startAlpha: 0.6,
      endAlpha: 0,
      gradientStops: BROWN_BRICK_DESTROY_WAVE,
    },
    emitter: { ...GRAY_BRICK_DESTRUCTION_EMITTER, color: { r: 0.75, g: 0.55, b: 0.35, a: 1 }, fill: BROWN_BRICK_EMITTER_FILL },
  },
  copperBrickHit: {
    lifetimeMs: 1_000,
    defaultInitialRadius: 6,
    wave: {
      radiusExtension: 40,
      startAlpha: 0.5,
      endAlpha: 0,
      gradientStops: ORANGE_BRICK_HIT_WAVE,
    },
    emitter: { ...GRAY_BRICK_DAMAGE_EMITTER, color: { r: 0.95, g: 0.65, b: 0.35, a: 1 }, fill: ORANGE_BRICK_EMITTER_FILL },
  },
  copperBrickDestroy: {
    lifetimeMs: 1_600,
    defaultInitialRadius: 10,
    wave: {
      radiusExtension: 90,
      startAlpha: 0.65,
      endAlpha: 0,
      gradientStops: ORANGE_BRICK_DESTROY_WAVE,
    },
    emitter: { ...GRAY_BRICK_DESTRUCTION_EMITTER, color: { r: 0.95, g: 0.65, b: 0.35, a: 1 }, fill: ORANGE_BRICK_EMITTER_FILL },
  },
  silverBrickHit: {
    lifetimeMs: 1_000,
    defaultInitialRadius: 6,
    wave: {
      radiusExtension: 40,
      startAlpha: 0.5,
      endAlpha: 0,
      gradientStops: SILVER_BRICK_HIT_WAVE,
    },
    emitter: { ...GRAY_BRICK_DAMAGE_EMITTER, color: { r: 0.92, g: 0.93, b: 0.96, a: 1 }, fill: SILVER_BRICK_EMITTER_FILL2 },
  },
  silverBrickDestroy: {
    lifetimeMs: 1_600,
    defaultInitialRadius: 10,
    wave: {
      radiusExtension: 90,
      startAlpha: 0.65,
      endAlpha: 0,
      gradientStops: SILVER_BRICK_DESTROY_WAVE,
    },
    emitter: { ...GRAY_BRICK_DESTRUCTION_EMITTER, color: { r: 0.92, g: 0.93, b: 0.96, a: 1 }, fill: SILVER_BRICK_EMITTER_FILL2 },
  },
  coalBrickHit: {
    lifetimeMs: 1_000,
    defaultInitialRadius: 6,
    wave: {
      radiusExtension: 40,
      startAlpha: 0.5,
      endAlpha: 0,
      gradientStops: COAL_BRICK_HIT_WAVE,
    },
    emitter: { ...GRAY_BRICK_DAMAGE_EMITTER, color: { r: 0.24, g: 0.24, b: 0.27, a: 1 }, fill: COAL_BRICK_EMITTER_FILL2 },
  },
  coalBrickDestroy: {
    lifetimeMs: 1_600,
    defaultInitialRadius: 10,
    wave: {
      radiusExtension: 90,
      startAlpha: 0.65,
      endAlpha: 0,
      gradientStops: COAL_BRICK_DESTROY_WAVE,
    },
    emitter: { ...GRAY_BRICK_DESTRUCTION_EMITTER, color: { r: 0.24, g: 0.24, b: 0.27, a: 1 }, fill: COAL_BRICK_EMITTER_FILL2 },
  },
  criticalHit: {
    lifetimeMs: 900,
    defaultInitialRadius: 10,
    wave: {
      radiusExtension: 70,
      startAlpha: 0.8,
      endAlpha: 0,
      gradientStops: CRITICAL_HIT_WAVE_GRADIENT_STOPS,
    },
    emitter: CRITICAL_HIT_EMITTER,
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
