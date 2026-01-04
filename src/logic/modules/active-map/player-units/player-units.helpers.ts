import { cloneSceneFill } from "../../../helpers/scene-fill.helper";
import { cloneParticleEmitterConfig } from "../../../helpers/particle-emitter.helper";
import type { ParticleEmitterConfig } from "../../../interfaces/visuals/particle-emitters-config";
import {
  PlayerUnitType,
  isPlayerUnitType,
  PlayerUnitRendererConfig,
  PlayerUnitRendererLayerConfig,
  PlayerUnitRendererFillConfig,
  PlayerUnitRendererStrokeConfig,
} from "../../../../db/player-units-db";
import { PlayerUnitRuntimeModifiers } from "../../../../types/player-units";

/**
 * Sanitizes runtime modifiers for player units.
 */
export const sanitizeRuntimeModifiers = (
  modifiers: PlayerUnitRuntimeModifiers | undefined
): PlayerUnitRuntimeModifiers => ({
  rewardMultiplier: Math.max(modifiers?.rewardMultiplier ?? 1, 0),
  damageTransferPercent: Math.max(modifiers?.damageTransferPercent ?? 0, 0),
  damageTransferRadius: Math.max(modifiers?.damageTransferRadius ?? 0, 0),
  attackStackBonusPerHit: Math.max(modifiers?.attackStackBonusPerHit ?? 0, 0),
  attackStackBonusCap: Math.max(modifiers?.attackStackBonusCap ?? 0, 0),
});

/**
 * Sanitizes a player unit type, returning default if invalid.
 */
export const sanitizeUnitType = (value: PlayerUnitType | undefined): PlayerUnitType => {
  if (isPlayerUnitType(value)) {
    return value;
  }
  return "bluePentagon";
};

/**
 * Clones a player unit emitter configuration.
 */
export const cloneEmitter = (
  config: ParticleEmitterConfig
): ParticleEmitterConfig => cloneParticleEmitterConfig(config);

/**
 * Clones a player unit renderer configuration for scene objects.
 */
export const cloneRendererConfigForScene = (
  renderer: PlayerUnitRendererConfig
): PlayerUnitRendererConfig => ({
  kind: renderer.kind,
  fill: { ...renderer.fill },
  stroke: renderer.stroke
    ? {
        color: { ...renderer.stroke.color },
        width: renderer.stroke.width,
      }
    : undefined,
  layers: renderer.layers.map((layer: PlayerUnitRendererLayerConfig) => cloneRendererLayer(layer)),
});

/**
 * Clones a player unit renderer layer configuration.
 */
export const cloneRendererLayer = (
  layer: PlayerUnitRendererLayerConfig
): PlayerUnitRendererLayerConfig => {
  if (layer.shape === "polygon") {
    return {
      shape: "polygon",
      vertices: layer.vertices.map((vertex: { x: number; y: number }) => ({ x: vertex.x, y: vertex.y })),
      offset: layer.offset ? { ...layer.offset } : undefined,
      fill: cloneRendererFill(layer.fill),
      stroke: cloneRendererStroke(layer.stroke),
      // preserve conditional visibility flags
      requiresModule: (layer as any).requiresModule,
      requiresSkill: (layer as any).requiresSkill,
      requiresEffect: (layer as any).requiresEffect,
      // animation/meta
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
    fill: cloneRendererFill(layer.fill),
    stroke: cloneRendererStroke(layer.stroke),
    // preserve conditional visibility flags
    requiresModule: (layer as any).requiresModule,
    requiresSkill: (layer as any).requiresSkill,
    requiresEffect: (layer as any).requiresEffect,
    // animation/meta
    anim: (layer as any).anim,
    groupId: (layer as any).groupId,
  };
};

/**
 * Clones a player unit renderer fill configuration.
 */
export const cloneRendererFill = (
  fill: PlayerUnitRendererFillConfig | undefined
): PlayerUnitRendererFillConfig | undefined => {
  if (!fill) {
    return undefined;
  }
  if (fill.type === "solid") {
    return {
      type: "solid",
      color: { ...fill.color },
      ...(fill.noise ? { noise: { ...fill.noise } } : {}),
      ...(fill.filaments ? { filaments: { ...fill.filaments } } : {}),
    };
  }
  if (fill.type === "gradient") {
    return { type: "gradient", fill: cloneSceneFill(fill.fill) };
  }
  return {
    type: "base",
    brightness: fill.brightness,
    alphaMultiplier: fill.alphaMultiplier,
  };
};

/**
 * Clones a player unit renderer stroke configuration.
 */
export const cloneRendererStroke = (
  stroke: PlayerUnitRendererStrokeConfig | undefined
): PlayerUnitRendererStrokeConfig | undefined => {
  if (!stroke) {
    return undefined;
  }
  if (stroke.type === "solid") {
    return {
      type: "solid",
      width: stroke.width,
      color: { ...stroke.color },
    };
  }
  return {
    type: "base",
    width: stroke.width,
    brightness: stroke.brightness,
    alphaMultiplier: stroke.alphaMultiplier,
  };
};
