import {
  ObjectRenderer,
  ObjectRegistration,
  DynamicPrimitive,
  DynamicPrimitiveUpdate,
} from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  createDynamicPolygonPrimitive,
} from "../../../primitives";
import { hasStroke, expandVerticesForStroke, createStrokeFill } from "@shared/helpers/stroke.helper";
import { extractEnemyRendererData } from "./helpers";
import { createCompositePrimitives } from "./composite-primitives.helpers";

export class EnemyObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const rendererData = extractEnemyRendererData(instance);

    const dynamicPrimitives: DynamicPrimitive[] = [];

    if (rendererData.kind === "composite" && rendererData.composite) {
      createCompositePrimitives(instance, rendererData.composite, dynamicPrimitives);
    } else if (rendererData.vertices && rendererData.vertices.length >= 3) {
      // Render polygon (either from polygon config or fallback)
      const vertices = [...rendererData.vertices]; // Create mutable copy
      
      if (hasStroke(instance.data.stroke)) {
        const strokeVertices = expandVerticesForStroke(
          vertices,
          instance.data.stroke.width
        );
        const strokePrimitive = createDynamicPolygonPrimitive(instance, {
          vertices: strokeVertices,
          fill: createStrokeFill(instance.data.stroke),
          offset: rendererData.offset,
        });
        dynamicPrimitives.push(strokePrimitive);
      }

      dynamicPrimitives.push(
        createDynamicPolygonPrimitive(instance, {
          vertices,
          offset: rendererData.offset,
        })
      );
    }

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }

  public override update(
    instance: SceneObjectInstance,
    registration: ObjectRegistration
  ): DynamicPrimitiveUpdate[] {
    // Standard update for dynamic primitives
    return super.update(instance, registration);
  }
}
