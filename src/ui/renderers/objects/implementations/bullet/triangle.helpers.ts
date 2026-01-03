import type { SceneObjectInstance, SceneVector2 } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { getBulletRadius } from "./helpers";

// Cache for triangle vertices
const triangleVerticesCache = new WeakMap<
  SceneObjectInstance,
  { radius: number; vertices: [SceneVector2, SceneVector2, SceneVector2] }
>();

/**
 * Creates triangle vertices for sprite shape (with caching)
 */
export const createTriangleVertices = (
  instance: SceneObjectInstance
): [SceneVector2, SceneVector2, SceneVector2] => {
  const radius = getBulletRadius(instance);

  // OPTIMIZATION: Cache vertices to avoid creating new objects every frame
  const cached = triangleVerticesCache.get(instance);
  if (cached && cached.radius === radius) {
    return cached.vertices;
  }

  // Трикутник, спрямований вершиною вперед (у напрямку руху)
  // Вершина вперед
  const tip = { x: radius * 2, y: 0 };
  // Дві задні вершини
  const baseLeft = { x: -radius * 0.6, y: radius * 0.8 };
  const baseRight = { x: -radius * 0.6, y: -radius * 0.8 };
  const vertices: [SceneVector2, SceneVector2, SceneVector2] = [tip, baseLeft, baseRight];

  triangleVerticesCache.set(instance, { radius, vertices });
  return vertices;
};
