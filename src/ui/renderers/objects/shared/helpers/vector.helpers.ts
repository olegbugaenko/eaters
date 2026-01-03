import type { SceneVector2 } from "@/logic/services/scene-object-manager/scene-object-manager.types";

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
 * Sanitizes an array of vertices, filtering out invalid entries
 */
export const sanitizeVertices = (
  vertices: readonly SceneVector2[] | undefined
): SceneVector2[] => {
  if (!Array.isArray(vertices)) {
    return [];
  }
  const out: SceneVector2[] = [];
  vertices.forEach((v) => {
    if (v && typeof v.x === "number" && typeof v.y === "number") {
      out.push({ x: v.x, y: v.y });
    }
  });
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
