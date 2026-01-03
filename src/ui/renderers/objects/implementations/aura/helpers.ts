import type {
  SceneFill,
  SceneFillNoise,
  SceneFillFilaments,
  SceneVector2,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import { cloneSceneFill } from "@/logic/helpers/scene-fill.helper";
import { computeCenter, expandVerticesForStroke } from "../../shared/helpers";
import type { AuraRendererFillConfig, AuraRendererStrokeConfig } from "./types";

/**
 * Clones fill noise configuration
 */
export const cloneFillNoise = (
  noise: SceneFillNoise | undefined
): SceneFillNoise | undefined => (noise ? { ...noise } : undefined);

/**
 * Clones fill filaments configuration
 */
export const cloneFillFilaments = (
  filaments: SceneFillFilaments | undefined
): SceneFillFilaments | undefined => (filaments ? { ...filaments } : undefined);

/**
 * Sanitizes vertices array, filtering out invalid entries
 */
export const sanitizeVertices = (
  vertices: readonly SceneVector2[] | undefined
): SceneVector2[] => {
  if (!Array.isArray(vertices)) return [];
  const out: SceneVector2[] = [];
  vertices.forEach((v) => {
    if (v && typeof v.x === "number" && typeof v.y === "number") {
      out.push({ x: v.x, y: v.y });
    }
  });
  return out;
};

/**
 * Gets stroke width from AuraRendererStrokeConfig
 */
export const getStrokeWidth = (stroke: AuraRendererStrokeConfig): number => {
  if (stroke.type === "solid") return stroke.width ?? 0;
  return stroke.width ?? 0;
};

/**
 * Resolves AuraRendererFillConfig to SceneFill
 */
export const resolveFill = (fill: AuraRendererFillConfig | undefined): SceneFill => {
  if (!fill || fill.type === "base") {
    return { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 0 } };
  }
  if (fill.type === "solid") {
    return {
      fillType: FILL_TYPES.SOLID,
      color: { ...fill.color },
      ...(fill.noise ? { noise: cloneFillNoise(fill.noise) } : {}),
      ...(fill.filaments ? { filaments: cloneFillFilaments(fill.filaments) } : {}),
    };
  }
  // gradient: incoming is SceneFill-compatible
  return cloneSceneFill(fill.fill as any);
};

/**
 * Resolves AuraRendererStrokeConfig to SceneFill
 */
export const resolveStrokeFill = (stroke: AuraRendererStrokeConfig): SceneFill => {
  if (stroke.type === "solid") {
    return { fillType: FILL_TYPES.SOLID, color: { ...stroke.color } };
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
