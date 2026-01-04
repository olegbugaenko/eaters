import type {
  SceneObjectInstance,
  SceneVector2,
  SceneColor,
  SceneFill,
  SceneStroke,
  SceneSolidFill,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import { cloneSceneFill } from "@shared/helpers/scene-fill.helper";
import { sanitizeSceneColor } from "@shared/helpers/scene-color.helper";
import { clamp01 } from "@shared/helpers/numbers.helper";
import { createSolidFill } from "@/logic/services/scene-object-manager/scene-object-manager.helpers";
import type {
  PlayerUnitRendererConfig,
  PlayerUnitRendererLayerConfig,
} from "@db/player-units-db";
import type { RendererFillConfig, RendererStrokeConfig } from "@shared/types/renderer-config";
import { isVector, sanitizeVertices, sanitizeOffset } from "@shared/helpers/vector.helper";
import { DEFAULT_VERTICES, DEFAULT_BASE_FILL_COLOR, MIN_CIRCLE_SEGMENTS } from "./constants";
import type {
  PlayerUnitCustomData,
  PlayerUnitRendererLegacyPayload,
  CompositeRendererData,
  PolygonRendererData,
  RendererData,
  RendererLayer,
  RendererLayerFill,
  RendererLayerStroke,
} from "./types";

import { getNowMs } from "@shared/helpers/time.helper";

/**
 * Gets current timestamp for tentacle animation
 */
export const getTentacleTimeMs = getNowMs;

// sanitizeVertices is now imported directly from @shared/helpers/vector.helper with fallback support

/**
 * Sanitizes layer vertices (returns null if invalid or has fewer than 3 vertices)
 */
export const sanitizeLayerVertices = (
  vertices: readonly SceneVector2[] | undefined
): SceneVector2[] | null => {
  const sanitized = sanitizeVertices(vertices, undefined, 3);
  return sanitized.length >= 3 ? sanitized : null;
};

// sanitizeOffset is now imported directly from @shared/helpers/vector.helper

/**
 * Extracts and sanitizes renderer data from instance
 */
export const extractRendererData = (instance: SceneObjectInstance): RendererData => {
  const payload = instance.data.customData as PlayerUnitCustomData | undefined;
  if (payload && typeof payload === "object") {
    const renderer = payload.renderer;
    if (renderer && typeof renderer === "object") {
      if ((renderer as PlayerUnitRendererConfig).kind === "composite") {
        const composite = sanitizeCompositeRenderer(
          renderer as PlayerUnitRendererConfig,
          payload
        );
        if (composite) {
          return composite;
        }
      }
      if ((renderer as PlayerUnitRendererLegacyPayload).kind === "polygon") {
        const legacy = renderer as PlayerUnitRendererLegacyPayload;
        return {
          kind: "polygon",
          vertices: sanitizeVertices(legacy.vertices, DEFAULT_VERTICES, 3),
          offset: sanitizeOffset(legacy.offset),
        };
      }
    }
  }
  return { kind: "polygon", vertices: sanitizeVertices(undefined, DEFAULT_VERTICES, 3) };
};

/**
 * Sanitizes composite renderer config
 */
export const sanitizeCompositeRenderer = (
  renderer: PlayerUnitRendererConfig,
  payload: PlayerUnitCustomData | undefined
): CompositeRendererData | null => {
  if (renderer.kind !== "composite") {
    return null;
  }
  const fallbackFill = sanitizeSceneColor(renderer.fill, DEFAULT_BASE_FILL_COLOR);
  const baseFillColor = sanitizeSceneColor(payload?.baseFillColor, fallbackFill);
  const fallbackStrokeColor = renderer.stroke
    ? sanitizeSceneColor(renderer.stroke.color, fallbackFill)
    : undefined;
  const baseStrokeColor = renderer.stroke
    ? sanitizeSceneColor(payload?.baseStrokeColor, fallbackStrokeColor!)
    : undefined;

  const layers = renderer.layers
    .map((layer) => sanitizeCompositeLayer(layer))
    .filter((layer): layer is RendererLayer => layer !== null);

  if (layers.length === 0) {
    return null;
  }

  return {
    kind: "composite",
    baseFillColor,
    baseStrokeColor,
    layers,
    auras: renderer.auras,
  };
};

/**
 * Sanitizes composite layer config
 */
export const sanitizeCompositeLayer = (
  layer: PlayerUnitRendererLayerConfig
): RendererLayer | null => {
  if (layer.shape === "polygon") {
    const vertices = sanitizeLayerVertices(layer.vertices);
    if (!vertices) {
      return null;
    }
    return {
      shape: "polygon",
      vertices,
      offset: sanitizeOffset(layer.offset),
      fill: sanitizeFillConfig(layer.fill),
      stroke: sanitizeStrokeConfig(layer.stroke),
      requiresModule: layer.requiresModule,
      requiresSkill: layer.requiresSkill,
      requiresEffect: layer.requiresEffect,
      anim: layer.anim,
      spine: layer.spine,
      segmentIndex: layer.segmentIndex,
      buildOpts: layer.buildOpts,
      groupId: layer.groupId,
    };
  }

  const radius =
    typeof layer.radius === "number" && Number.isFinite(layer.radius) ? layer.radius : 0;
  if (radius <= 0) {
    return null;
  }
  const segments =
    typeof layer.segments === "number" && Number.isFinite(layer.segments)
      ? Math.max(Math.round(layer.segments), MIN_CIRCLE_SEGMENTS)
      : 32;
  return {
    shape: "circle",
    radius,
    segments,
    offset: sanitizeOffset(layer.offset),
    fill: sanitizeFillConfig(layer.fill),
    stroke: sanitizeStrokeConfig(layer.stroke),
    requiresModule: layer.requiresModule,
    requiresSkill: layer.requiresSkill,
    requiresEffect: layer.requiresEffect,
    anim: layer.anim,
    groupId: layer.groupId,
  };
};

/**
 * Clamps brightness value between -1 and 1
 */
export const clampBrightness = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value <= -1) {
    return -1;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
};

