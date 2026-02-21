import type {
  SceneObjectInstance,
  SceneColor,
  SceneFill,
  SceneFillNoise,
  SceneStroke,
  SceneSolidFill,
  SceneVector2,
  SceneColorTransform,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import { cloneSceneFill } from "@shared/helpers/scene-style.helper";
import { cloneSceneColor } from "@shared/helpers/scene-style.helper";
import { clamp01 } from "@shared/helpers/numbers.helper";
import { createSolidFill } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.helpers";
import type { RendererFillConfig, RendererStrokeConfig } from "@shared/types/renderer-config";
import type { RendererColorAnimationConfig } from "@shared/types/renderer-config";
import { resolveRendererFillConfig } from "@shared/helpers/renderer-clone.helper";

/**
 * Runtime layer fill types (shared between player units and enemies)
 */
export type CompositeRendererLayerFill =
  | {
      kind: "base";
      brightness?: number;
      brightnessShift?: number;
      hueShift?: number;
      saturationShift?: number;
      alphaMultiplier?: number;
      colorAnimation?: CompiledColorAnimationPayload;
    }
  | { kind: "solid"; color: SceneColor; noise?: SceneFillNoise }
  | { kind: "gradient"; fill: SceneFill };

/**
 * Runtime layer stroke types (shared between player units and enemies)
 */
export type CompositeRendererLayerStroke =
  | {
      kind: "base";
      width: number;
      brightness?: number;
      brightnessShift?: number;
      hueShift?: number;
      saturationShift?: number;
      alphaMultiplier?: number;
      colorAnimation?: CompiledColorAnimationPayload;
    }
  | { kind: "solid"; width: number; color: SceneColor };

type CompiledColorAnimationKeyframe = {
  time: number;
  mode: 0 | 1; // 0 = delta HSB, 1 = absolute RGBA
  v0: number;
  v1: number;
  v2: number;
  v3: number;
};

type CompiledColorAnimationPayload = {
  interval: number;
  keyframeCount: number;
  keyframes: CompiledColorAnimationKeyframe[];
};

const MAX_COLOR_ANIMATION_KEYFRAMES = 4;

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
 * Normalizes hue shift to [-0.5, 0.5].
 */
export const clampHueShift = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  const wrapped = ((value + 0.5) % 1 + 1) % 1 - 0.5;
  return wrapped;
};

/**
 * Clamps saturation shift to [-1, 1].
 */
export const clampSaturationShift = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, value));
};

const resolveBrightnessShift = (
  brightness: number | undefined,
  brightnessShift: number | undefined
): number => {
  if (typeof brightnessShift === "number" && Number.isFinite(brightnessShift)) {
    return clampBrightness(brightnessShift);
  }
  return clampBrightness(brightness);
};

