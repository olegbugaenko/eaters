import type {
  SceneColor,
  SceneVector2,
  SceneFill,
  SceneFillNoise,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type {
  PlayerUnitRendererConfig,
  PlayerUnitRendererLayerConfig,
  PlayerUnitAuraConfig,
} from "@db/player-units-db";
import type { UnitModuleId } from "@db/unit-modules-db";
import type { SkillId } from "@db/skills-db";
import type { ParticleEmitterConfig } from "@logic/interfaces/visuals/particle-emitters-config";
import type { ParticleEmitterBaseConfig } from "../../../primitives/ParticleEmitterPrimitive";
import type { RendererLayerAnimationConfig, ExtendedRendererLayerFields } from "@shared/types/renderer.types";

export interface PlayerUnitRendererLegacyPayload {
  kind?: string;
  vertices?: SceneVector2[];
  offset?: SceneVector2;
}

export interface PlayerUnitCustomData {
  renderer?: PlayerUnitRendererConfig | PlayerUnitRendererLegacyPayload;
  emitter?: ParticleEmitterConfig;
  physicalSize?: number;
  baseFillColor?: SceneColor;
  baseStrokeColor?: SceneColor;
  modules?: UnitModuleId[];
  skills?: SkillId[];
  effects?: string[];
}

export interface PlayerUnitEmitterRenderConfig extends ParticleEmitterBaseConfig {
  baseSpeed: number;
  speedVariation: number;
  spread: number;
  physicalSize: number;
}

export interface CompositeRendererData {
  kind: "composite";
  baseFillColor: SceneColor;
  baseStrokeColor?: SceneColor;
  layers: RendererLayer[];
  auras?: readonly PlayerUnitAuraConfig[];
}

export interface PolygonRendererData {
  kind: "polygon";
  vertices: SceneVector2[];
  offset?: SceneVector2;
}

export type RendererData = CompositeRendererData | PolygonRendererData;

/**
 * Runtime layer base fields.
 * Note: fill is required (not optional) in runtime, unlike in config types.
 */
export interface RendererLayerBase extends Omit<ExtendedRendererLayerFields, "fill" | "stroke" | "anim"> {
  fill: RendererLayerFill;
  stroke?: RendererLayerStroke;
  anim?: RendererLayerAnimationConfig;
}

export interface RendererPolygonLayer extends RendererLayerBase {
  shape: "polygon";
  vertices: SceneVector2[];
}

export interface RendererCircleLayer extends RendererLayerBase {
  shape: "circle";
  radius: number;
  segments: number;
}

export interface RendererSpriteLayer extends RendererLayerBase {
  shape: "sprite";
  spritePath: string;
  width: number;
  height: number;
}

export type RendererLayer = RendererPolygonLayer | RendererCircleLayer | RendererSpriteLayer;

export interface RendererLayerFillBase {
  kind: "base";
  brightness: number;
  alphaMultiplier: number;
}

export interface RendererLayerFillSolid {
  kind: "solid";
  color: SceneColor;
  noise?: SceneFillNoise;
}

export interface RendererLayerFillGradient {
  kind: "gradient";
  fill: SceneFill;
}

export type RendererLayerFill =
  | RendererLayerFillBase
  | RendererLayerFillSolid
  | RendererLayerFillGradient;

export interface RendererLayerStrokeBase {
  kind: "base";
  width: number;
  brightness: number;
  alphaMultiplier: number;
}

export interface RendererLayerStrokeSolid {
  kind: "solid";
  width: number;
  color: SceneColor;
}

export type RendererLayerStroke = RendererLayerStrokeBase | RendererLayerStrokeSolid;

export type { PlayerUnitRendererConfig, PlayerUnitRendererLayerConfig, PlayerUnitAuraConfig };
export type { RendererFillConfig, RendererStrokeConfig } from "@shared/types/renderer-config";
