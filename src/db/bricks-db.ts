import {
  SceneColor,
  SceneFillFilaments,
  SceneFillNoise,
  SceneGradientStop,
  SceneSize,
  SceneVector2,
} from "../logic/services/SceneObjectManager";

import { DestructubleData } from "../logic/interfaces/destructuble";
import { ResourceAmount } from "./resources-db";

export type BrickType =
  | "classic"
  | "smallTrainingBrick"
  | "smallSquareGray"
  | "smallSquareYellow"
  | "smallIron"
  | "smallOrganic"
  | "smallWood"
  | "smallCopper"
  | "smallSilver"
  | "smallCoal"
  | "smallIce"
  | "smallMagma"
  | "neutronBrick"
  | "neutronBrick2"
  | "darkMatterBrick";

export interface BrickStrokeConfig {
  color: SceneColor;
  width: number;
}

export interface BrickLinearFillConfig {
  type: "linear";
  start?: SceneVector2;
  end?: SceneVector2;
  stops: readonly SceneGradientStop[];
  noise?: SceneFillNoise;
  filaments?: SceneFillFilaments;
}

export interface BrickRadialFillConfig {
  type: "radial";
  center?: SceneVector2;
  radius?: number;
  stops: readonly SceneGradientStop[];
  noise?: SceneFillNoise;
  filaments?: SceneFillFilaments;
}

export interface BrickSolidFillConfig {
  type: "solid";
  color: SceneColor;
  noise?: SceneFillNoise;
  filaments?: SceneFillFilaments;
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

const SMALL_SQUARE_TRAINING_BRICK_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.75, g: 0.75, b: 0.75, a: 1 } },
  { offset: 1, color: { r: 0.65, g: 0.65, b: 0.65, a: 1 } },
] as const;

const SMALL_SQUARE_GRAY_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.75, g: 0.75, b: 0.78, a: 1 } },
  { offset: 0.55, color: { r: 0.6, g: 0.6, b: 0.65, a: 1 } },
  { offset: 1, color: { r: 0.45, g: 0.45, b: 0.5, a: 1 } },
] as const;

const SMALL_SQUARE_YELLOW_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.7, g: 0.7, b: 0.54, a: 1 } },
  { offset: 0.55, color: { r: 0.6, g: 0.6, b: 0.45, a: 1 } },
  { offset: 1, color: { r: 0.5, g: 0.5, b: 0.35, a: 1 } },
] as const;

const BLUE_RADIAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.65, g: 0.8, b: 1, a: 1 } },
  { offset: 0.4, color: { r: 0.35, g: 0.6, b: 0.95, a: 0.9 } },
  { offset: 1, color: { r: 0.15, g: 0.25, b: 0.7, a: 0.6 } },
] as const;

const GREEN_RADIAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.35, g: 0.6, b: 0.25, a: 1 } },
  { offset: 0.4, color: { r: 0.2, g: 0.5, b: 0.1, a: 1.0 } },
  { offset: 1, color: { r: 0.15, g: 0.4, b: 0.05, a: 1.0 } },
] as const;


const ORANGE_RADIAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.85, g: 0.65, b: 0.45, a: 1 } },
  { offset: 0.4, color: { r: 0.75, g: 0.55, b: 0.35, a: 1 } },
  { offset: 1, color: { r: 0.6, g: 0.35, b: 0.05, a: 1 } },
] as const;

const WOOD_LINEAR_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.45, g: 0.3, b: 0.15, a: 1 } },
  { offset: 0.5, color: { r: 0.5, g: 0.35, b: 0.13, a: 1 } },
  { offset: 1, color: { r: 0.45, g: 0.3, b: 0.12, a: 1 } },
] as const;

const COPPER_RADIAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.95, g: 0.65, b: 0.35, a: 1 } },
  { offset: 0.45, color: { r: 0.85, g: 0.45, b: 0.2, a: 1 } },
  { offset: 1, color: { r: 0.55, g: 0.25, b: 0.08, a: 1 } },
] as const;

const SILVER_LINEAR_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.92, g: 0.93, b: 0.96, a: 1 } },
  { offset: 0.45, color: { r: 0.82, g: 0.83, b: 0.88, a: 1 } },
  { offset: 1, color: { r: 0.72, g: 0.73, b: 0.78, a: 1 } },
] as const;

