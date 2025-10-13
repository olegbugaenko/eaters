import {
  SceneColor,
  SceneGradientStop,
  SceneSize,
  SceneVector2,
} from "../logic/services/SceneObjectManager";

import { DestructubleData } from "../logic/interfaces/destructuble";
import { ResourceAmount } from "./resources-db";

export type BrickType =
  | "classic"
  | "smallSquareGray"
  | "smallSquareYellow"
  | "smallIron"
  | "smallOrganic"
  | "smallWood"
  | "smallCopper";

export interface BrickStrokeConfig {
  color: SceneColor;
  width: number;
}

export interface BrickLinearFillConfig {
  type: "linear";
  start?: SceneVector2;
  end?: SceneVector2;
  stops: readonly SceneGradientStop[];
}

export interface BrickRadialFillConfig {
  type: "radial";
  center?: SceneVector2;
  radius?: number;
  stops: readonly SceneGradientStop[];
}

export interface BrickSolidFillConfig {
  type: "solid";
  color: SceneColor;
}

export type BrickFillConfig =
  | BrickLinearFillConfig
  | BrickRadialFillConfig
  | BrickSolidFillConfig;

export interface BrickConfig {
  size: SceneSize;
  fill: BrickFillConfig;
  stroke?: BrickStrokeConfig;
  destructubleData?: DestructubleData;
  rewards?: ResourceAmount;
}

const CLASSIC_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.9, g: 0.7, b: 0.1, a: 1 } },
  { offset: 0.5, color: { r: 1, g: 0.85, b: 0.3, a: 1 } },
  { offset: 1, color: { r: 0.9, g: 0.7, b: 0.1, a: 1 } },
] as const;

const SMALL_SQUARE_GRAY_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.75, g: 0.75, b: 0.78, a: 1 } },
  { offset: 0.55, color: { r: 0.6, g: 0.6, b: 0.65, a: 1 } },
  { offset: 1, color: { r: 0.45, g: 0.45, b: 0.5, a: 1 } },
] as const;

const SMALL_SQUARE_YELLOW_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.75, g: 0.75, b: 0.58, a: 1 } },
  { offset: 0.55, color: { r: 0.6, g: 0.6, b: 0.45, a: 1 } },
  { offset: 1, color: { r: 0.45, g: 0.45, b: 0.3, a: 1 } },
] as const;

const BLUE_RADIAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.65, g: 0.8, b: 1, a: 1 } },
  { offset: 0.4, color: { r: 0.35, g: 0.6, b: 0.95, a: 0.9 } },
  { offset: 1, color: { r: 0.15, g: 0.25, b: 0.7, a: 0.6 } },
] as const;

const GREEN_RADIAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.65, g: 1, b: 0.8, a: 1 } },
  { offset: 0.4, color: { r: 0.35, g: 1, b: 0.45, a: 0.9 } },
  { offset: 1, color: { r: 0.15, g: 0.7, b: 0.15, a: 0.6 } },
] as const;


const ORANGE_RADIAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.95, g: 0.8, b: 0.8, a: 1 } },
  { offset: 0.4, color: { r: 1, g: 0.75, b: 0.45, a: 0.9 } },
  { offset: 1, color: { r: 0.7, g: 0.45, b: 0.15, a: 0.6 } },
] as const;

const WOOD_LINEAR_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.55, g: 0.35, b: 0.15, a: 1 } },
  { offset: 0.5, color: { r: 0.7, g: 0.45, b: 0.2, a: 1 } },
  { offset: 1, color: { r: 0.45, g: 0.28, b: 0.12, a: 1 } },
] as const;

const COPPER_RADIAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.95, g: 0.65, b: 0.35, a: 1 } },
  { offset: 0.45, color: { r: 0.85, g: 0.45, b: 0.2, a: 1 } },
  { offset: 1, color: { r: 0.55, g: 0.25, b: 0.08, a: 1 } },
] as const;

