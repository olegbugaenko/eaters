import type {
  SceneObjectInstance,
  SceneColor,
  SceneFill,
  SceneFillNoise,
  SceneStroke,
  SceneSolidFill,
  SceneVector2,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import { cloneSceneFill } from "@shared/helpers/scene-fill.helper";
import { cloneSceneColor } from "@shared/helpers/scene-color.helper";
import { clamp01 } from "@shared/helpers/numbers.helper";
import { createSolidFill } from "@/logic/services/scene-object-manager/scene-object-manager.helpers";
import type { RendererFillConfig, RendererStrokeConfig } from "@shared/types/renderer-config";
import { resolveRendererFillConfig } from "@shared/helpers/renderer-clone.helper";

/**
 * Runtime layer fill types (shared between player units and enemies)
 */
export type CompositeRendererLayerFill =
  | { kind: "base"; brightness?: number; alphaMultiplier?: number }
  | { kind: "solid"; color: SceneColor; noise?: SceneFillNoise }
  | { kind: "gradient"; fill: SceneFill };

/**
 * Runtime layer stroke types (shared between player units and enemies)
 */
export type CompositeRendererLayerStroke =
  | { kind: "base"; width: number; brightness?: number; alphaMultiplier?: number }
  | { kind: "solid"; width: number; color: SceneColor };

/**
 * Base interface for composite renderer configs
 * Supports both player-unit (baseFillColor) and enemy (fill) naming conventions
 */
export interface BaseCompositeRendererConfig {
  fill?: SceneColor;
  baseFillColor?: SceneColor;
  stroke?: {
    color: SceneColor;
    width: number;
  };
  baseStrokeColor?: SceneColor;
}

export interface CompositeLayerBaseConfig {
  shape: "polygon" | "circle" | "sprite";
  vertices?: readonly SceneVector2[];
  radius?: number;
  segments?: number;
  spritePath?: string;
  width?: number;
  height?: number;
  offset?: SceneVector2;
  fill?: RendererFillConfig;
  stroke?: RendererStrokeConfig;
}

export interface CompositeLayerSanitizerOptions<
  TLayer extends CompositeLayerBaseConfig,
  TExtra extends object = object
> {
  sanitizeVertices: (vertices: unknown) => SceneVector2[] | null;
  sanitizeOffset?: (offset: TLayer["offset"] | undefined) => SceneVector2 | undefined;
  sanitizeCircleRadius?: (radius: TLayer["radius"] | undefined) => number | null;
  sanitizeCircleSegments?: (segments: TLayer["segments"] | undefined) => number | undefined;
  sanitizeSprite?: (
    layer: TLayer
  ) => { spritePath: string; width: number; height: number } | null;
  mapExtraFields?: (layer: TLayer) => TExtra;
}

export type SanitizedCompositeLayer<TExtra extends object = object> =
  | ({
      shape: "polygon";
      vertices: SceneVector2[];
    } & TExtra)
  | ({
      shape: "circle";
      radius: number;
      segments?: number;
    } & TExtra)
  | ({
      shape: "sprite";
      spritePath: string;
      width: number;
      height: number;
    } & TExtra);

export const createCompositeLayerSanitizer = <
  TLayer extends CompositeLayerBaseConfig,
  TExtra extends object = object
>(
  options: CompositeLayerSanitizerOptions<TLayer, TExtra>
) => {
  const sanitizeOffset = options.sanitizeOffset ?? ((offset) => offset);
  const sanitizeCircleRadius = options.sanitizeCircleRadius ?? ((radius) => radius ?? null);
  const sanitizeSprite =
    options.sanitizeSprite ??
    ((layer: TLayer) => {
      if (
        !layer.spritePath ||
        typeof layer.width !== "number" ||
        typeof layer.height !== "number"
      ) {
        return null;
      }
      return {
        spritePath: layer.spritePath,
        width: layer.width,
        height: layer.height,
      };
    });

  return (
    layer: TLayer
  ): (SanitizedCompositeLayer<TExtra> & {
    offset?: SceneVector2;
    fill: CompositeRendererLayerFill;
    stroke?: CompositeRendererLayerStroke;
  }) | null => {
    switch (layer.shape) {
      case "polygon": {
        const vertices = options.sanitizeVertices(layer.vertices);
        if (!vertices) {
          return null;
        }
        const extra = options.mapExtraFields ? options.mapExtraFields(layer) : ({} as TExtra);
        return {
          shape: "polygon",
          vertices,
          offset: sanitizeOffset(layer.offset),
          fill: sanitizeCompositeFillConfig(layer.fill),
          stroke: sanitizeCompositeStrokeConfig(layer.stroke),
          ...extra,
        };
      }
      case "circle": {
        const radius = sanitizeCircleRadius(layer.radius);
        if (radius === null || radius <= 0) {
          return null;
        }
        const segments = options.sanitizeCircleSegments
          ? options.sanitizeCircleSegments(layer.segments)
          : layer.segments;
        const extra = options.mapExtraFields ? options.mapExtraFields(layer) : ({} as TExtra);
        return {
          shape: "circle",
          radius,
          segments,
          offset: sanitizeOffset(layer.offset),
          fill: sanitizeCompositeFillConfig(layer.fill),
          stroke: sanitizeCompositeStrokeConfig(layer.stroke),
          ...extra,
        };
      }
      case "sprite": {
        const sprite = sanitizeSprite(layer);
        if (!sprite) {
          return null;
        }
        const extra = options.mapExtraFields ? options.mapExtraFields(layer) : ({} as TExtra);
        return {
          shape: "sprite",
          ...sprite,
          offset: sanitizeOffset(layer.offset),
          fill: sanitizeCompositeFillConfig(layer.fill),
          stroke: sanitizeCompositeStrokeConfig(layer.stroke),
          ...extra,
        };
      }
      default:
        return null;
    }
  };
};

/**
 * Clamps brightness value between -1 and 1
 */
export const clampBrightness = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, value));
};