const compileColorAnimation = (
  animation: RendererColorAnimationConfig | undefined
): CompiledColorAnimationPayload | undefined => {
  if (!animation) {
    return undefined;
  }
  const interval =
    typeof animation.interval === "number" && Number.isFinite(animation.interval)
      ? animation.interval
      : 0;
  if (interval <= 0 || !Array.isArray(animation.keyframes) || animation.keyframes.length === 0) {
    return undefined;
  }

  const compiled: CompiledColorAnimationKeyframe[] = [];
  animation.keyframes.forEach((keyframe) => {
    if (!keyframe || typeof keyframe !== "object") {
      return;
    }
    const timeRaw = (keyframe as { time?: unknown }).time;
    if (typeof timeRaw !== "number" || !Number.isFinite(timeRaw)) {
      return;
    }
    const time = clamp01(timeRaw);
    const hasRgba = "rgba" in keyframe && Array.isArray((keyframe as { rgba?: unknown }).rgba);
    const hasDelta =
      "deltaHue" in keyframe || "deltaSaturation" in keyframe || "deltaBrightness" in keyframe;

    // Rule: one keyframe can be either delta-mode or absolute RGBA, not both.
    if (hasRgba && hasDelta) {
      return;
    }

    if (hasRgba) {
      const rgba = (keyframe as { rgba: number[] }).rgba;
      if (rgba.length < 3) {
        return;
      }
      compiled.push({
        time,
        mode: 1,
        v0: clamp01(rgba[0] ?? 0),
        v1: clamp01(rgba[1] ?? 0),
        v2: clamp01(rgba[2] ?? 0),
        v3: clamp01(rgba[3] ?? 1),
      });
      return;
    }

    compiled.push({
      time,
      mode: 0,
      v0: clampHueShift((keyframe as { deltaHue?: number }).deltaHue),
      v1: clampSaturationShift((keyframe as { deltaSaturation?: number }).deltaSaturation),
      v2: clampBrightness((keyframe as { deltaBrightness?: number }).deltaBrightness),
      v3: 0,
    });
  });

  if (compiled.length === 0) {
    return undefined;
  }

  compiled.sort((a, b) => a.time - b.time);
  const limited = compiled.slice(0, MAX_COLOR_ANIMATION_KEYFRAMES);
  return {
    interval,
    keyframeCount: limited.length,
    keyframes: limited,
  };
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
      brightness: resolveBrightnessShift(fill?.brightness, fill?.brightnessShift),
      brightnessShift: resolveBrightnessShift(fill?.brightness, fill?.brightnessShift),
      hueShift: clampHueShift(fill?.hueShift),
      saturationShift: clampSaturationShift(fill?.saturationShift),
      alphaMultiplier: clampAlphaMultiplier(fill?.alphaMultiplier),
      colorAnimation: compileColorAnimation(fill?.colorAnimation),
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
    brightness: resolveBrightnessShift(stroke.brightness, stroke.brightnessShift),
    brightnessShift: resolveBrightnessShift(stroke.brightness, stroke.brightnessShift),
    hueShift: clampHueShift(stroke.hueShift),
    saturationShift: clampSaturationShift(stroke.saturationShift),
    alphaMultiplier: clampAlphaMultiplier(stroke.alphaMultiplier),
    colorAnimation: compileColorAnimation(stroke.colorAnimation),
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

// Reusable scratch color to avoid allocations in hot path
const tintScratch: SceneColor = { r: 0, g: 0, b: 0, a: 1 };

const rgbToHsl = (color: SceneColor): { h: number; s: number; l: number } => {
  const r = clamp01(color.r);
  const g = clamp01(color.g);
  const b = clamp01(color.b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) * 0.5;
  if (max === min) {
    return { h: 0, s: 0, l };
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) {
    h = (g - b) / d + (g < b ? 6 : 0);
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  h /= 6;
  return { h, s, l };
};

const hueToRgb = (p: number, q: number, t: number): number => {
  let x = t;
  if (x < 0) x += 1;
  if (x > 1) x -= 1;
  if (x < 1 / 6) return p + (q - p) * 6 * x;
  if (x < 1 / 2) return q;
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
  return p;
};

const hslToRgb = (h: number, s: number, l: number, out: SceneColor): void => {
  if (s <= 0) {
    out.r = l;
    out.g = l;
    out.b = l;
    return;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  out.r = hueToRgb(p, q, h + 1 / 3);
  out.g = hueToRgb(p, q, h);
  out.b = hueToRgb(p, q, h - 1 / 3);
};

export const buildColorTransformPayload = (options: {
  brightnessShift?: number;
  hueShift?: number;
  saturationShift?: number;
  alphaMultiplier?: number;
}): SceneColorTransform => ({
  brightnessShift: clampBrightness(options.brightnessShift),
  hueShift: clampHueShift(options.hueShift),
  saturationShift: clampSaturationShift(options.saturationShift),
  alphaMultiplier: clampAlphaMultiplier(options.alphaMultiplier),
});

/**
 * Tints a color with brightness and alpha multiplier.
 * Returns a reusable scratch object - caller should NOT store the reference!
 */
export const tintColor = (
  color: SceneColor,
  brightness: number,
  alphaMultiplier: number,
  hueShift: number = 0,
  saturationShift: number = 0
): SceneColor => {
  const hsl = rgbToHsl(color);
  const adjustedHue = ((hsl.h + (hueShift ?? 0)) % 1 + 1) % 1;
  const adjustedSaturation = clamp01(hsl.s + (saturationShift ?? 0));
  hslToRgb(adjustedHue, adjustedSaturation, hsl.l, tintScratch);
  tintScratch.r = clamp01(applyBrightness(tintScratch.r, brightness ?? 0));
  tintScratch.g = clamp01(applyBrightness(tintScratch.g, brightness ?? 0));
  tintScratch.b = clamp01(applyBrightness(tintScratch.b, brightness ?? 0));
  const baseAlpha = typeof color.a === "number" && Number.isFinite(color.a) ? color.a : 1;
  tintScratch.a = clamp01(baseAlpha * (alphaMultiplier ?? 1));
  return tintScratch;
};

// Cache for resolved fill colors to avoid repeated object creation
const fillColorCache = new WeakMap<SceneFill, SceneColor>();

/**
 * Resolves fill color from instance
 */
export const resolveCompositeFillColor = (
  instance: SceneObjectInstance,
  fallback: SceneColor
): SceneColor => {
  const fill = instance.data.fill;
  if (fill?.fillType === FILL_TYPES.SOLID) {
    // Check cache first
    let cached = fillColorCache.get(fill);
    if (cached) {
      return cached;
    }
    const solidFill = fill as SceneSolidFill;
    const color = solidFill.color;
    cached = {
      r: color.r,
      g: color.g,
      b: color.b,
      a: typeof color.a === "number" && Number.isFinite(color.a) ? color.a : 1,
    };
    fillColorCache.set(fill, cached);
    return cached;
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
      const colorTransform = buildColorTransformPayload({
        brightnessShift: fill.brightnessShift ?? fill.brightness,
        hueShift: fill.hueShift,
        saturationShift: fill.saturationShift,
        alphaMultiplier: fill.alphaMultiplier,
      });
      const baseColor = resolveCompositeFillColor(
        instance,
        renderer.fill ?? renderer.baseFillColor ?? { r: 0.5, g: 0.5, b: 0.5, a: 1 }
      );
      const tinted = tintColor(
        baseColor,
        colorTransform.brightnessShift,
        colorTransform.alphaMultiplier,
        colorTransform.hueShift,
        colorTransform.saturationShift
      );
      return createSolidFill(tinted, {
        noise: instance.data.fill.noise,
        colorTransform,
        colorAnimation: compileColorAnimation(fill.colorAnimation),
      });
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
  const colorTransform = buildColorTransformPayload({
    brightnessShift: stroke.brightnessShift ?? stroke.brightness,
    hueShift: stroke.hueShift,
    saturationShift: stroke.saturationShift,
    alphaMultiplier: stroke.alphaMultiplier,
  });
  const tinted = tintColor(
    baseColor,
    colorTransform.brightnessShift,
    colorTransform.alphaMultiplier,
    colorTransform.hueShift,
    colorTransform.saturationShift
  );
  return createSolidFill(tinted, {
    noise: instance.data.fill.noise,
    colorTransform,
    colorAnimation: compileColorAnimation(stroke.colorAnimation),
  });
};
