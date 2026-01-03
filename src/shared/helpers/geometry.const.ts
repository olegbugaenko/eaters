import type { SceneVector2 } from "../../logic/services/scene-object-manager/scene-object-manager.types";

/**
 * Tau constant (2 * PI).
 * Represents a full rotation in radians.
 */
export const TAU = Math.PI * 2;

/**
 * Zero vector constant.
 * Used as a default/fallback for SceneVector2 operations.
 */
export const ZERO_VECTOR: SceneVector2 = { x: 0, y: 0 };
