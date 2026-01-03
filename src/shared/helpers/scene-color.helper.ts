import type { SceneColor } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { DEFAULT_COLOR } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import { clamp01, clampNumber } from "@shared/helpers/numbers.helper";

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
 * Sanitizes a scene color with a fallback value.
 * Handles optional alpha channel (defaults to 1 if not provided).
 * Validates and clamps color components to [0, 1] range.
 */
export const sanitizeSceneColor = (
  color: SceneColor | undefined,
  fallback: SceneColor
): SceneColor => ({
  r: typeof color?.r === "number" && Number.isFinite(color.r)
    ? clamp01(color.r)
    : clamp01(fallback.r),
  g: typeof color?.g === "number" && Number.isFinite(color.g)
    ? clamp01(color.g)
    : clamp01(fallback.g),
  b: typeof color?.b === "number" && Number.isFinite(color.b)
    ? clamp01(color.b)
    : clamp01(fallback.b),
  a: typeof color?.a === "number" && Number.isFinite(color.a)
    ? clamp01(color.a)
    : typeof fallback.a === "number"
    ? clamp01(fallback.a)
    : 1,
});

/**
 * Sanitizes a scene color using DEFAULT_COLOR as fallback.
 * Handles optional alpha channel (defaults to 1 if not provided).
 * Validates and clamps color components to [0, 1] range.
 * This is a convenience function for cases where DEFAULT_COLOR is the desired fallback.
 */
export const sanitizeColor = (color: SceneColor | undefined): SceneColor => {
  if (!color) {
    return { ...DEFAULT_COLOR };
  }
  return {
    r: clamp01(color.r),
    g: clamp01(color.g),
    b: clamp01(color.b),
    a: clamp01(typeof color.a === "number" ? color.a : DEFAULT_COLOR.a ?? 1),
  };
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

/**
 * Ensures a valid alpha value from a scene color.
 * Returns the alpha value if it's a valid number, otherwise returns 1.
 */
export const ensureColorAlpha = (color: SceneColor): number =>
  typeof color.a === "number" && Number.isFinite(color.a) ? color.a : 1;

/**
 * Clones a scene color with a new alpha value.
 * Creates a shallow copy of the color and sets the specified alpha.
 */
export const cloneColorWithAlpha = (color: SceneColor, alpha: number): SceneColor => {
  const cloned = cloneSceneColor(color);
  return { ...cloned, a: alpha };
};
