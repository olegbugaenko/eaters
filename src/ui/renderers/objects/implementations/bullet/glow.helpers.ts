import type { SceneObjectInstance, SceneColor, SceneFill } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import { getBulletRadius, getTailScale } from "./helpers";
import { sanitizeSceneColor, ensureColorAlpha, cloneColorWithAlpha } from "@shared/helpers/scene-color.helper";
import { DEFAULT_GLOW_COLOR, DEFAULT_GLOW_RADIUS_MULTIPLIER } from "./constants";
import type { BulletGlowConfig, BulletRendererCustomData } from "./types";

// Cache for glow fill
const glowFillCache = new WeakMap<
  SceneObjectInstance,
  {
    radius: number;
    source: BulletGlowConfig | undefined;
    fill: SceneFill;
  }
>();

/**
 * Gets glow config from instance
 */
export const getGlowConfig = (
  instance: SceneObjectInstance
): { color: SceneColor; radiusMultiplier: number } | null => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  const glow = data?.glow;
  if (!glow) {
    return null;
  }

  const radiusMultiplier =
    typeof glow.radiusMultiplier === "number" && Number.isFinite(glow.radiusMultiplier)
      ? Math.max(0, glow.radiusMultiplier)
      : DEFAULT_GLOW_RADIUS_MULTIPLIER;

  return {
    color: sanitizeSceneColor(glow.color, DEFAULT_GLOW_COLOR),
    radiusMultiplier,
  };
};

/**
 * Gets glow radius
 */
export const getGlowRadius = (instance: SceneObjectInstance): number => {
  const glow = getGlowConfig(instance);
  if (!glow) {
    return 0;
  }
  const radius = getBulletRadius(instance);
  const tailScale = getTailScale(instance);
  return radius * glow.radiusMultiplier * Math.max(1, tailScale * 0.9);
};

/**
 * Creates glow fill (with caching)
 */
export const createGlowFill = (
  instance: SceneObjectInstance,
  glow: { color: SceneColor; radiusMultiplier: number }
): SceneFill => {
  const customData = instance.data.customData as BulletRendererCustomData | undefined;
  const radius = getGlowRadius(instance);
  const cached = glowFillCache.get(instance);
  if (cached && cached.radius === radius && cached.source === customData?.glow) {
    return cached.fill;
  }

  const baseAlpha = ensureColorAlpha(glow.color);
  const fill: SceneFill = {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    end: radius,
    stops: [
      { offset: 0, color: cloneColorWithAlpha(glow.color, baseAlpha * 0.7) },
      { offset: 0.55, color: cloneColorWithAlpha(glow.color, baseAlpha * 0.35) },
      { offset: 1, color: cloneColorWithAlpha(glow.color, 0) },
    ],
  };

  glowFillCache.set(instance, {
    radius,
    source: customData?.glow,
    fill,
  });

  return fill;
};
