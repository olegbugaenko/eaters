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

/**
 * Clones a SceneColor
 */
export const cloneColor = (color: SceneColor | undefined): SceneColor | undefined => {
  if (!color) {
    return undefined;
  }
  const clone: SceneColor = {
    r: color.r,
    g: color.g,
    b: color.b,
  };
  if (typeof color.a === "number" && Number.isFinite(color.a)) {
    clone.a = color.a;
  }
  return clone;
};

/**
 * Clones a SceneColor (alias for cloneColor)
 */
export const cloneSceneColor = (color: SceneColor | undefined): SceneColor | undefined => {
  if (!color) {
    return undefined;
  }
  const cloned: SceneColor = {
    r: color.r,
    g: color.g,
    b: color.b,
  };
  if (typeof color.a === "number" && Number.isFinite(color.a)) {
    cloned.a = color.a;
  }
  return cloned;
};

/**
 * Clones a SceneFill deeply
 */
export const cloneSceneFillDeep = (fill: SceneFill): SceneFill => {
  switch (fill.fillType) {
    case FILL_TYPES.SOLID: {
      const solidFill = fill as SceneSolidFill;
      const solid: SceneSolidFill = {
        fillType: FILL_TYPES.SOLID,
        color: cloneSceneColor(solidFill.color) ?? solidFill.color,
      };
      if (solidFill.noise) {
        solid.noise = { ...solidFill.noise };
      }
      return solid;
    }
    case FILL_TYPES.LINEAR_GRADIENT: {
      const linearFill = fill as SceneLinearGradientFill;
      const linear: SceneLinearGradientFill = {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: linearFill.start ? { ...linearFill.start } : undefined,
        end: linearFill.end ? { ...linearFill.end } : undefined,
        stops: linearFill.stops.map((stop) => ({
          offset: stop.offset,
          color: cloneSceneColor(stop.color) ?? stop.color,
        })),
      };
      if (linearFill.noise) {
        linear.noise = { ...linearFill.noise };
      }
      return linear;
    }
    case FILL_TYPES.RADIAL_GRADIENT: {
      const radialFill = fill as SceneRadialGradientFill;
      const radial: SceneRadialGradientFill = {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: radialFill.start ? { ...radialFill.start } : undefined,
        end: typeof radialFill.end === "number" ? radialFill.end : 0,
        stops: radialFill.stops.map((stop) => ({
          offset: stop.offset,
          color: cloneSceneColor(stop.color) ?? stop.color,
        })),
      };
      if (radialFill.noise) {
        radial.noise = { ...radialFill.noise };
      }
      return radial;
    }
    case FILL_TYPES.DIAMOND_GRADIENT: {
      const diamondFill = fill as SceneDiamondGradientFill;
      const diamond: SceneDiamondGradientFill = {
        fillType: FILL_TYPES.DIAMOND_GRADIENT,
        start: diamondFill.start ? { ...diamondFill.start } : undefined,
        end: typeof diamondFill.end === "number" ? diamondFill.end : 0,
        stops: diamondFill.stops.map((stop) => ({
          offset: stop.offset,
          color: cloneSceneColor(stop.color) ?? stop.color,
        })),
      };
      if (diamondFill.noise) {
        diamond.noise = { ...diamondFill.noise };
      }
      return diamond;
    }
    default:
      return fill;
  }
};

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
    color: cloneSceneColor(emitter.color) ?? { ...emitter.color },
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
      color: cloneSceneColor(stroke.color) ?? stroke.color,
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
      color: cloneSceneColor(fill.color) ?? fill.color,
      ...(fill.noise ? { noise: { ...fill.noise } } : {}),
    };
  }
  if (fill.type === "gradient") {
    const gradient = fill.fill;
    if (gradient.fillType === FILL_TYPES.SOLID) {
      const solidFill = gradient as SceneSolidFill;
      return {
        type: "gradient",
        fill: {
          fillType: solidFill.fillType,
          color: cloneSceneColor(solidFill.color) ?? solidFill.color,
          ...(solidFill.noise ? { noise: { ...solidFill.noise } } : {}),
        },
      };
    }
    if (gradient.fillType === FILL_TYPES.LINEAR_GRADIENT) {
      const linearGradient = gradient as SceneLinearGradientFill;
      return {
        type: "gradient",
        fill: {
          fillType: linearGradient.fillType,
          start: linearGradient.start ? { ...linearGradient.start } : undefined,
          end: linearGradient.end ? { ...linearGradient.end } : undefined,
          stops: linearGradient.stops.map((stop) => ({
            offset: stop.offset,
            color: cloneSceneColor(stop.color) ?? stop.color,
          })),
          ...(linearGradient.noise ? { noise: { ...linearGradient.noise } } : {}),
        },
      };
    }
    if (
      gradient.fillType === FILL_TYPES.RADIAL_GRADIENT ||
      gradient.fillType === FILL_TYPES.DIAMOND_GRADIENT
    ) {
      const radialOrDiamondFill = gradient as SceneRadialGradientFill | SceneDiamondGradientFill;
      return {
        type: "gradient",
        fill: {
          fillType: radialOrDiamondFill.fillType,
          start: radialOrDiamondFill.start ? { ...radialOrDiamondFill.start } : undefined,
          end: typeof radialOrDiamondFill.end === "number" ? radialOrDiamondFill.end : undefined,
          stops: radialOrDiamondFill.stops.map((stop) => ({
            offset: stop.offset,
            color: cloneSceneColor(stop.color) ?? stop.color,
          })),
          ...(radialOrDiamondFill.noise ? { noise: { ...radialOrDiamondFill.noise } } : {}),
        },
      };
    }
    return {
      type: "gradient",
      fill: cloneSceneFillDeep(gradient),
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
      requiresModule: (layer as any).requiresModule,
      requiresSkill: (layer as any).requiresSkill,
      requiresEffect: (layer as any).requiresEffect,
      anim: (layer as any).anim,
      spine: (layer as any).spine,
      segmentIndex: (layer as any).segmentIndex,
      buildOpts: (layer as any).buildOpts,
      groupId: (layer as any).groupId,
    };
  }
  return {
    shape: "circle",
    radius: layer.radius,
    segments: layer.segments,
    offset: layer.offset ? { ...layer.offset } : undefined,
    fill: cloneRendererFillConfig(layer.fill),
    stroke: cloneRendererStrokeConfig(layer.stroke),
    requiresModule: (layer as any).requiresModule,
    requiresSkill: (layer as any).requiresSkill,
    requiresEffect: (layer as any).requiresEffect,
    anim: (layer as any).anim,
    groupId: (layer as any).groupId,
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
  color: cloneSceneColor(aura.color) ?? aura.color,
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
      color: cloneColor(renderer.stroke.color) ?? renderer.stroke.color,
      width: renderer.stroke.width,
    };
  }

  for (const layer of renderer.layers) {
    const layerStroke = (layer as any)?.stroke as
      | { type?: string; color?: SceneColor; width?: number }
      | undefined;
    if (layerStroke?.type === "solid" && layerStroke.color) {
      const width =
        typeof layerStroke.width === "number" && Number.isFinite(layerStroke.width)
          ? layerStroke.width
          : 2;
      return {
        color: cloneColor(layerStroke.color) ?? layerStroke.color,
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
        color: cloneSceneColor(strokeSource.color) ?? strokeSource.color,
        width: strokeSource.width,
      }
    : undefined;

  return {
    kind: renderer.kind,
    fill: cloneSceneColor(renderer.fill) ?? { ...renderer.fill },
    stroke,
    layers: renderer.layers.map((layer) => cloneRendererLayer(layer)),
    auras: renderer.auras ? renderer.auras.map((aura) => cloneAuraConfig(aura)) : undefined,
  };
};
