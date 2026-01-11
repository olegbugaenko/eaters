import type {
  SceneFill,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import { computeCenter, sanitizeVertices } from "@shared/helpers/vector.helper";
import { resolveRendererFillConfig } from "@shared/helpers/renderer-clone.helper";
import { cloneSceneColor } from "@shared/helpers/scene-color.helper";
import type { RendererFillConfig, RendererStrokeConfig } from "@shared/types/renderer-config";

/**
 * Gets stroke width from RendererStrokeConfig
 */
export const getStrokeWidth = (stroke: RendererStrokeConfig): number => {
  if (stroke.type === "solid") return stroke.width ?? 0;
  return stroke.width ?? 0;
};

/**
 * Resolves RendererFillConfig to SceneFill
 * @deprecated Use resolveRendererFillConfig from @shared/helpers/renderer-clone.helper instead
 */
export const resolveFill = (fill: RendererFillConfig | undefined): SceneFill => {
  return resolveRendererFillConfig(fill);
};

/**
 * Resolves RendererStrokeConfig to SceneFill
 */
export const resolveStrokeFill = (stroke: RendererStrokeConfig): SceneFill => {
  if (stroke.type === "solid") {
    return { fillType: FILL_TYPES.SOLID, color: cloneSceneColor(stroke.color) };
  }
  // base stroke uses base color white; brightness/alpha are ignored for auras
  return { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 1 } };
};

/**
 * Expands vertices outward by strokeWidth to create a stroke outline
 */
export const expandVerticesForStrokeAura = (
  vertices: SceneVector2[],
  strokeWidth: number
): SceneVector2[] => {
  if (strokeWidth <= 0) return vertices.map((v) => ({ ...v }));
  const center = computeCenter(vertices);
  return vertices.map((vertex) => {
    const dx = vertex.x - center.x;
    const dy = vertex.y - center.y;
    const len = Math.hypot(dx, dy) || 1;
    const scale = (len + strokeWidth) / len;
    return { x: center.x + dx * scale, y: center.y + dy * scale };
  });
};
