import type { BulletVisualConfig } from "./bullet-render-bridge.types";

/**
 * Default bullet visual config.
 */
export const DEFAULT_BULLET_CONFIG: BulletVisualConfig = {
  visualKey: "default",
  bodyColor: { r: 0.4, g: 0.6, b: 1.0, a: 1.0 },
  tailStartColor: { r: 0.25, g: 0.45, b: 1.0, a: 0.65 },
  tailEndColor: { r: 0.05, g: 0.15, b: 0.6, a: 0.0 },
  tailLengthMultiplier: 4.5,
  tailWidthMultiplier: 2,
  tailTaperMultiplier: 0.7,
  shape: "circle",
};