/**
 * Clamps alpha multiplier between 0 and 1
 */
export const clampAlphaMultiplier = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0, Math.min(1, value));
};

/**
 * Sanitizes fill config for composite layers
 */
export const sanitizeCompositeFillConfig = (
  fill: RendererFillConfig | undefined
): CompositeRendererLayerFill => {
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
      color: cloneSceneColor(solidFill.color),
      ...(solidFill.noise ? { noise: solidFill.noise } : {}),
    };
  }
  return {
    kind: "gradient" as const,
    fill: resolveRendererFillConfig(fill),
  };
};

/**
 * Sanitizes stroke config for composite layers
 */
export const sanitizeCompositeStrokeConfig = (
  stroke: RendererStrokeConfig | undefined
): CompositeRendererLayerStroke | undefined => {
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
      color: cloneSceneColor(stroke.color),
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
  const r = clamp01(applyBrightness(color.r, brightness ?? 0));
  const g = clamp01(applyBrightness(color.g, brightness ?? 0));
  const b = clamp01(applyBrightness(color.b, brightness ?? 0));
  const baseAlpha = typeof color.a === "number" && Number.isFinite(color.a) ? color.a : 1;
  const a = clamp01(baseAlpha * (alphaMultiplier ?? 1));
  return { r, g, b, a };
};

/**
 * Resolves fill color from instance
 */
export const resolveCompositeFillColor = (
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
export const resolveCompositeStrokeColor = (
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
export const resolveCompositeLayerFill = <T extends BaseCompositeRendererConfig>(
  instance: SceneObjectInstance,
  fill: CompositeRendererLayerFill,
  renderer: T
): SceneFill => {
  switch (fill.kind) {
    case "solid":
      return createSolidFill(fill.color, { noise: fill.noise });
    case "gradient":
      return cloneSceneFill(fill.fill);
    default: {
      const baseColor = resolveCompositeFillColor(
        instance,
        renderer.fill ?? renderer.baseFillColor ?? { r: 0.5, g: 0.5, b: 0.5, a: 1 }
      );
      const tinted = tintColor(baseColor, fill.brightness ?? 0, fill.alphaMultiplier ?? 1);
      return createSolidFill(tinted, { noise: instance.data.fill.noise });
    }
  }
};

/**
 * Resolves layer stroke fill to SceneFill
 */
export const resolveCompositeLayerStrokeFill = <T extends BaseCompositeRendererConfig>(
  instance: SceneObjectInstance,
  stroke: CompositeRendererLayerStroke,
  renderer: T
): SceneFill => {
  if (stroke.kind === "solid") {
    return createSolidFill(stroke.color);
  }
  const baseColor = resolveCompositeStrokeColor(
    instance,
    renderer.stroke?.color ?? renderer.baseStrokeColor,
    renderer.fill ?? renderer.baseFillColor ?? { r: 0.5, g: 0.5, b: 0.5, a: 1 }
  );
  const tinted = tintColor(baseColor, stroke.brightness ?? 0, stroke.alphaMultiplier ?? 1);
  return createSolidFill(tinted, { noise: instance.data.fill.noise });
};
