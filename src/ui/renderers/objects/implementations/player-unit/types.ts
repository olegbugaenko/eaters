import type {
  SceneColor,
  SceneVector2,
  SceneFill,
  SceneFillNoise,
  SceneFillFilaments,
  SceneStroke,
  SceneSolidFill,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import type {
  PlayerUnitRendererConfig,
  PlayerUnitRendererLayerConfig,
  PlayerUnitRendererFillConfig,
  PlayerUnitRendererStrokeConfig,
  PlayerUnitAuraConfig,
} from "../../../../../db/player-units-db";
import type { UnitModuleId } from "../../../../../db/unit-modules-db";
import type { SkillId } from "../../../../../db/skills-db";
import type { ParticleEmitterConfig } from "../../../../../logic/interfaces/visuals/particle-emitters-config";
import type { ParticleEmitterBaseConfig } from "../../../primitives/ParticleEmitterPrimitive";

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

export interface RendererLayerBase {
  offset?: SceneVector2;
  fill: RendererLayerFill;
  stroke?: RendererLayerStroke;
  requiresModule?: UnitModuleId;
  requiresSkill?: SkillId;
  requiresEffect?: string;
  anim?: {
    type: "sway" | "pulse";
    periodMs?: number;
    amplitude?: number;
    amplitudePercentage?: number;
    phase?: number;
    falloff?: "tip" | "root" | "none";
    axis?: "normal" | "tangent" | "movement-normal" | "movement-tangent";
  };
  spine?: Array<{ x: number; y: number; width: number }>;
  segmentIndex?: number;
  buildOpts?: { epsilon?: number; minSegmentLength?: number; winding?: "CW" | "CCW" };
  groupId?: string;
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

export type RendererLayer = RendererPolygonLayer | RendererCircleLayer;

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
