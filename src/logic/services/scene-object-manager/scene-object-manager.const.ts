import type { SceneSize, SceneColor, SceneSolidFill } from "./scene-object-manager.types";

export const FILL_TYPES = {
  SOLID: 0,
  LINEAR_GRADIENT: 1,
  RADIAL_GRADIENT: 2,
  DIAMOND_GRADIENT: 3,
} as const;

export type SceneFillType = (typeof FILL_TYPES)[keyof typeof FILL_TYPES];

export const DEFAULT_SIZE: SceneSize = { width: 50, height: 50 };
export const DEFAULT_COLOR: SceneColor = { r: 1, g: 1, b: 1, a: 1 };
export const DEFAULT_FILL: SceneSolidFill = {
  fillType: FILL_TYPES.SOLID,
  color: { ...DEFAULT_COLOR },
};

export const MIN_NOISE_SCALE = 0.0001;
export const MAX_NOISE_SCALE = 2048;
export const DEFAULT_NOISE_SCALE = 1;

export const MIN_FILAMENT_DENSITY = 0.0001;
export const MAX_FILAMENT_DENSITY = 2048;
export const DEFAULT_FILAMENT_WIDTH = 0.5;
export const DEFAULT_FILAMENT_DENSITY = 1;
export const DEFAULT_FILAMENT_EDGE_BLUR = 0.25;

export const DEFAULT_ROTATION = 0;
export const MIN_MAP_SIZE = 1;
export const MAX_SCALE = 4;

export const REMOVALS_PER_FLUSH = 128;
export const REMOVAL_FLUSH_INTERVAL_MS = 250;
