import type {
  SceneFill,
  SceneStroke,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import type { SceneVector2 } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { computeCenter } from "./vector.helpers";

/**
 * Type guard to check if a stroke is valid (has width > 0)
 */
export const hasStroke = (stroke: SceneStroke | undefined): stroke is SceneStroke =>
  !!stroke && typeof stroke.width === "number" && stroke.width > 0;

/**
 * Creates a SceneFill from a SceneStroke
 */
export const createStrokeFill = (stroke: SceneStroke): SceneFill => ({
  fillType: FILL_TYPES.SOLID,
  color: {
    r: stroke.color.r,
    g: stroke.color.g,
    b: stroke.color.b,
    a: typeof stroke.color.a === "number" ? stroke.color.a : 1,
  },
});

/**
 * Expands vertices outward by strokeWidth to create a stroke outline
 */
export const expandVerticesForStroke = (
  vertices: SceneVector2[],
  strokeWidth: number
): SceneVector2[] => {
  if (strokeWidth <= 0) {
    return vertices.map((vertex) => ({ ...vertex }));
  }

  const center = computeCenter(vertices);
  return vertices.map((vertex) => {
    const direction = {
      x: vertex.x - center.x,
      y: vertex.y - center.y,
    };
    const length = Math.hypot(direction.x, direction.y);
    if (length === 0) {
      return {
        x: vertex.x + strokeWidth,
        y: vertex.y,
      };
    }
    const scale = (length + strokeWidth) / Math.max(length, 1e-6);
    return {
      x: center.x + direction.x * scale,
      y: center.y + direction.y * scale,
    };
  });
};
