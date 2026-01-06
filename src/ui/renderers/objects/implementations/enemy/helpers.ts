import type {
  SceneObjectInstance,
  SceneVector2,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { sanitizeVertices, sanitizeOffset } from "@shared/helpers/vector.helper";
import type {
  EnemyRendererConfig,
  EnemyRendererCompositeConfig,
  EnemyRendererPolygonConfig,
} from "@db/enemies-db";
import { DEFAULT_VERTICES } from "../player-unit/constants";

export interface EnemyCustomData {
  renderer: EnemyRendererConfig;
  type: string;
  level: number;
}

export interface EnemyRendererData {
  kind: "polygon" | "composite";
  vertices?: SceneVector2[];
  offset?: SceneVector2;
  composite?: EnemyRendererCompositeConfig;
}

/**
 * Extracts and sanitizes renderer data from instance
 */
export const extractEnemyRendererData = (instance: SceneObjectInstance): EnemyRendererData => {
  const payload = instance.data.customData as EnemyCustomData | undefined;
  if (payload && typeof payload === "object") {
    const renderer = payload.renderer;
    if (renderer && typeof renderer === "object") {
      if ((renderer as EnemyRendererConfig).kind === "composite") {
        return {
          kind: "composite",
          composite: renderer as EnemyRendererCompositeConfig,
        };
      }
      if ((renderer as EnemyRendererPolygonConfig).kind === "polygon") {
        const polygon = renderer as EnemyRendererPolygonConfig;
        return {
          kind: "polygon",
          vertices: sanitizeVertices(polygon.vertices, DEFAULT_VERTICES, 3),
          offset: sanitizeOffset(undefined),
        };
      }
    }
  }
  return { kind: "polygon", vertices: sanitizeVertices(undefined, DEFAULT_VERTICES, 3) };
};
