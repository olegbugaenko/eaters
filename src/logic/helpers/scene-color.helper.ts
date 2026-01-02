import type { SceneColor } from "../services/scene-object-manager/scene-object-manager.types";
import { clampNumber } from "@/utils/helpers/numbers";

/**
 * Creates a shallow copy of a scene color.
 * Handles optional alpha channel (defaults to 1 if not provided).
 */
export const cloneSceneColor = (color: SceneColor): SceneColor => ({
  r: color.r,
  g: color.g,
  b: color.b,
  a: typeof color.a === "number" ? color.a : 1,
});

/**
 * Checks if two scene colors are approximately equal (within epsilon tolerance).
 * Handles optional alpha channel (defaults to 1 if not provided).
 */
export const sceneColorsEqual = (
  a: SceneColor | undefined,
  b: SceneColor | undefined,
  epsilon = 1e-3
): boolean => {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    Math.abs(a.r - b.r) <= epsilon &&
    Math.abs(a.g - b.g) <= epsilon &&
    Math.abs(a.b - b.b) <= epsilon &&
    Math.abs((a.a ?? 1) - (b.a ?? 1)) <= epsilon
  );
};

/**
 * Blends a single color component (r, g, or b) between base and overlay values.
 */
const blendColorComponent = (
  base: number | undefined,
  overlay: number | undefined,
  intensity: number
): number => {
  const sanitizedBase = Number.isFinite(base) ? (base as number) : 0;
  const sanitizedOverlay = Number.isFinite(overlay) ? (overlay as number) : 0;
  const blended = sanitizedBase + (sanitizedOverlay - sanitizedBase) * intensity;
  return clampNumber(blended, 0, 1);
};

/**
 * Tints a scene color by blending it with another color at a given intensity.
 * Handles optional alpha channel (preserves source alpha).
 */
export const tintSceneColor = (
  source: SceneColor,
  tint: SceneColor,
  intensity: number
): SceneColor => ({
  r: blendColorComponent(source.r, tint.r, intensity),
  g: blendColorComponent(source.g, tint.g, intensity),
  b: blendColorComponent(source.b, tint.b, intensity),
  a: typeof source.a === "number" && Number.isFinite(source.a) ? source.a : 1,
});
