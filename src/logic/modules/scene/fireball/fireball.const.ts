import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { SceneColor } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ParticleEmitterConfig } from "../../../interfaces/visuals/particle-emitters-config";

export const FIREBALL_SPEED = 150; // pixels per second (reduced from 300 for more realistic movement)
export const DEFAULT_FIREBALL_LIFETIME_MS = 5000; // 5 seconds max flight time (increased to compensate for slower speed)
export const DEFAULT_FIREBALL_EXPLOSION_RADIUS = 40;
export const DEFAULT_FIREBALL_MAX_DISTANCE = (FIREBALL_SPEED * DEFAULT_FIREBALL_LIFETIME_MS) / 1000;
export const FIREBALL_RADIUS = 16;
export const FIREBALL_GLOW_COLOR: SceneColor = { r: 1.0, g: 0.7, b: 0.3, a: 0.8 };
export const FIREBALL_GLOW_RADIUS_MULTIPLIER = 1.9;
export const FIREBALL_TAIL_LENGTH_MULTIPLIER = 4.5;
export const FIREBALL_TAIL_WIDTH_MULTIPLIER = 1.6;
export const FIREBALL_TAIL_START_COLOR: SceneColor = {
  r: 1,
  g: 0.75,
  b: 0.3,
  a: 0.13,
};
export const FIREBALL_TAIL_END_COLOR: SceneColor = { r: 0.2, g: 0.02, b: 0, a: 0 };
export const FIREBALL_TAIL_RENDER = {
  lengthMultiplier: FIREBALL_TAIL_LENGTH_MULTIPLIER,
  widthMultiplier: FIREBALL_TAIL_WIDTH_MULTIPLIER,
  startColor: { ...FIREBALL_TAIL_START_COLOR },
  endColor: { ...FIREBALL_TAIL_END_COLOR },
};

export const FIREBALL_TRAIL_EMITTER: ParticleEmitterConfig = {
  particlesPerSecond: 490,
  particleLifetimeMs: 750,
  fadeStartMs: 200,
  baseSpeed: 0.02,
  speedVariation: 0.005,
  sizeRange: { min: 24.2, max: 38.4 },
  spread: Math.PI,
  sizeGrowthRate: 1.75,
  offset: { x: -1.35, y: 0 },
  color: { r: 1, g: 0.7, b: 0.3, a: 0.45 },
  fill: {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    stops: [
      { offset: 0, color: { r: 1, g: 0.85, b: 0.55, a: 0.05 } },
      { offset: 0.25, color: { r: 1, g: 0.65, b: 0.2, a: 0.02 } },
      { offset: 1, color: { r: 1, g: 0.4, b: 0.05, a: 0.0 } },
    ],
    noise: {
      colorAmplitude: 0.01,
      alphaAmplitude: 0.01,
      scale: 0.35,
    },
  },
  shape: "circle",
  maxParticles: 720,
};

export const FIREBALL_SMOKE_EMITTER: ParticleEmitterConfig = {
  particlesPerSecond: 48,
  particleLifetimeMs: 820,
  fadeStartMs: 320,
  baseSpeed: 0.04,
  speedVariation: 0.02,
  sizeRange: { min: 12, max: 16 },
  spread: Math.PI / 4,
  offset: { x: -0.55, y: 0 },
  color: { r: 0.35, g: 0.24, b: 0.18, a: 0.4 },
  fill: {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    stops: [
      { offset: 0, color: { r: 0.6, g: 0.5, b: 0.4, a: 0.12 } },
      { offset: 0.3, color: { r: 0.4, g: 0.32, b: 0.28, a: 0.08 } },
      { offset: 1, color: { r: 0.18, g: 0.14, b: 0.12, a: 0 } },
    ],
  },
  shape: "circle",
  maxParticles: 72,
};
