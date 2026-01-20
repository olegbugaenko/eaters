import type {
  SceneFill,
  SceneFillFilaments,
  SceneFillNoise,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { ParticleEmitterConfig } from "../../logic/interfaces/visuals/particle-emitters-config";

export const createSolidEmitterFill = (color: SceneFill["color"]): SceneFill => ({
  fillType: FILL_TYPES.SOLID,
  color,
});

export const DEFAULT_EMITTER_FILL: SceneFill = {
  fillType: FILL_TYPES.SOLID,
  color: { r: 1, g: 0.85, b: 0.55, a: 1 },
};

export const SMALL_CANNON_EMITTER_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 1.0, g: 0.9, b: 0.8, a: 1.0 } },
    { offset: 0.45, color: { r: 0.9, g: 0.8, b: 0.7, a: 0.42 } },
    { offset: 1, color: { r: 0.5, g: 0.4, b: 0.3, a: 0.02 } },
  ],
};

export const SMALL_LASER_EMITTER_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 1.0, g: 0.7, b: 0.8, a: 1.0 } },
    { offset: 0.45, color: { r: 0.9, g: 0.6, b: 0.7, a: 0.42 } },
    { offset: 1, color: { r: 0.9, g: 0.5, b: 0.6, a: 0.32 } },
  ],
};

export const SMALL_ENERGETIC_EMITTER_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 0.7, g: 1.0, b: 1.0, a: 1.0 } },
    { offset: 0.45, color: { r: 0.4, g: 0.9, b: 0.8, a: 0.6 } },
    { offset: 1, color: { r: 0.4, g: 0.9, b: 0.8, a: 0.2 } },
  ],
};

export const SMALL_GREY_CANNON_EMITTER_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 0.6, g: 0.75, b: 0.75, a: 0.8 } },
    { offset: 0.35, color: { r: 0.6, g: 0.75, b: 0.75, a: 0.55 } },
    { offset: 1, color: { r: 0.6, g: 0.75, b: 0.75, a: 0 } },
  ],
};

export const MAGNETIC_EMITTER_FILL: SceneFill & {
  noise: SceneFillNoise;
} = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 8,
  stops: [
    { offset: 0, color: { r: 1, g: 1, b: 1, a: 0.25 } },
    { offset: 0.4, color: { r: 0.8, g: 0.6, b: 1, a: 0.2 } },
    { offset: 1, color: { r: 0.6, g: 0.4, b: 0.9, a: 0.05 } },
  ],
  noise: {
    colorAmplitude: 0.04,
    alphaAmplitude: 0.05,
    scale: 0.3,
  },
};

export const GRAY_BRICK_EMITTER_FILL: SceneFill & {
  noise: SceneFillNoise;
} = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 0.9, g: 0.9, b: 0.92, a: 0.12 } },
    { offset: 0.45, color: { r: 0.72, g: 0.74, b: 0.78, a: 0.06 } },
    { offset: 1, color: { r: 0.45, g: 0.48, b: 0.52, a: 0.03 } },
  ],
  noise: {
    colorAmplitude: 0.04,
    alphaAmplitude: 0.075,
    scale: 0.5,
    density: 0.3,
  },
};

export const YELLOW_BRICK_EMITTER_FILL: SceneFill & {
  noise: SceneFillNoise;
} = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 1, g: 0.95, b: 0.6, a: 0.09 } },
    { offset: 0.45, color: { r: 0.95, g: 0.85, b: 0.45, a: 0.05 } },
    { offset: 1, color: { r: 0.8, g: 0.7, b: 0.35, a: 0.02 } },
  ],
  noise: {
    colorAmplitude: 0.02,
    alphaAmplitude: 0.06,
    scale: 0.5,
    density: 0.3,
  },
};

export const GREEN_BRICK_EMITTER_FILL: SceneFill & {
  noise: SceneFillNoise;
} = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 0.4, g: 0.8, b: 0.5, a: 0.12 } },
    { offset: 0.45, color: { r: 0.2, g: 0.6, b: 0.3, a: 0.06 } },
    { offset: 1, color: { r: 0.05, g: 0.45, b: 0.1, a: 0.03 } },
  ],
  noise: {
    colorAmplitude: 0.04,
    alphaAmplitude: 0.09,
    scale: 0.5,
    density: 0.2,
  },
};

export const ORANGE_BRICK_EMITTER_FILL: SceneFill & {
  noise: SceneFillNoise;
} = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 1, g: 0.85, b: 0.6, a: 0.12 } },
    { offset: 0.45, color: { r: 1, g: 0.6, b: 0.25, a: 0.06 } },
    { offset: 1, color: { r: 0.85, g: 0.4, b: 0.12, a: 0.03 } },
  ],
  noise: {
    colorAmplitude: 0.04,
    alphaAmplitude: 0.09,
    scale: 0.5,
    density: 0.2,
  },
};

export const BROWN_BRICK_EMITTER_FILL: SceneFill & {
  noise: SceneFillNoise;
} = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 0.75, g: 0.55, b: 0.35, a: 0.09 } },
    { offset: 0.45, color: { r: 0.6, g: 0.45, b: 0.25, a: 0.05 } },
    { offset: 1, color: { r: 0.4, g: 0.3, b: 0.15, a: 0.02 } },
  ],
  noise: {
    colorAmplitude: 0.04,
    alphaAmplitude: 0.09,
    scale: 0.5,
    density: 0.3,
  },
};

