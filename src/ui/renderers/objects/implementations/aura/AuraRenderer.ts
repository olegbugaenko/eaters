import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
} from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { createDynamicCirclePrimitive, createDynamicPolygonPrimitive } from "../../../primitives";
import type { AuraCustomData, RendererLayer } from "./types";
import { sanitizeVertices } from "@shared/helpers/vector.helper";
import {
  getStrokeWidth,
  resolveFill,
  resolveStrokeFill,
  expandVerticesForStrokeAura,
} from "./helpers";

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
          const strokeVertices = expandVerticesForStrokeAura(
            vertices,
            Math.max(getStrokeWidth(layer.stroke), 0)
          );
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

      if (layer.shape === "circle") {
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
        return;
      }

      if (layer.shape === "sprite") {
        // Sprite layer - TODO: implement sprite rendering for auras
        console.warn("[AuraRenderer] Sprite layers are not yet implemented");
        return;
      }
    });

    return { staticPrimitives: [], dynamicPrimitives };
  }
}