/**
 * Clamps alpha multiplier between 0 and 10
 */
export const clampAlphaMultiplier = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 10) {
    return 10;
  }
  return value;
};

/**
 * Sanitizes fill config
 */
export const sanitizeFillConfig = (
  fill: RendererFillConfig | undefined
): RendererLayerFill => {
  if (!fill || fill.type === "base") {
    return {
      kind: "base",
      brightness: clampBrightness(fill?.brightness),
      alphaMultiplier: clampAlphaMultiplier(fill?.alphaMultiplier),
    };
  }
  // solid and gradient: incoming is SceneFill-compatible
  if (fill.type === "solid") {
    const solidFill = fill.fill as SceneSolidFill;
    return {
      kind: "solid" as const,
      color: { ...solidFill.color },
      ...(solidFill.noise ? { noise: solidFill.noise } : {}),
    };
  }
  return {
    kind: "gradient" as const,
    fill: cloneSceneFill(fill.fill),
  };
};

/**
 * Sanitizes stroke config
 */
export const sanitizeStrokeConfig = (
  stroke: RendererStrokeConfig | undefined
): RendererLayerStroke | undefined => {
  if (!stroke) {
    return undefined;
  }
  const width = typeof stroke.width === "number" && Number.isFinite(stroke.width)
    ? stroke.width
    : 0;
  if (width <= 0) {
    return undefined;
  }
  if (stroke.type === "solid") {
    return {
      kind: "solid",
      width,
      color: { ...stroke.color },
    };
  }
  return {
    kind: "base",
    width,
    brightness: clampBrightness(stroke.brightness),
    alphaMultiplier: clampAlphaMultiplier(stroke.alphaMultiplier),
  };
};

/**
 * Applies brightness to a color component
 */
export const applyBrightness = (component: number, brightness: number): number => {
  if (brightness > 0) {
    return component + (1 - component) * brightness;
  }
  if (brightness < 0) {
    return component * (1 + brightness);
  }
  return component;
};

/**
 * Tints a color with brightness and alpha multiplier
 */
export const tintColor = (
  color: SceneColor,
  brightness: number,
  alphaMultiplier: number
): SceneColor => {
  const r = clamp01(applyBrightness(color.r, brightness));
  const g = clamp01(applyBrightness(color.g, brightness));
  const b = clamp01(applyBrightness(color.b, brightness));
  const baseAlpha = typeof color.a === "number" && Number.isFinite(color.a) ? color.a : 1;
  const a = clamp01(baseAlpha * alphaMultiplier);
  return { r, g, b, a };
};


/**
 * Resolves fill color from instance
 */
export const resolveFillColor = (
  instance: SceneObjectInstance,
  fallback: SceneColor
): SceneColor => {
  const fill = instance.data.fill;
  if (fill?.fillType === FILL_TYPES.SOLID) {
    const solidFill = fill as SceneSolidFill;
    const color = solidFill.color;
    return {
      r: color.r,
      g: color.g,
      b: color.b,
      a: typeof color.a === "number" && Number.isFinite(color.a) ? color.a : 1,
    };
  }
  return fallback;
};

/**
 * Resolves stroke color from instance
 */
export const resolveStrokeColor = (
  instance: SceneObjectInstance,
  fallbackStroke: SceneColor | undefined,
  fallbackFill: SceneColor
): SceneColor => {
  const stroke = instance.data.stroke;
  if (stroke && stroke.width > 0) {
    const color = stroke.color;
    if (color) {
      return {
        r: color.r,
        g: color.g,
        b: color.b,
        a: typeof color.a === "number" && Number.isFinite(color.a) ? color.a : 1,
      };
    }
  }
  if (fallbackStroke) {
    return fallbackStroke;
  }
  return fallbackFill;
};

/**
 * Resolves layer fill to SceneFill
 */
export const resolveLayerFill = (
  instance: SceneObjectInstance,
  fill: RendererLayerFill,
  renderer: CompositeRendererData
): SceneFill => {
  switch (fill.kind) {
    case "solid":
      return createSolidFill(fill.color, { noise: fill.noise });
    case "gradient":
      return cloneSceneFill(fill.fill);
    default: {
      const baseColor = resolveFillColor(instance, renderer.baseFillColor);
      const tinted = tintColor(baseColor, fill.brightness, fill.alphaMultiplier);
      return createSolidFill(tinted, { noise: instance.data.fill.noise });
    }
  }
};

/**
 * Resolves layer stroke fill to SceneFill
 */
export const resolveLayerStrokeFill = (
  instance: SceneObjectInstance,
  stroke: RendererLayerStroke,
  renderer: CompositeRendererData
): SceneFill => {
  if (stroke.kind === "solid") {
    return createSolidFill(stroke.color);
  }
  const baseColor = resolveStrokeColor(
    instance,
    renderer.baseStrokeColor,
    renderer.baseFillColor
  );
  const tinted = tintColor(baseColor, stroke.brightness, stroke.alphaMultiplier);
  return createSolidFill(tinted, { noise: instance.data.fill.noise });
};
