import type {
  SceneColor,
  SceneFill,
  SceneSolidFill,
  SceneVector2,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import { cloneSceneColor } from "@shared/helpers/scene-color.helper";
import { cloneSceneFill, cloneSceneFillDeep } from "@shared/helpers/scene-fill.helper";
import type {
  RendererFillConfig,
  RendererStrokeConfig,
} from "@shared/types/renderer-config";
import type { PlayerUnitRendererConfig, PlayerUnitRendererLayerConfig, PlayerUnitAuraConfig } from "@db/player-units-db";

/**
 * Options for cloning renderer configurations.
 */
export interface CloneRendererOptions {
  /**
   * If true, performs deep cloning of nested objects (colors, fills, etc.).
   * If false, performs shallow cloning for better performance.
   * @default false
   */
  deep?: boolean;
}

/**
 * Clones a RendererFillConfig.
 */
export const cloneRendererFillConfig = (
  fill: RendererFillConfig | undefined,
  options: CloneRendererOptions = {}
): RendererFillConfig | undefined => {
  if (!fill) {
    return undefined;
  }

  if (fill.type === "solid") {
    return {
      type: "solid" as const,
      fill: options.deep
        ? (cloneSceneFillDeep(fill.fill) as SceneSolidFill)
        : (cloneSceneFill(fill.fill) as SceneSolidFill),
    };
  }

  if (fill.type === "gradient") {
    return {
      type: "gradient" as const,
      fill: options.deep ? cloneSceneFillDeep(fill.fill) : cloneSceneFill(fill.fill),
    };
  }

  return {
    type: "base",
    brightness: fill.brightness,
    alphaMultiplier: fill.alphaMultiplier,
  };
};

/**
 * Resolves RendererFillConfig to SceneFill.
 * This is a unified function for converting RendererFillConfig to SceneFill.
 * Use this instead of manually cloning fill.fill in different places.
 */
export const resolveRendererFillConfig = (
  fill: RendererFillConfig | undefined,
  options: CloneRendererOptions = {}
): SceneFill => {
  if (!fill || fill.type === "base") {
    return { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 0 } };
  }
  // solid and gradient: incoming is SceneFill-compatible
  return options.deep ? cloneSceneFillDeep(fill.fill) : cloneSceneFill(fill.fill);
};

/**
 * Clones a RendererStrokeConfig.
 */
export const cloneRendererStrokeConfig = (
  stroke: RendererStrokeConfig | undefined,
  options: CloneRendererOptions = {}
): RendererStrokeConfig | undefined => {
  if (!stroke) {
    return undefined;
  }

  if (stroke.type === "solid") {
    return {
      type: "solid",
      width: stroke.width,
      color: cloneSceneColor(stroke.color),
    };
  }

  return {
    type: "base",
    width: stroke.width,
    brightness: stroke.brightness,
    alphaMultiplier: stroke.alphaMultiplier,
  };
};

/**
 * Clones shape-specific fields for a renderer layer.
 */
const cloneRendererLayerShape = (
  layer: PlayerUnitRendererLayerConfig,
  options: CloneRendererOptions = {}
): 
  | { shape: "polygon"; vertices: SceneVector2[] }
  | { shape: "circle"; radius: number; segments?: number }
  | { shape: "sprite"; spritePath: string; width: number; height: number } => {
  if (layer.shape === "polygon") {
    return {
      shape: "polygon" as const,
      vertices: layer.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y })),
    };
  }

  if (layer.shape === "sprite") {
    return {
      shape: "sprite" as const,
      spritePath: layer.spritePath,
      width: layer.width,
      height: layer.height,
    };
  }

  // circle
  return {
    shape: "circle" as const,
    radius: layer.radius,
    segments: layer.segments,
  };
};

/**
 * Clones a PlayerUnitRendererLayerConfig.
 */
export const cloneRendererLayer = (
  layer: PlayerUnitRendererLayerConfig,
  options: CloneRendererOptions = {}
): PlayerUnitRendererLayerConfig => {
  const shapeFields = cloneRendererLayerShape(layer, options);
  const baseFields = {
    offset: layer.offset ? { ...layer.offset } : undefined,
    fill: cloneRendererFillConfig(layer.fill, options),
    stroke: cloneRendererStrokeConfig(layer.stroke, options),
    requiresModule: layer.requiresModule,
    requiresSkill: layer.requiresSkill,
    requiresEffect: layer.requiresEffect,
    anim: layer.anim,
    groupId: layer.groupId,
  };

  if (layer.shape === "polygon") {
    return {
      ...shapeFields,
      ...baseFields,
      spine: layer.spine,
      segmentIndex: layer.segmentIndex,
      buildOpts: layer.buildOpts,
    } as PlayerUnitRendererLayerConfig;
  }

  if (layer.shape === "sprite") {
    return {
      ...shapeFields,
      ...baseFields,
    } as PlayerUnitRendererLayerConfig;
  }

  // circle
  return {
    ...shapeFields,
    ...baseFields,
  } as PlayerUnitRendererLayerConfig;
};

/**
 * Clones a PlayerUnitAuraConfig.
 */
export const cloneAuraConfig = (
  aura: PlayerUnitAuraConfig,
  options: CloneRendererOptions = {}
): PlayerUnitAuraConfig => ({
  petalCount: aura.petalCount,
  innerRadius: aura.innerRadius,
  outerRadius: aura.outerRadius,
  petalWidth: aura.petalWidth,
  rotationSpeed: aura.rotationSpeed,
  color: cloneSceneColor(aura.color),
  alpha: aura.alpha,
  requiresModule: aura.requiresModule,
  pointInward: aura.pointInward,
});

/**
 * Derives a SceneStroke from a PlayerUnitRendererConfig.
 * Used when the renderer doesn't have an explicit stroke but one can be derived from layers.
 */
export const deriveRendererStroke = (
  renderer: PlayerUnitRendererConfig,
  options: CloneRendererOptions = {}
): { color: SceneColor; width: number } | undefined => {
  if (renderer.stroke) {
    return {
      color: cloneSceneColor(renderer.stroke.color),
      width: renderer.stroke.width,
    };
  }

  for (const layer of renderer.layers) {
    const layerStroke = layer.stroke;
    if (layerStroke?.type === "solid" && layerStroke.color) {
      const width =
        typeof layerStroke.width === "number" && Number.isFinite(layerStroke.width)
          ? layerStroke.width
          : 2;
      return {
        color: cloneSceneColor(layerStroke.color),
        width,
      };
    }
  }

  return undefined;
};

/**
 * Clones a PlayerUnitRendererConfig for use in scene.
 */
export const cloneRendererConfigForScene = (
  renderer: PlayerUnitRendererConfig,
  options: CloneRendererOptions = {}
): PlayerUnitRendererConfig => {
  const strokeSource = renderer.stroke ?? deriveRendererStroke(renderer, options);
  const stroke = strokeSource
    ? {
        color: cloneSceneColor(strokeSource.color),
        width: strokeSource.width,
      }
    : undefined;

  return {
    kind: renderer.kind,
    fill: cloneSceneColor(renderer.fill),
    stroke,
    layers: renderer.layers.map((layer) => cloneRendererLayer(layer, options)),
    auras: renderer.auras
      ? renderer.auras.map((aura) => cloneAuraConfig(aura, options))
      : undefined,
  };
};
