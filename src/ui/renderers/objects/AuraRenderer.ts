import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
  transformObjectPoint,
} from "./ObjectRenderer";
import {
  SceneObjectInstance,
  SceneFill,
  SceneVector2,
  FILL_TYPES,
} from "../../../logic/services/SceneObjectManager";
import { createDynamicCirclePrimitive, createDynamicPolygonPrimitive } from "../primitives";
import type {
  AuraRendererCompositeConfig,
  AuraRendererLayer,
  AuraRendererFillConfig,
  AuraRendererStrokeConfig,
} from "../../../db/effects-db";
import { cloneSceneFill } from "../../../logic/services/particles/ParticleEmitterShared";

interface AuraCustomData {
  renderer: AuraRendererCompositeConfig;
}

type RendererLayer = AuraRendererLayer;

export class AuraRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const custom = instance.data.customData as AuraCustomData | undefined;
    if (!custom || !custom.renderer || custom.renderer.kind !== "composite") {
      return { staticPrimitives: [], dynamicPrimitives: [] };
    }

    const dynamicPrimitives: DynamicPrimitive[] = [];
    const layers = custom.renderer.layers || [];

    layers.forEach((layer) => {
      if (layer.shape === "polygon") {
        const vertices = sanitizeVertices(layer.vertices);
        if (vertices.length < 3) return;
        if (layer.stroke) {
          const strokeVertices = expandVerticesForStroke(vertices, Math.max(getStrokeWidth(layer.stroke), 0));
          dynamicPrimitives.push(
            createDynamicPolygonPrimitive(instance, {
              vertices: strokeVertices,
              offset: layer.offset,
              getFill: (_t) => resolveStrokeFill(layer.stroke!),
            })
          );
        }
        dynamicPrimitives.push(
          createDynamicPolygonPrimitive(instance, {
            vertices,
            offset: layer.offset,
            getFill: (_t) => resolveFill(layer.fill),
          })
        );
        return;
      }

      // circle
      const radius = Math.max(layer.radius, 0);
      const segments = Math.max(Math.floor(layer.segments ?? 32), 8);
      if (layer.stroke) {
        dynamicPrimitives.push(
          createDynamicCirclePrimitive(instance, {
            segments,
            offset: layer.offset,
            radius: radius + Math.max(getStrokeWidth(layer.stroke), 0),
            getFill: (_t) => resolveStrokeFill(layer.stroke!),
          })
        );
      }
      dynamicPrimitives.push(
        createDynamicCirclePrimitive(instance, {
          segments,
          offset: layer.offset,
          radius,
          getFill: (_t) => resolveFill(layer.fill),
        })
      );
    });

    return { staticPrimitives: [], dynamicPrimitives };
  }
}

const sanitizeVertices = (
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

const getStrokeWidth = (stroke: AuraRendererStrokeConfig): number => {
  if ((stroke as any).type === "solid") return (stroke as any).width ?? 0;
  return (stroke as any).width ?? 0;
};

const resolveFill = (fill: AuraRendererFillConfig | undefined): SceneFill => {
  if (!fill || fill.type === "base") {
    return { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 0 } };
  }
  if (fill.type === "solid") {
    return { fillType: FILL_TYPES.SOLID, color: { ...fill.color } };
  }
  // gradient: incoming is SceneFill-compatible
  return cloneSceneFill(fill.fill as any);
};

const resolveStrokeFill = (stroke: AuraRendererStrokeConfig): SceneFill => {
  if (stroke.type === "solid") {
    return { fillType: FILL_TYPES.SOLID, color: { ...stroke.color } };
  }
  // base stroke uses base color white; brightness/alpha are ignored for auras
  return { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 1 } };
};

const expandVerticesForStroke = (vertices: SceneVector2[], strokeWidth: number) => {
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

const computeCenter = (verts: SceneVector2[]): SceneVector2 => {
  if (verts.length === 0) return { x: 0, y: 0 };
  let minX = verts[0]!.x, maxX = verts[0]!.x, minY = verts[0]!.y, maxY = verts[0]!.y;
  for (let i = 1; i < verts.length; i += 1) {
    const v = verts[i]!;
    if (v.x < minX) minX = v.x; else if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y; else if (v.y > maxY) maxY = v.y;
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
};


