import {
  SceneColor,
  SceneFill,
  SceneSolidFill,
  SceneLinearGradientFill,
  SceneRadialGradientFill,
  SceneDiamondGradientFill,
  SceneFillNoise,
  SceneGradientStop,
  SceneStroke,
} from "@logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import { cloneSceneColor } from "@shared/helpers/scene-color.helper";
import { cloneSceneFillDeep, cloneSceneFillNoise, cloneSceneFillFilaments } from "@shared/helpers/scene-fill.helper";
import { getBrickConfig } from "@db/bricks-db";
import type { ParticleEmitterConfig } from "@logic/interfaces/visuals/particle-emitters-config";
import {
  PlayerUnitRendererConfig,
  PlayerUnitRendererLayerConfig,
  PlayerUnitRendererStrokeConfig,
  PlayerUnitAuraConfig,
} from "@db/player-units-db";

/**
 * Clones noise configuration
 */
export const cloneNoise = (noise: SceneFillNoise | undefined): SceneFillNoise | undefined =>
  noise ? { ...noise } : undefined;

/**
 * Clones gradient stops array
 */
export const cloneStops = (stops: readonly SceneGradientStop[]): SceneGradientStop[] =>
  stops.map((stop) => ({ offset: stop.offset, color: { ...stop.color } }));

/**
 * Creates a SceneFill from brick config
 */
export const createBrickFill = (config: ReturnType<typeof getBrickConfig>): SceneFill => {
  const fill = config.fill;
  switch (fill.type) {
    case "solid":
      return {
        fillType: FILL_TYPES.SOLID,
        color: { ...fill.color },
        ...(fill.noise ? { noise: cloneNoise(fill.noise) } : {}),
      };
    case "radial":
      return {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: fill.center ? { ...fill.center } : undefined,
        end: fill.radius,
        stops: cloneStops(fill.stops),
        ...(fill.noise ? { noise: cloneNoise(fill.noise) } : {}),
      };
    case "linear":
    default:
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end ? { ...fill.end } : undefined,
        stops: cloneStops(fill.stops),
        ...(fill.noise ? { noise: cloneNoise(fill.noise) } : {}),
      };
  }
};


// cloneSceneFillDeep is now imported from @shared/helpers/scene-fill.helper

/**
 * Clones a ParticleEmitterConfig
 */
export const cloneEmitterConfig = (
  emitter: ParticleEmitterConfig | undefined
): ParticleEmitterConfig | undefined => {
  if (!emitter) {
    return undefined;
  }

  return {
    particlesPerSecond: emitter.particlesPerSecond,
    particleLifetimeMs: emitter.particleLifetimeMs,
    fadeStartMs: emitter.fadeStartMs,
    baseSpeed: emitter.baseSpeed,
    speedVariation: emitter.speedVariation,
    sizeRange: { min: emitter.sizeRange.min, max: emitter.sizeRange.max },
    spread: emitter.spread,
    offset: emitter.offset ? { x: emitter.offset.x, y: emitter.offset.y } : { x: 0, y: 0 },
    color: cloneSceneColor(emitter.color),
    fill: emitter.fill ? cloneSceneFillDeep(emitter.fill) : undefined,
    shape: emitter.shape,
    maxParticles: emitter.maxParticles,
  };
};

/**
 * Clones a PlayerUnitRendererStrokeConfig
 */
export const cloneRendererStrokeConfig = (
  stroke: PlayerUnitRendererStrokeConfig | undefined
): PlayerUnitRendererStrokeConfig | undefined => {
  if (!stroke) {
    return undefined;
  }
  if (stroke.type === "solid") {
    return {
      type: "solid",
      width: stroke.width,
      color: stroke.color ? cloneSceneColor(stroke.color) : stroke.color,
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
 * Clones a PlayerUnitRendererLayerConfig fill
 */
export const cloneRendererFillConfig = (
  fill: PlayerUnitRendererLayerConfig["fill"] | undefined
): PlayerUnitRendererLayerConfig["fill"] | undefined => {
  if (!fill) {
    return undefined;
  }
  if (fill.type === "solid") {
    return {
      type: "solid",
      color: fill.color ? cloneSceneColor(fill.color) : fill.color,
      ...(fill.noise ? { noise: cloneSceneFillNoise(fill.noise) } : {}),
    };
  }
  if (fill.type === "gradient") {
    // Use cloneSceneFillDeep for all gradient types - it handles all cases correctly
    return {
      type: "gradient",
      fill: cloneSceneFillDeep(fill.fill),
    };
  }
  return {
    type: "base",
    brightness: fill.brightness,
    alphaMultiplier: fill.alphaMultiplier,
  };
};

/**
 * Clones a PlayerUnitRendererLayerConfig
 */
export const cloneRendererLayer = (
  layer: PlayerUnitRendererLayerConfig
): PlayerUnitRendererLayerConfig => {
  if (layer.shape === "polygon") {
    return {
      shape: "polygon",
      vertices: layer.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y })),
      offset: layer.offset ? { ...layer.offset } : undefined,
      fill: cloneRendererFillConfig(layer.fill),
      stroke: cloneRendererStrokeConfig(layer.stroke),
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
  return {
    shape: "circle",
    radius: layer.radius,
    segments: layer.segments,
    offset: layer.offset ? { ...layer.offset } : undefined,
    fill: cloneRendererFillConfig(layer.fill),
    stroke: cloneRendererStrokeConfig(layer.stroke),
    requiresModule: layer.requiresModule,
    requiresSkill: layer.requiresSkill,
    requiresEffect: layer.requiresEffect,
    anim: layer.anim,
    groupId: layer.groupId,
  };
};

/**
 * Clones a PlayerUnitAuraConfig
 */
export const cloneAuraConfig = (
  aura: PlayerUnitAuraConfig
): PlayerUnitAuraConfig => ({
  petalCount: aura.petalCount,
  innerRadius: aura.innerRadius,
  outerRadius: aura.outerRadius,
  petalWidth: aura.petalWidth,
  rotationSpeed: aura.rotationSpeed,
  color: aura.color ? cloneSceneColor(aura.color) : aura.color,
  alpha: aura.alpha,
  requiresModule: aura.requiresModule,
  pointInward: aura.pointInward,
});

/**
 * Derives a SceneStroke from a PlayerUnitRendererConfig
 */
export const deriveRendererStroke = (
  renderer: PlayerUnitRendererConfig
): SceneStroke | undefined => {
  if (renderer.stroke) {
    return {
      color: renderer.stroke.color ? cloneSceneColor(renderer.stroke.color) : renderer.stroke.color,
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
        color: layerStroke.color ? cloneSceneColor(layerStroke.color) : layerStroke.color,
        width,
      };
    }
  }

  return undefined;
};

/**
 * Clones a PlayerUnitRendererConfig for use in scene
 */
export const cloneRendererConfigForScene = (
  renderer: PlayerUnitRendererConfig
): PlayerUnitRendererConfig => {
  const strokeSource = renderer.stroke ?? deriveRendererStroke(renderer);
  const stroke = strokeSource
    ? {
        color: strokeSource.color ? cloneSceneColor(strokeSource.color) : strokeSource.color,
        width: strokeSource.width,
      }
    : undefined;

  return {
    kind: renderer.kind,
    fill: cloneSceneColor(renderer.fill),
    stroke,
    layers: renderer.layers.map((layer) => cloneRendererLayer(layer)),
    auras: renderer.auras ? renderer.auras.map((aura) => cloneAuraConfig(aura)) : undefined,
  };
};
