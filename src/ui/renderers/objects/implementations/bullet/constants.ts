import type { BulletTailRenderConfig } from "./types";
import type { SceneColor } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

export const DEFAULT_TAIL_CONFIG: BulletTailRenderConfig = {
  lengthMultiplier: 4.5,
  widthMultiplier: 1.75,
  startColor: { r: 0.25, g: 0.45, b: 1, a: 0.65 },
  endColor: { r: 0.05, g: 0.15, b: 0.6, a: 0 },
};

export const DEFAULT_GLOW_COLOR: SceneColor = { r: 1, g: 1, b: 1, a: 0.4 };
export const DEFAULT_GLOW_RADIUS_MULTIPLIER = 1.8;
export const MIN_SPEED = 0.01;
export const DEFAULT_SPEED_FOR_TAIL_SCALE = 120;
