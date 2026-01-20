import type { SceneObjectInstance, SceneLinearGradientFill, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { BulletTailRenderConfig } from "./types";
import { getTailScale, getBulletRadius } from "./helpers";
import { sanitizeSceneColor } from "@shared/helpers/scene-color.helper";
import { DEFAULT_TAIL_CONFIG } from "./constants";
import type { BulletRendererCustomData } from "./types";

// Cache for tail config
const tailConfigCache = new WeakMap<
  SceneObjectInstance,
  {
    source: BulletRendererCustomData["tail"] | undefined;
    config: BulletTailRenderConfig;
  }
>();

// Cache for tail fill
const tailFillCache = new WeakMap<
  SceneObjectInstance,
  { radius: number; tailRef: BulletTailRenderConfig; fill: SceneLinearGradientFill }
>();

// Cache for tail vertices
const tailVerticesCache = new WeakMap<
  SceneObjectInstance,
  {
    radius: number;
    tailRef: BulletTailRenderConfig;
    vertices: [SceneVector2, SceneVector2, SceneVector2];
  }
>();

/**
 * Gets tail render config (with caching)
 */
export const getTailConfig = (instance: SceneObjectInstance): BulletTailRenderConfig => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  const tail = data && typeof data === "object" ? data.tail : undefined;
  const cached = tailConfigCache.get(instance);
  if (cached && cached.source === tail) {
    return cached.config;
  }

  if (!tail) {
    return DEFAULT_TAIL_CONFIG;
  }

  const lengthMultiplier =
    typeof tail.lengthMultiplier === "number"
      ? tail.lengthMultiplier
      : DEFAULT_TAIL_CONFIG.lengthMultiplier;
  const widthMultiplier =
    typeof tail.widthMultiplier === "number"
      ? tail.widthMultiplier
      : DEFAULT_TAIL_CONFIG.widthMultiplier;
  const startColor = tail.startColor
    ? sanitizeSceneColor(tail.startColor, DEFAULT_TAIL_CONFIG.startColor)
    : { ...DEFAULT_TAIL_CONFIG.startColor };
  const endColor = tail.endColor
    ? sanitizeSceneColor(tail.endColor, DEFAULT_TAIL_CONFIG.endColor)
    : { ...DEFAULT_TAIL_CONFIG.endColor };

  const scale = getTailScale(instance);

  const config: BulletTailRenderConfig = {
    lengthMultiplier: lengthMultiplier * scale,
    widthMultiplier: widthMultiplier * scale,
    startColor,
    endColor,
  };

  tailConfigCache.set(instance, { source: tail, config });

  return config;
};

/**
 * Creates tail vertices (with caching)
 */
export const createTailVertices = (
  instance: SceneObjectInstance
): [SceneVector2, SceneVector2, SceneVector2] => {
  const radius = getBulletRadius(instance);
  const tail = getTailConfig(instance);

  // OPTIMIZATION: Cache vertices to avoid creating new objects every frame
  const cached = tailVerticesCache.get(instance);
  if (cached && cached.radius === radius && cached.tailRef === tail) {
    return cached.vertices;
  }

  const tailLength = radius * tail.lengthMultiplier;
  const tailHalfWidth = (radius * tail.widthMultiplier) / 2;
  const vertices: [SceneVector2, SceneVector2, SceneVector2] = [
    { x: 0, y: tailHalfWidth },
    { x: 0, y: -tailHalfWidth },
    { x: -tailLength, y: 0 },
  ];

  tailVerticesCache.set(instance, { radius, tailRef: tail, vertices });
  return vertices;
};

/**
 * Creates tail fill (with caching)
 */
export const createTailFill = (instance: SceneObjectInstance): SceneLinearGradientFill => {
  const radius = getBulletRadius(instance);
  const tail = getTailConfig(instance);
  const cached = tailFillCache.get(instance);
  if (cached && cached.radius === radius && cached.tailRef === tail) {
    return cached.fill;
  }

  const tailLength = radius * tail.lengthMultiplier;
  const fill: SceneLinearGradientFill = {
    fillType: FILL_TYPES.LINEAR_GRADIENT,
    start: { x: 0, y: 0 },
    end: { x: -tailLength, y: 0 },
    stops: [
      { offset: 0, color: { ...tail.startColor } },
      { offset: 1, color: { ...tail.endColor } },
    ],
  };

  tailFillCache.set(instance, { radius, tailRef: tail, fill });

  return fill;
};
