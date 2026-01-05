import {
  ObjectRenderer,
  ObjectRegistration,
  DynamicPrimitive,
  DynamicPrimitiveUpdate,
} from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import {
  createDynamicPolygonPrimitive,
} from "../../../primitives";
import { hasStroke, expandVerticesForStroke, createStrokeFill } from "@shared/helpers/stroke.helper";
import { extractEnemyRendererData } from "./helpers";

export class EnemyObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const rendererData = extractEnemyRendererData(instance);

    const dynamicPrimitives: DynamicPrimitive[] = [];

    if (rendererData.kind === "composite") {
      // For now, composite enemies are not fully implemented
      // They would need similar logic to PlayerUnitObjectRenderer
      // For simplicity, we'll render as a simple polygon
      // TODO: Implement composite rendering for enemies if needed
    }

    // Render polygon (either from polygon config or fallback)
    if (rendererData.vertices && rendererData.vertices.length >= 3) {
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
