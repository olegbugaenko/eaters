import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneFillNoise,
  SceneFillFibers,
  SceneGradientStop,
  SceneVector2,
} from "../logic/services/SceneObjectManager";
import { ExplosionType } from "./explosions-db";

export type BulletType = "magnetic" | "plasmoid" | "mechanical";

export interface BulletTailConfig {
  lengthMultiplier: number;
  widthMultiplier: number;
  startColor: SceneColor;
  endColor: SceneColor;
}

export interface BulletTailEmitterConfig {
  particlesPerSecond: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  baseSpeed: number;
  speedVariation: number;
  sizeRange: { min: number; max: number };
  spread: number;
  offset: SceneVector2;
  color: SceneColor;
  fill?: SceneFill;
  maxParticles?: number;
}

export interface BulletConfig {
  diameter: number;
  travelTimeSeconds: number;
  directionAngleRange: { min: number; max: number };
  lifetimeMsRange: { min: number; max: number };
  gradientStops: readonly SceneGradientStop[];
  noise?: SceneFillNoise;
  fibers?: SceneFillFibers;
  tail: BulletTailConfig;
  tailEmitter?: BulletTailEmitterConfig;
  explosionType?: ExplosionType;
}

const BASE_TRAVEL_TIME_SECONDS = 20;
const BASE_DIRECTION_RANGE = { min: -Math.PI / 6, max: Math.PI / 6 } as const;
const BASE_LIFETIME_RANGE = { min: 1_000, max: 20_000 } as const;

const MAGNETIC_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.1, g: 0.15, b: 1, a: 1 } },
  { offset: 0.35, color: { r: 0.9, g: 0.95, b: 0.9, a: 1 } },
  { offset: 0.5, color: { r: 0.5, g: 0.85, b: 1.0, a: 0.75 } },
  { offset: 1, color: { r: 0.5, g: 0.85, b: 1.0, a: 0 } },
] as const;

const PLASMOID_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1, g: 0.15, b: 0, a: 1 } },
  { offset: 0.25, color: { r: 1, g: 0.55, b: 0, a: 1 } },
  { offset: 0.55, color: { r: 1, g: 0.8, b: 0.2, a: 0.8 } },
  { offset: 1, color: { r: 1, g: 0.95, b: 0.4, a: 0 } },
] as const;

const MECHANICAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.7, g: 0.7, b: 0.72, a: 1 } },
  { offset: 0.45, color: { r: 0.55, g: 0.55, b: 0.58, a: 1 } },
  { offset: 1, color: { r: 0.35, g: 0.35, b: 0.4, a: 0 } },
] as const;

const BULLET_DB: Record<BulletType, BulletConfig> = {
  magnetic: {
    diameter: 16,
    travelTimeSeconds: BASE_TRAVEL_TIME_SECONDS,
    directionAngleRange: BASE_DIRECTION_RANGE,
    lifetimeMsRange: BASE_LIFETIME_RANGE,
    gradientStops: MAGNETIC_GRADIENT,
    tail: {
      lengthMultiplier: 6.5,
      widthMultiplier: 1.75,
      startColor: { r: 0.25, g: 0.45, b: 1, a: 0.65 },
      endColor: { r: 0.05, g: 0.15, b: 0.6, a: 0.1 },
    },
    tailEmitter: {
      particlesPerSecond: 160,
      particleLifetimeMs: 500,
      fadeStartMs: 250,
      baseSpeed: 0.22,
      speedVariation: 0.08,
      sizeRange: { min: 1, max: 2 },
      spread: Math.PI / 6,
      offset: { x: -1.1, y: 0 },
      color: { r: 0.35, g: 0.6, b: 1, a: 0.65 },
      fill: {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 },
        stops: [
          { offset: 0, color: { r: 0.4, g: 0.65, b: 1, a: 0.7 } },
          { offset: 1, color: { r: 0.1, g: 0.25, b: 0.65, a: 0 } },
        ],
      },
      maxParticles: 60,
    },
    explosionType: "magnetic",
  },
  plasmoid: {
    diameter: 16,
    travelTimeSeconds: BASE_TRAVEL_TIME_SECONDS,
    directionAngleRange: BASE_DIRECTION_RANGE,
    lifetimeMsRange: BASE_LIFETIME_RANGE,
    gradientStops: PLASMOID_GRADIENT,
    tail: {
      lengthMultiplier: 6.5,
      widthMultiplier: 1.75,
      startColor: { r: 1, g: 0.85, b: 0.3, a: 0.6 },
      endColor: { r: 1, g: 0.95, b: 0.6, a: 0.1 },
    },
    explosionType: "plasmoid",
  },
  mechanical: {
    diameter: 16,
    travelTimeSeconds: BASE_TRAVEL_TIME_SECONDS,
    directionAngleRange: BASE_DIRECTION_RANGE,
    lifetimeMsRange: BASE_LIFETIME_RANGE,
    gradientStops: MECHANICAL_GRADIENT,
    tail: {
      lengthMultiplier: 8.5,
      widthMultiplier: 1.65,
      startColor: { r: 0.75, g: 0.75, b: 0.75, a: 0.55 },
      endColor: { r: 0.9, g: 0.9, b: 0.9, a: 0 },
    },
  },
};

export const getBulletConfig = (type: BulletType): BulletConfig => {
  const config = BULLET_DB[type];
  if (!config) {
    throw new Error(`Unknown bullet type: ${type}`);
  }
  return config;
};

export const BULLET_TYPES = Object.keys(BULLET_DB) as BulletType[];
