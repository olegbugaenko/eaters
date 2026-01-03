import type {
  SceneObjectInstance,
  SceneVector2,
  SceneColor,
  SceneFill,
  SceneFillNoise,
  SceneStroke,
  SceneSolidFill,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import { cloneSceneFill } from "@/logic/helpers/scene-fill.helper";
import { sanitizeSceneColor } from "@/logic/helpers/scene-color.helper";
import { cloneSceneFillNoise, cloneSceneFillFilaments } from "@/logic/helpers/scene-fill.helper";
import { clamp01 } from "@shared/helpers/numbers.helper";
import { createSolidFill as createBaseSolidFill } from "@/logic/services/scene-object-manager/scene-object-manager.helpers";
import type {
  PlayerUnitRendererConfig,
  PlayerUnitRendererLayerConfig,
  PlayerUnitRendererFillConfig,
  PlayerUnitRendererStrokeConfig,
} from "../../../../../db/player-units-db";
import { isVector, sanitizeVertices as sanitizeVerticesShared, sanitizeOffset as sanitizeOffsetShared } from "../../shared/helpers";
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

/**
 * Gets current timestamp for tentacle animation
 */
export const getTentacleTimeMs = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

/**
 * Sanitizes vertices array, filtering invalid entries and falling back to default
 */
export const sanitizeVertices = (vertices: SceneVector2[] | undefined): SceneVector2[] => {
  if (!Array.isArray(vertices)) {
    return DEFAULT_VERTICES.map((vertex) => ({ ...vertex }));
  }
  const sanitized = sanitizeVerticesShared(vertices);
  if (sanitized.length < 3) {
    return DEFAULT_VERTICES.map((vertex) => ({ ...vertex }));
  }
  return sanitized;
};

/**
 * Sanitizes layer vertices (returns null if invalid)
 */
export const sanitizeLayerVertices = (
  vertices: readonly SceneVector2[] | undefined
): SceneVector2[] | null => {
  if (!Array.isArray(vertices)) {
    return null;
  }
  const sanitized = vertices
    .filter((vertex) => isVector(vertex))
    .map((vertex) => ({ x: vertex.x, y: vertex.y }));
  if (sanitized.length < 3) {
    return null;
  }
  return sanitized;
};

/**
 * Sanitizes offset vector
 */
export const sanitizeOffset = sanitizeOffsetShared;

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
          vertices: sanitizeVertices(legacy.vertices),
          offset: sanitizeOffset(legacy.offset),
        };
      }
    }
  }
  return { kind: "polygon", vertices: DEFAULT_VERTICES.map((vertex) => ({ ...vertex })) };
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
  fill: PlayerUnitRendererFillConfig | undefined
): RendererLayerFill => {
  if (!fill || fill.type === "base") {
    return {
      kind: "base",
      brightness: clampBrightness(fill?.brightness),
      alphaMultiplier: clampAlphaMultiplier(fill?.alphaMultiplier),
    };
  }
  if (fill.type === "solid") {
    return {
      kind: "solid",
      color: { ...fill.color },
      ...(fill.noise ? { noise: cloneSceneFillNoise(fill.noise) } : {}),
      ...(fill.filaments
        ? { filaments: cloneSceneFillFilaments(fill.filaments) }
        : {}),
    };
  }
  return {
    kind: "gradient",
    fill: cloneSceneFill(fill.fill),
  };
};

/**
 * Sanitizes stroke config
 */
export const sanitizeStrokeConfig = (
  stroke: PlayerUnitRendererStrokeConfig | undefined
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
 * Creates a solid fill from color and optional noise
 */
export const createSolidFill = (
  color: SceneColor,
  noise?: SceneFillNoise
): SceneFill => {
  const fill = createBaseSolidFill(color);
  if (noise) {
    return { ...fill, noise: cloneSceneFillNoise(noise) };
  }
  return fill;
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
      return createSolidFill(fill.color, fill.noise);
    case "gradient":
      return cloneSceneFill(fill.fill);
    default: {
      const baseColor = resolveFillColor(instance, renderer.baseFillColor);
      const tinted = tintColor(baseColor, fill.brightness, fill.alphaMultiplier);
      return createSolidFill(tinted, instance.data.fill.noise);
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
  return createSolidFill(tinted, instance.data.fill.noise);
};
