import type { SceneFill, SceneStroke } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { hasStroke, createStrokeFill } from "@shared/helpers/stroke.helper";

// Re-export shared helpers for convenience
export { hasStroke, createStrokeFill };

/**
 * Expands size by stroke width (adds stroke on both sides)
 */
export const expandSize = (
  size: { width: number; height: number },
  strokeWidth: number
): { width: number; height: number } => ({
  width: size.width + strokeWidth * 2,
  height: size.height + strokeWidth * 2,
});
