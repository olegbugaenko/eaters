import {
  SceneGradientStop,
  SceneSize,
} from "../logic/services/SceneObjectManager";

export type BrickType = "classic" | "smallSquareGray";

export interface BrickConfig {
  size: SceneSize;
  gradientStops: readonly SceneGradientStop[];
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

const BRICK_DB: Record<BrickType, BrickConfig> = {
  classic: {
    size: { width: 60, height: 30 },
    gradientStops: CLASSIC_GRADIENT,
  },
  smallSquareGray: {
    size: { width: 32, height: 32 },
    gradientStops: SMALL_SQUARE_GRAY_GRADIENT,
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
