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
  sanitizeCompositeFillConfig,
  sanitizeCompositeStrokeConfig,
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
  if (layer.shape === "polygon") {
    if (!layer.vertices || layer.vertices.length < 3) {
      return null;
    }
    return {
      shape: "polygon",
      vertices: layer.vertices.map((v) => ({ x: v.x, y: v.y })),
      offset: layer.offset,
      fill: sanitizeCompositeFillConfig(layer.fill),
      stroke: sanitizeCompositeStrokeConfig(layer.stroke),
      anim: layer.anim,
      spine: layer.spine,
      segmentIndex: layer.segmentIndex,
      buildOpts: layer.buildOpts,
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
      offset: layer.offset,
      fill: sanitizeCompositeFillConfig(layer.fill),
      stroke: sanitizeCompositeStrokeConfig(layer.stroke),
      anim: layer.anim,
    };
  }
  // circle
  const radius = typeof layer.radius === "number" && Number.isFinite(layer.radius) && layer.radius > 0
    ? layer.radius
    : undefined;
  if (!radius) {
    return null;
  }
  return {
    shape: "circle",
    radius,
    segments: typeof layer.segments === "number" && layer.segments >= 3 ? layer.segments : undefined,
    offset: layer.offset,
    fill: sanitizeCompositeFillConfig(layer.fill),
    stroke: sanitizeCompositeStrokeConfig(layer.stroke),
    anim: layer.anim,
  };
};
