import type {
  SceneObjectInstance,
  SceneColor,
  SceneFill,
  SceneStroke,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import type { EnemyRendererCompositeConfig } from "@db/enemies-db";
import type { RendererFillConfig, RendererStrokeConfig } from "@shared/types/renderer-config";
import {
  type CompositeRendererLayerFill,
  type CompositeRendererLayerStroke,
  createCompositeLayerSanitizer,
  resolveCompositeLayerFill,
  resolveCompositeLayerStrokeFill,
  resolveCompositeFillColor,
  resolveCompositeStrokeColor,
} from "../../shared/composite-renderer-helpers";

// Re-export types for backward compatibility
export type EnemyRendererLayerFill = CompositeRendererLayerFill;
export type EnemyRendererLayerStroke = CompositeRendererLayerStroke;

// Re-export helper functions for backward compatibility
export const resolveFillColor = resolveCompositeFillColor;
export const resolveStrokeColor = resolveCompositeStrokeColor;
export const resolveLayerFill = (
  instance: SceneObjectInstance,
  fill: EnemyRendererLayerFill,
  renderer: EnemyRendererCompositeConfig
): SceneFill => {
  return resolveCompositeLayerFill(instance, fill, renderer);
};
export const resolveLayerStrokeFill = (
  instance: SceneObjectInstance,
  stroke: EnemyRendererLayerStroke,
  renderer: EnemyRendererCompositeConfig
): SceneFill => {
  return resolveCompositeLayerStrokeFill(instance, stroke, renderer);
};

/**
 * Sanitizes a composite layer config to runtime format
 */
export const sanitizeCompositeLayer = (
  layer: {
    shape: "polygon" | "circle" | "sprite";
    vertices?: readonly { x: number; y: number }[];
    radius?: number;
    segments?: number;
    spritePath?: string;
    width?: number;
    height?: number;
    offset?: { x: number; y: number };
    fill?: RendererFillConfig;
    stroke?: RendererStrokeConfig;
    anim?: any; // Animation config (optional for enemies)
    spine?: { x: number; y: number; width: number }[];
    segmentIndex?: number;
    buildOpts?: { epsilon?: number; minSegmentLength?: number; winding?: "CW" | "CCW" };
  }
): {
  shape: "polygon" | "circle" | "sprite";
  vertices?: { x: number; y: number }[];
  radius?: number;
  segments?: number;
  spritePath?: string;
  width?: number;
  height?: number;
  offset?: { x: number; y: number };
  fill: EnemyRendererLayerFill;
  stroke?: EnemyRendererLayerStroke;
  anim?: any;
  spine?: { x: number; y: number; width: number }[];
  segmentIndex?: number;
  buildOpts?: { epsilon?: number; minSegmentLength?: number; winding?: "CW" | "CCW" };
} | null => {
  return sanitizeEnemyCompositeLayer(layer);
};

type EnemyLayerExtras = {
  offset?: { x: number; y: number };
  anim?: any;
  spine?: { x: number; y: number; width: number }[];
  segmentIndex?: number;
  buildOpts?: { epsilon?: number; minSegmentLength?: number; winding?: "CW" | "CCW" };
};

const sanitizeEnemyCompositeLayer = createCompositeLayerSanitizer<
  {
    shape: "polygon" | "circle" | "sprite";
    vertices?: readonly { x: number; y: number }[];
    radius?: number;
    segments?: number;
    spritePath?: string;
    width?: number;
    height?: number;
    offset?: { x: number; y: number };
    fill?: RendererFillConfig;
    stroke?: RendererStrokeConfig;
    anim?: any; // Animation config (optional for enemies)
    spine?: { x: number; y: number; width: number }[];
    segmentIndex?: number;
    buildOpts?: { epsilon?: number; minSegmentLength?: number; winding?: "CW" | "CCW" };
  },
  EnemyLayerExtras
>({
  sanitizeVertices: (vertices) => {
    const typed = vertices as readonly { x: number; y: number }[] | undefined;
    if (!typed || typed.length < 3) {
      return null;
    }
    return typed.map((v) => ({ x: v.x, y: v.y }));
  },
  sanitizeCircleRadius: (radius) =>
    typeof radius === "number" && Number.isFinite(radius) && radius > 0 ? radius : null,
  sanitizeCircleSegments: (segments) =>
    typeof segments === "number" && segments >= 3 ? segments : undefined,
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
    offset: layer.offset,
    anim: layer.anim,
    spine: layer.spine,
    segmentIndex: layer.segmentIndex,
    buildOpts: layer.buildOpts,
  }),
});