const COAL_RADIAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.24, g: 0.24, b: 0.27, a: 1 } },
  { offset: 0.5, color: { r: 0.12, g: 0.12, b: 0.15, a: 1 } },
  { offset: 1, color: { r: 0.05, g: 0.05, b: 0.07, a: 1 } },
] as const;

const ICE_RADIAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.85, g: 0.95, b: 1, a: 1 } },
  { offset: 0.4, color: { r: 0.65, g: 0.85, b: 0.95, a: 0.9 } },
  { offset: 1, color: { r: 0.4, g: 0.6, b: 0.8, a: 0.6 } },
] as const;

const MAGMA_RADIAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.5, g: 0.2, b: 0.2, a: 1 } },
  { offset: 0.35, color: { r: 0.4, g: 0.12, b: 0.12, a: 1 } },
  { offset: 1, color: { r: 0.2, g: 0.07, b: 0.05, a: 1 } },
] as const;

const NEUTRON_RADIAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.95, g: 0.95, b: 0.85, a: 1 } },
  { offset: 0.4, color: { r: 0.95, g: 0.95, b: 0.75, a: 1 } },
  { offset: 1, color: { r: 0.9, g: 0.85, b: 0.65, a: 1 } },
] as const;

const NEUTRON_RADIAL_GRADIENT_2: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.95, g: 0.82, b: 0.85, a: 1 } },
  { offset: 0.4, color: { r: 0.95, g: 0.72, b: 0.95, a: 1 } },
  { offset: 1, color: { r: 0.9, g: 0.67, b: 0.85, a: 1 } },
] as const;

