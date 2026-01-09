import type { SceneObjectInstance, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { isVector, sanitizeOffset } from "@shared/helpers/vector.helper";
import { DEFAULT_VERTICES } from "./constants";
import type { PolygonCustomData } from "./types";

/**
 * Normalizes vertices array, filtering invalid entries and falling back to default
 */
export const normalizeVertices = (vertices: SceneVector2[] | undefined): SceneVector2[] => {
  if (!Array.isArray(vertices)) {
    return DEFAULT_VERTICES.map((vertex) => ({ ...vertex }));
  }
  const sanitized = vertices
    .filter((vertex) => isVector(vertex))
    .map((vertex) => ({ x: vertex.x, y: vertex.y }));
  if (sanitized.length < 3) {
    return DEFAULT_VERTICES.map((vertex) => ({ ...vertex }));
  }
  return sanitized;
};

// sanitizeOffset is now imported directly from @shared/helpers/vector.helper

/**
 * Extracts and sanitizes custom data from instance
 */
export const extractCustomData = (
  instance: SceneObjectInstance
): { vertices: SceneVector2[]; offset?: SceneVector2 } => {
  const payload = instance.data.customData as PolygonCustomData | undefined;
  if (!payload || typeof payload !== "object") {
    return { vertices: DEFAULT_VERTICES.map((vertex) => ({ ...vertex })) };
  }
  return {
    vertices: normalizeVertices(payload.vertices),
    offset: sanitizeOffset(payload.offset),
  };
};
