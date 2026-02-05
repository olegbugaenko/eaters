/**
 * Animation Types
 * 
 * Unified interfaces for GPU and CPU animation systems.
 * These types are designed to be compatible with existing implementations
 * while providing a common foundation for future unification.
 */

import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

// ============================================================================
// Base Animation Parameters
// ============================================================================

/**
 * Core animation parameters shared by all animation types.
 * These are the minimum required fields for any animation.
 */
export interface BaseAnimationParams {
  /** Current time in milliseconds */
  timeMs: number;
  /** Animation period in milliseconds */
  periodMs: number;
  /** Phase offset (radians) */
  phase: number;
  /** Animation amplitude (world units or percentage depending on type) */
  amplitude: number;
}

/**
 * Transform parameters for positioned animations.
 * Used when animation needs world-space positioning.
 */
export interface AnimationTransformParams {
  /** World-space origin for the animation */
  origin: SceneVector2;
  /** Rotation in radians */
  rotation: number;
}

// ============================================================================
// Specialized Animation Parameters
// ============================================================================

/**
 * Parameters for spine-based animations (tentacles, etc.).
 * Extends base with transform for world positioning.
 */
export interface SpineAnimParams extends BaseAnimationParams, AnimationTransformParams {}

/**
 * Parameters for polygon sway/pulse animations.
 * Extends base with additional control over animation behavior.
 */
export interface PolygonAnimParams extends BaseAnimationParams, AnimationTransformParams {
  /** Amplitude as percentage of distance (or -1 to use amplitude) */
  amplitudePercent: number;
  /** Phase step between vertices for sway effect */
  phaseStep: number;
  /** Animation type: 0 = sway, 1 = pulse */
  animType: number;
  /** Axis type: 0 = normal, 1 = tangent, 2 = movement */
  axisType: number;
  /** Whether to use per-vertex phase */
  useVertexPhase: number;
  /** Center point for normal calculation */
  center: SceneVector2;
  /** Normalized movement direction for movement-based animations */
  movementDir: SceneVector2;
}

// ============================================================================
// Animation Controller Interface
// ============================================================================

/**
 * Read-only view of animation parameters.
 * Used for querying current animation state without modification.
 */
export interface AnimationParamsView extends BaseAnimationParams {
  readonly origin?: SceneVector2;
  readonly rotation?: number;
}

/**
 * Mutable animation params for runtime updates.
 * Used by primitives to update animation state each frame.
 */
export interface MutableAnimationParams extends BaseAnimationParams {
  origin: SceneVector2;
  rotation: number;
}

/**
 * Factory function signature for creating animation params with defaults.
 */
export type CreateAnimationParams<T extends BaseAnimationParams> = (
  overrides?: Partial<T>
) => T;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create default base animation parameters.
 */
export const createBaseAnimationParams = (
  overrides?: Partial<BaseAnimationParams>
): BaseAnimationParams => ({
  timeMs: 0,
  periodMs: 1500,
  phase: 0,
  amplitude: 0,
  ...overrides,
});

/**
 * Create default spine animation parameters.
 */
export const createSpineAnimParams = (
  overrides?: Partial<SpineAnimParams>
): SpineAnimParams => ({
  timeMs: 0,
  periodMs: 1400,
  phase: 0,
  amplitude: 1,
  origin: { x: 0, y: 0 },
  rotation: 0,
  ...overrides,
});

/**
 * Create default polygon animation parameters.
 */
export const createPolygonAnimParams = (
  overrides?: Partial<PolygonAnimParams>
): PolygonAnimParams => ({
  timeMs: 0,
  periodMs: 1500,
  phase: 0,
  amplitude: 6,
  amplitudePercent: -1,
  phaseStep: 0.3,
  animType: 0,
  axisType: 0,
  useVertexPhase: 0,
  center: { x: 0, y: 0 },
  origin: { x: 0, y: 0 },
  rotation: 0,
  movementDir: { x: 1, y: 0 },
  ...overrides,
});

// ============================================================================
// Config to Params Converters
// ============================================================================

/**
 * Animation config from RendererLayerAnimationConfig.
 * This is the static configuration that describes an animation.
 */
export interface AnimationConfig {
  type?: "sway" | "pulse";
  periodMs?: number;
  amplitude?: number;
  amplitudePercentage?: number;
  phase?: number;
  falloff?: "tip" | "root" | "none";
  axis?: "normal" | "tangent" | "movement-normal" | "movement-tangent";
}

/**
 * Convert animation config to spine animation params.
 */
export const configToSpineParams = (
  config: AnimationConfig,
  overrides?: Partial<SpineAnimParams>
): SpineAnimParams => ({
  timeMs: 0,
  periodMs: Math.max(config.periodMs ?? 1400, 1),
  phase: config.phase ?? 0,
  amplitude: config.amplitude ?? 1,
  origin: { x: 0, y: 0 },
  rotation: 0,
  ...overrides,
});

/**
 * Resolve axis type from axis string.
 * Returns: 0 = normal, 1 = tangent, 2 = movement-tangent, 3 = movement-normal
 */
export const resolveAxisType = (axis: AnimationConfig["axis"]): number => {
  switch (axis) {
    case "tangent":
      return 1;
    case "movement-tangent":
      return 2;
    case "movement-normal":
      return 3;
    default:
      return 0; // normal
  }
};

/**
 * Convert animation config to polygon animation params.
 */
export const configToPolygonParams = (
  config: AnimationConfig,
  options?: {
    phaseStep?: number;
  }
): PolygonAnimParams => {
  const axis = config.axis ?? "normal";
  const axisType = resolveAxisType(axis);
  const isMovementAxis = axisType === 2 || axisType === 3;
  
  const animType = config.type === "pulse" ? 1 : 0;
  const useVertexPhase = config.type === "sway" && !isMovementAxis ? 1 : 0;
  
  const amplitudePercent =
    typeof config.amplitudePercentage === "number" && Number.isFinite(config.amplitudePercentage)
      ? config.amplitudePercentage
      : -1;

  return {
    timeMs: 0,
    periodMs: Math.max(config.periodMs ?? 1500, 1),
    phase: config.phase ?? 0,
    amplitude: config.amplitude ?? 6,
    amplitudePercent,
    phaseStep: options?.phaseStep ?? 0.3,
    animType,
    axisType,
    useVertexPhase,
    center: { x: 0, y: 0 },
    origin: { x: 0, y: 0 },
    rotation: 0,
    movementDir: { x: 1, y: 0 },
  };
};