const DARK_MATTER_RADIAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.55, g: 0.85, b: 0.80, a: 1 } },
  { offset: 0.4, color: { r: 0.40, g: 0.70, b: 0.65, a: 1 } },
  { offset: 1, color: { r: 0.15, g: 0.40, b: 0.35, a: 1 } },
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
    stroke: { color: { r: 0.5, g: 0.65, b: 0.45, a: 1 }, width: 2 },
    destructubleData: {
      maxHp: 25,
      armor: 2,
      baseDamage: 3,
      brickKnockBackDistance: 40,
      brickKnockBackSpeed: 120,
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
  smallTrainingBrick: {
    size: { width: 24, height: 24 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 12,
      stops: SMALL_SQUARE_TRAINING_BRICK_GRADIENT,
      noise: {
        colorAmplitude: 0.04,
        alphaAmplitude: 0.0,
        scale: 0.5,
      },
    },
    stroke: { color: { r: 0.37, g: 0.37, b: 0.38, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 3,
      armor: 0,
      baseDamage: 2,
      brickKnockBackDistance: 60,
      brickKnockBackSpeed: 150,
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
      stone: 0.5,
    },
  },
  smallSquareGray: {
    size: { width: 24, height: 24 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 12,
      stops: SMALL_SQUARE_GRAY_GRADIENT,
      noise: {
        colorAmplitude: 0.04,
        alphaAmplitude: 0.0,
        scale: 0.5,
      },
    },
    stroke: { color: { r: 0.33, g: 0.33, b: 0.38, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 6,
      armor: 0,
      baseDamage: 3,
      brickKnockBackDistance: 60,
      brickKnockBackSpeed: 150,
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
      noise: {
        colorAmplitude: 0.03,
        alphaAmplitude: 0.0,
        scale: 0.5,
      },
    },
    stroke: { color: { r: 0.4, g: 0.4, b: 0.25, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 20,
      armor: 1,
      baseDamage: 5,
      brickKnockBackDistance: 70,
      brickKnockBackSpeed: 160,
      brickKnockBackAmplitude: 10.5,
      physicalSize: 16,
      damageExplosion: {
        type: "yellowBrickHit",
        radiusMultiplier: 0.7,
        radiusOffset: -2,
      },
      destructionExplosion: {
        type: "yellowBrickDestroy",
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
      noise: {
        colorAmplitude: 0.01,
        alphaAmplitude: 0.0,
        scale: 0.15,
      },
    },
    stroke: { color: { r: 0.1, g: 0.4, b: 0.0, a: 1 }, width: 2.4 },
    destructubleData: {
      maxHp: 90,
      armor: 8,
      baseDamage: 21,
      brickKnockBackDistance: 90,
      brickKnockBackSpeed: 180,
      brickKnockBackAmplitude: 4,
      physicalSize: 20,
      damageExplosion: {
        type: "organicBrickHit",
        radiusMultiplier: 0.85,
      },
      destructionExplosion: {
        type: "organicBrickDestroy",
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
    stroke: { color: { r: 0.6, g: 0.35, b: 0.1, a: 0.9 }, width: 2.4 },
    destructubleData: {
      maxHp: 125,
      armor: 12,
      baseDamage: 18,
      brickKnockBackDistance: 90,
      brickKnockBackSpeed: 180,
      brickKnockBackAmplitude: 4,
      physicalSize: 20,
      damageExplosion: {
        type: "ironBrickHit",
        radiusMultiplier: 0.85,
      },
      destructionExplosion: {
        type: "ironBrickDestroy",
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
      noise: {
        colorAmplitude: 0.08,
        alphaAmplitude: 0.0,
        scale: 0.45,
      },
    },
    stroke: { color: { r: 0.3, g: 0.2, b: 0.1, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 265,
      armor: 20,
      baseDamage: 76,
      brickKnockBackDistance: 70,
      brickKnockBackSpeed: 160,
      brickKnockBackAmplitude: 7,
      physicalSize: 18,
      damageExplosion: {
        type: "woodBrickHit",
        radiusMultiplier: 0.75,
      },
      destructionExplosion: {
        type: "woodBrickDestroy",
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
      noise: {
        colorAmplitude: 0.04,
        alphaAmplitude: 0.0,
        scale: 0.35,
      },
    },
    stroke: { color: { r: 0.4, g: 0.2, b: 0.08, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 255,
      armor: 42,
      baseDamage: 34,
      brickKnockBackDistance: 70,
      brickKnockBackSpeed: 160,
      brickKnockBackAmplitude: 7,
      physicalSize: 18,
      damageExplosion: {
        type: "copperBrickHit",
        radiusMultiplier: 0.75,
      },
      destructionExplosion: {
        type: "copperBrickDestroy",
        radiusMultiplier: 1.15,
      },
    },
    rewards: {
      copper: 1,
    },
  },
  smallSilver: {
    size: { width: 24, height: 24 },
    fill: {
      type: "linear",
      start: { x: 0, y: -12 },
      end: { x: 0, y: 12 },
      stops: SILVER_LINEAR_GRADIENT,
    },
    stroke: { color: { r: 0.55, g: 0.56, b: 0.62, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 1020,
      armor: 84,
      baseDamage: 92,
      brickKnockBackDistance: 75,
      brickKnockBackSpeed: 160,
      brickKnockBackAmplitude: 7,
      physicalSize: 18,
      damageExplosion: {
        type: "silverBrickHit",
        radiusMultiplier: 0.8,
      },
      destructionExplosion: {
        type: "silverBrickDestroy",
        radiusMultiplier: 1.2,
      },
    },
    rewards: {
      silver: 0.5,
    },
  },
  smallCoal: {
    size: { width: 24, height: 24 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 12,
      stops: COAL_RADIAL_GRADIENT,
      noise: {
        colorAmplitude: 0.01,
        alphaAmplitude: 0.0,
        scale: 0.2,
      },
    },
    stroke: { color: { r: 0.08, g: 0.08, b: 0.1, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 720,
      armor: 70,
      baseDamage: 185,
      brickKnockBackDistance: 90,
      brickKnockBackSpeed: 190,
      brickKnockBackAmplitude: 6,
      physicalSize: 18,
      damageExplosion: {
        type: "coalBrickHit",
        radiusMultiplier: 0.78,
      },
      destructionExplosion: {
        type: "coalBrickDestroy",
        radiusMultiplier: 1.18,
      },
    },
    rewards: {
      coal: 1,
    },
  },
  smallIce: {
    size: { width: 30, height: 30 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 28,
      stops: ICE_RADIAL_GRADIENT,
      noise: {
        colorAmplitude: 0.05,
        alphaAmplitude: 0.0,
        scale: 0.15,
      },
    },
    stroke: { color: { r: 0.5, g: 0.7, b: 0.9, a: 1 }, width: 2.4 },
    destructubleData: {
      maxHp: 3750,
      armor: 245,
      baseDamage: 355,
      brickKnockBackDistance: 190,
      brickKnockBackSpeed: 280,
      brickKnockBackAmplitude: 4,
      physicalSize: 20,
      damageExplosion: {
        type: "iceBrickHit",
        radiusMultiplier: 0.85,
      },
      destructionExplosion: {
        type: "iceBrickDestroy",
        radiusMultiplier: 1.25,
      },
    },
    rewards: {
      ice: 1,
    },
  },
  smallMagma: {
    size: { width: 24, height: 24 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 12,
      stops: MAGMA_RADIAL_GRADIENT,
      noise: {
        colorAmplitude: 0.02,
        alphaAmplitude: 0.0,
        scale: 0.35,
      },
    },
    stroke: { color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 2755,
      armor: 142,
      baseDamage: 534,
      brickKnockBackDistance: 70,
      brickKnockBackSpeed: 160,
      brickKnockBackAmplitude: 7,
      physicalSize: 18,
      damageExplosion: {
        type: "magmaBrickHit",
        radiusMultiplier: 0.75,
      },
      destructionExplosion: {
        type: "magmaBrickDestroy",
        radiusMultiplier: 1.15,
      },
    },
    rewards: {
      magma: 1,
    },
  },
  neutronBrick: {
    size: { width: 32, height: 32 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 16,
      stops: NEUTRON_RADIAL_GRADIENT,
      noise: {
        colorAmplitude: 0.04,
        alphaAmplitude: 0.0,
        scale: 0.5,
      },
    },
    stroke: { color: { r: 0.9, g: 0.8, b: 0.6, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 1022755,
      armor: 10942,
      baseDamage: 53478,
      brickKnockBackDistance: 70,
      brickKnockBackSpeed: 160,
      brickKnockBackAmplitude: 7,
      physicalSize: 18,
      damageExplosion: {
        type: "magmaBrickHit",
        radiusMultiplier: 0.75,
      },
      destructionExplosion: {
        type: "magmaBrickDestroy",
        radiusMultiplier: 1.15,
      },
    },
    rewards: {
      magma: 1,
    },
  },
  neutronBrick2: {
    size: { width: 32, height: 32 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 16,
      stops: NEUTRON_RADIAL_GRADIENT_2,
      noise: {
        colorAmplitude: 0.04,
        alphaAmplitude: 0.0,
        scale: 0.5,
      },
    },
    stroke: { color: { r: 0.8, g: 0.8, b: 0.6, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 1022755,
      armor: 10942,
      baseDamage: 53478,
      brickKnockBackDistance: 70,
      brickKnockBackSpeed: 160,
      brickKnockBackAmplitude: 7,
      physicalSize: 18,
      damageExplosion: {
        type: "magmaBrickHit",
        radiusMultiplier: 0.75,
      },
      destructionExplosion: {
        type: "magmaBrickDestroy",
        radiusMultiplier: 1.15,
      },
    },
    rewards: {
      magma: 1,
    },
  },
  darkMatterBrick: {
    size: { width: 32, height: 32 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 28,
      stops: DARK_MATTER_RADIAL_GRADIENT,
      noise: {
        colorAmplitude: 0.05,
        alphaAmplitude: 0.0,
        scale: 0.4,
      },
    },
    stroke: { color: { r: 0.35, g: 0.65, b: 0.55, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 1022755,
      armor: 10942,
      baseDamage: 53478,
      brickKnockBackDistance: 70,
      brickKnockBackSpeed: 160,
      brickKnockBackAmplitude: 7,
      physicalSize: 18,
      damageExplosion: {
        type: "magmaBrickHit",
        radiusMultiplier: 0.75,
      },
      destructionExplosion: {
        type: "magmaBrickDestroy",
        radiusMultiplier: 1.15,
      },
    },
    rewards: {
      magma: 1,
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