export const SILVER_BRICK_EMITTER_FILL2: SceneFill & {
  noise: SceneFillNoise;
} = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 0.95, g: 0.96, b: 0.98, a: 0.09 } },
    { offset: 0.45, color: { r: 0.85, g: 0.86, b: 0.9, a: 0.05 } },
    { offset: 1, color: { r: 0.75, g: 0.76, b: 0.8, a: 0.02 } },
  ],
  noise: {
    colorAmplitude: 0.04,
    alphaAmplitude: 0.09,
    scale: 0.5,
  },
};

export const ICE_BRICK_EMITTER_FILL2: SceneFill & {
  noise: SceneFillNoise;
} = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 0.85, g: 0.95, b: 1.0, a: 0.09 } },
    { offset: 0.45, color: { r: 0.65, g: 0.85, b: 1.0, a: 0.05 } },
    { offset: 1, color: { r: 0.45, g: 0.7, b: 1.0, a: 0.02 } },
  ],
  noise: {
    colorAmplitude: 0.04,
    alphaAmplitude: 0.09,
    scale: 0.5,
  },
};

export const COAL_BRICK_EMITTER_FILL2: SceneFill & {
  noise: SceneFillNoise;
} = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 0.3, g: 0.3, b: 0.32, a: 0.09 } },
    { offset: 0.45, color: { r: 0.18, g: 0.18, b: 0.2, a: 0.05 } },
    { offset: 1, color: { r: 0.1, g: 0.1, b: 0.12, a: 0.02 } },
  ],
  noise: {
    colorAmplitude: 0.04,
    alphaAmplitude: 0.09,
    scale: 0.5,
  },
};

export const MAGMA_BRICK_EMITTER_FILL2: SceneFill & {
  noise: SceneFillNoise;
} = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 1.0, g: 0.65, b: 0.2, a: 0.09 } },
    { offset: 0.45, color: { r: 1.0, g: 0.45, b: 0.15, a: 0.05 } },
    { offset: 1, color: { r: 0.9, g: 0.3, b: 0.1, a: 0.02 } },
  ],
  noise: {
    colorAmplitude: 0.04,
    alphaAmplitude: 0.09,
    scale: 0.5,
  },
};

export const CRITICAL_HIT_EMITTER_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 6,
  stops: [
    { offset: 0, color: { r: 1, g: 0.65, b: 0.65, a: 0.4 } },
    { offset: 0.45, color: { r: 0.95, g: 0.28, b: 0.28, a: 0.3 } },
    { offset: 1, color: { r: 0.7, g: 0.05, b: 0.05, a: 0 } },
  ],
};

export const DEFAULT_EMITTER: ParticleEmitterConfig = {
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

export const GRAY_BRICK_DAMAGE_EMITTER: ParticleEmitterConfig = {
  emissionDurationMs: 140,
  particlesPerSecond: 340,
  baseSpeed: 0.04,
  speedVariation: 0.01,
  particleLifetimeMs: 650,
  fadeStartMs: 280,
  sizeRange: { min: 1, max: 2 },
  spawnRadius: { min: 0, max: 5 },
  spawnRadiusMultiplier: 1.2,
  color: { r: 0.82, g: 0.84, b: 0.88, a: 1 },
  arc: Math.PI * 2,
  direction: 0,
  fill: createSolidEmitterFill({ r: 0.85, g: 0.87, b: 0.92, a: 1 }),
  shape: "triangle",
  sizeGrowthRate: 1.0,
};

export const GRAY_BRICK_DESTRUCTION_EMITTER: ParticleEmitterConfig = {
  emissionDurationMs: 220,
  particlesPerSecond: 42,
  baseSpeed: 0.05,
  speedVariation: 0.01,
  particleLifetimeMs: 750,
  fadeStartMs: 480,
  sizeRange: { min: 26, max: 49 },
  spawnRadius: { min: 0, max: 8 },
  spawnRadiusMultiplier: 1.5,
  color: { r: 0.85, g: 0.87, b: 0.92, a: 1 },
  arc: Math.PI * 2,
  direction: 0,
  fill: GRAY_BRICK_EMITTER_FILL,
  shape: "circle",
  sizeGrowthRate: 1.35,
};

export const GRAY_BRICK_DESTRUCTION_EMITTER_V2: ParticleEmitterConfig = {
  emissionDurationMs: 220,
  particlesPerSecond: 720,
  baseSpeed: 0.05,
  speedVariation: 0.01,
  particleLifetimeMs: 950,
  fadeStartMs: 480,
  sizeRange: { min: 1, max: 3 },
  spawnRadius: { min: 0, max: 8 },
  spawnRadiusMultiplier: 1.5,
  color: { r: 0.85, g: 0.87, b: 0.92, a: 1 },
  arc: Math.PI * 2,
  direction: 0,
  fill: createSolidEmitterFill({ r: 0.85, g: 0.87, b: 0.92, a: 1 }),
  shape: "triangle",
  sizeGrowthRate: 1.0,
  maxParticles: 1000,
};

export const CRITICAL_HIT_EMITTER: ParticleEmitterConfig = {
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

export const WEAKEN_CURSE_FILAMENTS: SceneFillFilaments = {
  colorContrast: 0.1,
  alphaContrast: 0.08,
  width: 0.35,
  density: 6.1,
  edgeBlur: 0.35,
};