const BRICK_DB: Record<BrickType, BrickConfig> = {
  classic: {
    size: { width: 60, height: 30 },
    fill: {
      type: "linear",
      start: { x: 0, y: -15 },
      end: { x: 0, y: 15 },
      stops: CLASSIC_GRADIENT,
    },
    stroke: { color: { r: 0.55, g: 0.4, b: 0.05, a: 1 }, width: 2 },
    destructubleData: {
      maxHp: 25,
      armor: 2,
      baseDamage: 3,
      brickKnockBackDistance: 40,
      brickKnockBackSpeed: 80,
      brickKnockBackAmplitude: 6,
      physicalSize: 28,
      damageExplosion: {
        type: "plasmoid",
        radiusMultiplier: 0.9,
      },
      destructionExplosion: {
        type: "plasmoid",
        radiusMultiplier: 1.05,
      },
    },
  },
  smallSquareGray: {
    size: { width: 24, height: 24 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 12,
      stops: SMALL_SQUARE_GRAY_GRADIENT,
    },
    stroke: { color: { r: 0.3, g: 0.3, b: 0.35, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 5,
      armor: 0,
      baseDamage: 3,
      brickKnockBackDistance: 60,
      brickKnockBackSpeed: 120,
      brickKnockBackAmplitude: 6,
      physicalSize: 16,
      damageExplosion: {
        type: "grayBrickHit",
        radiusMultiplier: 0.7,
        radiusOffset: -2,
      },
      destructionExplosion: {
        type: "grayBrickDestroy",
        radiusMultiplier: 0.95,
      },
    },
    rewards: {
      stone: 1,
    },
  },
  smallSquareYellow: {
    size: { width: 24, height: 24 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 12,
      stops: SMALL_SQUARE_YELLOW_GRADIENT,
    },
    stroke: { color: { r: 0.3, g: 0.3, b: 0.2, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 20,
      armor: 1,
      baseDamage: 5,
      brickKnockBackDistance: 70,
      brickKnockBackSpeed: 140,
      brickKnockBackAmplitude: 10.5,
      physicalSize: 16,
      damageExplosion: {
        type: "grayBrickHit",
        radiusMultiplier: 0.7,
        radiusOffset: -2,
      },
      destructionExplosion: {
        type: "grayBrickDestroy",
        radiusMultiplier: 0.95,
      },
    },
    rewards: {
      sand: 1,
    },
  },
  smallOrganic: {
    size: { width: 30, height: 30 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 28,
      stops: GREEN_RADIAL_GRADIENT,
    },
    stroke: { color: { r: 0.1, g: 0.45, b: 0.15, a: 1 }, width: 2.4 },
    destructubleData: {
      maxHp: 75,
      armor: 6,
      baseDamage: 21,
      brickKnockBackDistance: 90,
      brickKnockBackSpeed: 180,
      brickKnockBackAmplitude: 4,
      physicalSize: 20,
      damageExplosion: {
        type: "grayBrickHit",
        radiusMultiplier: 0.85,
      },
      destructionExplosion: {
        type: "grayBrickDestroy",
        radiusMultiplier: 1.25,
      },
    },
    rewards: {
      organics: 1,
    },
  },
  smallIron: {
    size: { width: 30, height: 30 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 28,
      stops: ORANGE_RADIAL_GRADIENT,
    },
    stroke: { color: { r: 0.4, g: 0.35, b: 0.1, a: 1 }, width: 2.4 },
    destructubleData: {
      maxHp: 100,
      armor: 12,
      baseDamage: 15,
      brickKnockBackDistance: 90,
      brickKnockBackSpeed: 180,
      brickKnockBackAmplitude: 4,
      physicalSize: 20,
      damageExplosion: {
        type: "grayBrickHit",
        radiusMultiplier: 0.85,
      },
      destructionExplosion: {
        type: "grayBrickDestroy",
        radiusMultiplier: 1.25,
      },
    },
    rewards: {
      iron: 1,
    },
  },
  smallWood: {
    size: { width: 24, height: 24 },
    fill: {
      type: "linear",
      start: { x: 0, y: -12 },
      end: { x: 0, y: 12 },
      stops: WOOD_LINEAR_GRADIENT,
    },
    stroke: { color: { r: 0.25, g: 0.15, b: 0.05, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 135,
      armor: 20,
      baseDamage: 46,
      brickKnockBackDistance: 70,
      brickKnockBackSpeed: 140,
      brickKnockBackAmplitude: 7,
      physicalSize: 18,
      damageExplosion: {
        type: "grayBrickHit",
        radiusMultiplier: 0.75,
      },
      destructionExplosion: {
        type: "grayBrickDestroy",
        radiusMultiplier: 1.1,
      },
    },
    rewards: {
      wood: 1,
    },
  },
  smallCopper: {
    size: { width: 24, height: 24 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 12,
      stops: COPPER_RADIAL_GRADIENT,
    },
    stroke: { color: { r: 0.4, g: 0.2, b: 0.08, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 255,
      armor: 42,
      baseDamage: 28,
      brickKnockBackDistance: 70,
      brickKnockBackSpeed: 140,
      brickKnockBackAmplitude: 7,
      physicalSize: 18,
      damageExplosion: {
        type: "grayBrickHit",
        radiusMultiplier: 0.75,
      },
      destructionExplosion: {
        type: "grayBrickDestroy",
        radiusMultiplier: 1.15,
      },
    },
    rewards: {
      copper: 1,
    },
  },
};

export const getBrickConfig = (type: BrickType): BrickConfig => {
  const config = BRICK_DB[type];
  if (!config) {
    throw new Error(`Unknown brick type: ${type}`);
  }
  return config;
};

export const BRICK_TYPES = Object.keys(BRICK_DB) as BrickType[];

export const isBrickType = (value: unknown): value is BrickType =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(BRICK_DB, value);
