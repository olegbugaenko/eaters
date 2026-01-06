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
import { sanitizeSceneColor, cloneSceneColor } from "@shared/helpers/scene-color.helper";
import { clamp01 } from "@shared/helpers/numbers.helper";
import { createSolidFill } from "@/logic/services/scene-object-manager/scene-object-manager.helpers";
import type {
  PlayerUnitRendererConfig,
  PlayerUnitRendererLayerConfig,
} from "@db/player-units-db";
import type { RendererFillConfig, RendererStrokeConfig } from "@shared/types/renderer-config";
import { isVector, sanitizeVertices, sanitizeOffset } from "@shared/helpers/vector.helper";
import { resolveRendererFillConfig } from "@shared/helpers/renderer-clone.helper";
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
// Re-export shared composite renderer helpers
import {
  sanitizeCompositeFillConfig,
  sanitizeCompositeStrokeConfig,
  resolveCompositeLayerFill,
  resolveCompositeLayerStrokeFill,
  resolveCompositeFillColor,
  resolveCompositeStrokeColor,
  applyBrightness,
  tintColor,
} from "../../shared/composite-renderer-helpers";

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

  if (layer.shape === "sprite") {
    if (!layer.spritePath || typeof layer.width !== "number" || typeof layer.height !== "number") {
      return null;
    }
    return {
      shape: "sprite",
      spritePath: layer.spritePath,
      width: layer.width,
      height: layer.height,
      offset: sanitizeOffset(layer.offset),
      fill: sanitizeFillConfig(layer.fill),
      stroke: sanitizeStrokeConfig(layer.stroke),
      requiresModule: layer.requiresModule,
      requiresSkill: layer.requiresSkill,
      requiresEffect: layer.requiresEffect,
      anim: layer.anim,
      groupId: layer.groupId,
    };
  }

  // circle
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
 * Sanitizes fill config (uses shared implementation)
 */
export const sanitizeFillConfig = (
  fill: RendererFillConfig | undefined
): RendererLayerFill => {
  return sanitizeCompositeFillConfig(fill) as RendererLayerFill;
};

/**
 * Sanitizes stroke config (uses shared implementation)
 */
export const sanitizeStrokeConfig = (
  stroke: RendererStrokeConfig | undefined
): RendererLayerStroke | undefined => {
  return sanitizeCompositeStrokeConfig(stroke) as RendererLayerStroke | undefined;
};

/**
 * Resolves fill color from instance (uses shared implementation)
 */
export const resolveFillColor = resolveCompositeFillColor;

/**
 * Resolves stroke color from instance (uses shared implementation)
 */
export const resolveStrokeColor = resolveCompositeStrokeColor;

/**
 * Resolves layer fill to SceneFill (uses shared implementation)
 */
export const resolveLayerFill = (
  instance: SceneObjectInstance,
  fill: RendererLayerFill,
  renderer: CompositeRendererData
): SceneFill => {
  return resolveCompositeLayerFill(instance, fill, renderer);
};

/**
 * Resolves layer stroke fill to SceneFill (uses shared implementation)
 */
export const resolveLayerStrokeFill = (
  instance: SceneObjectInstance,
  stroke: RendererLayerStroke,
  renderer: CompositeRendererData
): SceneFill => {
  return resolveCompositeLayerStrokeFill(instance, stroke, renderer);
};
