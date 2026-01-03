import type { SceneVector2 } from "../../logic/services/scene-object-manager/scene-object-manager.types";

/**
 * Creates a shallow copy of a 2D vector.
 */
export const cloneVector = (vector: SceneVector2): SceneVector2 => ({
  x: vector.x,
  y: vector.y,
});

/**
 * Adds two 2D vectors component-wise.
 */
export const addVectors = (a: SceneVector2, b: SceneVector2): SceneVector2 => ({
  x: a.x + b.x,
  y: a.y + b.y,
});

/**
 * Subtracts vector b from vector a component-wise.
 */
export const subtractVectors = (a: SceneVector2, b: SceneVector2): SceneVector2 => ({
  x: a.x - b.x,
  y: a.y - b.y,
});

/**
 * Multiplies a vector by a scalar value.
 */
export const scaleVector = (vector: SceneVector2, scalar: number): SceneVector2 => ({
  x: vector.x * scalar,
  y: vector.y * scalar,
});

/**
 * Calculates the Euclidean length (magnitude) of a vector.
 */
export const vectorLength = (vector: SceneVector2): number => Math.hypot(vector.x, vector.y);

/**
 * Checks if a vector has non-zero length (within epsilon tolerance).
 */
export const vectorHasLength = (vector: SceneVector2, epsilon = 0.0001): boolean =>
  Math.abs(vector.x) > epsilon || Math.abs(vector.y) > epsilon;

/**
 * Checks if two vectors are approximately equal (within epsilon tolerance).
 */
export const vectorEquals = (a: SceneVector2, b: SceneVector2, epsilon = 0.0001): boolean =>
  Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;

/**
 * Normalizes a vector to unit length. Returns null if the vector has zero or near-zero length.
 */
export const normalizeVector = (vector: SceneVector2): SceneVector2 | null => {
  const length = vectorLength(vector);
  if (length <= 0.0001) {
    return null;
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
};
