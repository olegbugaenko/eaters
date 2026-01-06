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
  createCompositeLayerSanitizer,
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
  const sanitized = sanitizePlayerCompositeLayer(layer);
  return sanitized as RendererLayer | null;
};

type PlayerLayerExtraFields = {
  requiresModule?: PlayerUnitCustomData["modules"] extends ReadonlyArray<infer T> | undefined ? T : never;
  requiresSkill?: PlayerUnitCustomData["skills"] extends ReadonlyArray<infer T> | undefined ? T : never;
  requiresEffect?: string;
  anim?: RendererLayer["anim"];
  spine?: RendererLayer["spine"];
  segmentIndex?: RendererLayer["segmentIndex"];
  buildOpts?: RendererLayer["buildOpts"];
  groupId?: RendererLayer["groupId"];
};

const sanitizePlayerCompositeLayer = createCompositeLayerSanitizer<
  PlayerUnitRendererLayerConfig,
  PlayerLayerExtraFields
>({
  sanitizeVertices: (vertices) =>
    sanitizeLayerVertices(vertices as readonly SceneVector2[] | undefined),
  sanitizeOffset,
  sanitizeCircleRadius: (radius) =>
    typeof radius === "number" && Number.isFinite(radius) ? radius : null,
  sanitizeCircleSegments: (segments) =>
    typeof segments === "number" && Number.isFinite(segments)
      ? Math.max(Math.round(segments), MIN_CIRCLE_SEGMENTS)
      : 32,
  sanitizeSprite: (layer) => {
    if (layer.shape !== "sprite") {
      return null;
    }
    if (!layer.spritePath || typeof layer.width !== "number" || typeof layer.height !== "number") {
      return null;
    }
    return {
      spritePath: layer.spritePath,
      width: layer.width,
      height: layer.height,
    };
  },
  mapExtraFields: (layer) => ({
    requiresModule: layer.requiresModule,
    requiresSkill: layer.requiresSkill,
    requiresEffect: layer.requiresEffect,
    anim: layer.anim,
    spine: layer.spine,
    segmentIndex: layer.segmentIndex,
    buildOpts: layer.buildOpts,
    groupId: layer.groupId,
  }),
});

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
