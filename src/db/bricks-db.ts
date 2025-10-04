import {
  SceneColor,
  SceneGradientStop,
  SceneSize,
  SceneVector2,
} from "../logic/services/SceneObjectManager";

import { DestructubleData } from "../logic/interfaces/destructuble";

export type BrickType = "classic" | "smallSquareGray" | "blueRadial";

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

const BLUE_RADIAL_GRADIENT: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.65, g: 0.8, b: 1, a: 1 } },
  { offset: 0.4, color: { r: 0.35, g: 0.6, b: 0.95, a: 0.9 } },
  { offset: 1, color: { r: 0.15, g: 0.25, b: 0.7, a: 0.6 } },
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
      brickKnockBackDistance: 20,
      brickKnockBackSpeed: 40,
      physicalSize: 28,
      hitExplosionType: "plasmoid",
      destroyExplosionType: "plasmoid",
    },
  },
  smallSquareGray: {
    size: { width: 24, height: 24 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 28,
      stops: SMALL_SQUARE_GRAY_GRADIENT,
    },
    stroke: { color: { r: 0.3, g: 0.3, b: 0.35, a: 1 }, width: 1.5 },
    destructubleData: {
      maxHp: 5,
      armor: 0,
      baseDamage: 2,
      brickKnockBackDistance: 20,
      brickKnockBackSpeed: 40,
      physicalSize: 16,
      hitExplosionType: "plasmoid",
      destroyExplosionType: "plasmoid",
    },
  },
  blueRadial: {
    size: { width: 48, height: 48 },
    fill: {
      type: "radial",
      center: { x: 0, y: 0 },
      radius: 28,
      stops: BLUE_RADIAL_GRADIENT,
    },
    stroke: { color: { r: 0.1, g: 0.15, b: 0.45, a: 1 }, width: 2.4 },
    destructubleData: {
      maxHp: 125,
      armor: 10,
      baseDamage: 10,
      brickKnockBackDistance: 20,
      brickKnockBackSpeed: 40,
      physicalSize: 24,
      hitExplosionType: "magnetic",
      destroyExplosionType: "magnetic",
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
