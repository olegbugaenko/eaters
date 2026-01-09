import type {
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { UnitModuleId } from "@db/unit-modules-db";
import type { SkillId } from "@db/skills-db";
import type { RendererFillConfig, RendererStrokeConfig } from "./renderer-config";

/**
 * Animation configuration for renderer layers.
 * Supports different animation types with various parameters.
 */
export interface RendererLayerAnimationConfig {
  type: "sway" | "pulse";
  periodMs?: number;
  amplitude?: number; // absolute displacement in world units
  amplitudePercentage?: number; // optional: fraction of perpendicular distance to axis
  phase?: number;
  falloff?: "tip" | "root" | "none";
  axis?: "normal" | "tangent" | "movement-normal" | "movement-tangent";
}

/**
 * Base fields shared by all renderer layer configurations.
 */
export interface BaseRendererLayerFields {
  offset?: SceneVector2;
  fill?: RendererFillConfig;
  stroke?: RendererStrokeConfig;
  requiresModule?: UnitModuleId;
  requiresSkill?: SkillId;
  requiresEffect?: string;
  anim?: RendererLayerAnimationConfig;
  groupId?: string;
}

/**
 * Extended base fields for polygon layers (includes tentacle-specific metadata).
 */
export interface ExtendedRendererLayerFields extends BaseRendererLayerFields {
  // Meta for line-based shapes (tentacles): original spine and builder opts
  spine?: { x: number; y: number; width: number }[];
  segmentIndex?: number;
  buildOpts?: { epsilon?: number; minSegmentLength?: number; winding?: "CW" | "CCW" };
}

/**
 * Base type for renderer layer shape configurations.
 * Uses generics to allow different sets of additional fields.
 */
export type BaseRendererLayerConfig<TFields extends BaseRendererLayerFields = BaseRendererLayerFields> =
  | ({
      shape: "polygon";
      vertices: readonly SceneVector2[];
    } & TFields)
  | ({
      shape: "circle";
      radius: number;
      segments?: number;
    } & TFields)
  | ({
      shape: "sprite";
      spritePath: string;
      width: number;
      height: number;
    } & TFields);

/**
 * Generic composite renderer configuration.
 * Can be specialized for different use cases (player units, auras, etc.).
 */
export interface RendererCompositeConfig<TLayer> {
  kind: "composite";
  layers: readonly TLayer[];
}
