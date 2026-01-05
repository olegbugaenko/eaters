import type { SceneVector2, SceneColor } from "@/logic/services/scene-object-manager/scene-object-manager.types";

export const DEFAULT_VERTICES: SceneVector2[] = [
  { x: 0, y: -18 },
  { x: 17, y: -6 },
  { x: 11, y: 16 },
  { x: -11, y: 16 },
  { x: -17, y: -6 },
];

export const DEFAULT_EMITTER_COLOR: SceneColor = { r: 0.2, g: 0.45, b: 0.95, a: 0.5 };
export const DEFAULT_BASE_FILL_COLOR: SceneColor = { r: 0.4, g: 0.7, b: 1, a: 1 };
export const MIN_CIRCLE_SEGMENTS = 8;
export const TAU = Math.PI * 2;
export const POLYGON_SWAY_PHASE_STEP = 0.6;
