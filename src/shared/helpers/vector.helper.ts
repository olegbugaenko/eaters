import type { SceneVector2 } from "@/logic/services/scene-object-manager/scene-object-manager.types";

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

/**
 * Type guard to check if a value is a valid SceneVector2
 */
export const isVector = (value: unknown): value is SceneVector2 =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as SceneVector2).x === "number" &&
  typeof (value as SceneVector2).y === "number";

/**
 * Computes the center point (bounding box center) of an array of vertices
 */
export const computeCenter = (vertices: SceneVector2[]): SceneVector2 => {
  if (vertices.length === 0) {
    return { x: 0, y: 0 };
  }

  let minX = vertices[0]!.x;
  let maxX = vertices[0]!.x;
  let minY = vertices[0]!.y;
  let maxY = vertices[0]!.y;

  for (let i = 1; i < vertices.length; i += 1) {
    const vertex = vertices[i]!;
    if (vertex.x < minX) {
      minX = vertex.x;
    } else if (vertex.x > maxX) {
      maxX = vertex.x;
    }
    if (vertex.y < minY) {
      minY = vertex.y;
    } else if (vertex.y > maxY) {
      maxY = vertex.y;
    }
  }

  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
};

/**
 * Sanitizes an array of vertices, filtering out invalid entries.
 * @param vertices - Array of vertices to sanitize
 * @param fallback - Optional fallback vertices to return if result is invalid or has too few vertices
 * @param minVertices - Minimum number of vertices required (default: 0). If result has fewer, fallback is used.
 * @returns Sanitized array of vertices, or fallback if provided and conditions not met
 */
export const sanitizeVertices = (
  vertices: readonly SceneVector2[] | undefined,
  fallback?: readonly SceneVector2[],
  minVertices = 0
): SceneVector2[] => {
  if (!Array.isArray(vertices)) {
    if (fallback) {
      return fallback.map((vertex) => ({ ...vertex }));
    }
    return [];
  }
  const out: SceneVector2[] = [];
  vertices.forEach((v) => {
    if (v && typeof v.x === "number" && typeof v.y === "number") {
      out.push({ x: v.x, y: v.y });
    }
  });
  
  if (minVertices > 0 && out.length < minVertices && fallback) {
    return fallback.map((vertex) => ({ ...vertex }));
  }
  
  return out;
};

/**
 * Sanitizes an offset vector
 */
export const sanitizeOffset = (offset: SceneVector2 | undefined): SceneVector2 | undefined => {
  if (!offset || !isVector(offset)) {
    return undefined;
  }
  return { x: offset.x, y: offset.y };
};
