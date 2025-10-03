import { SceneObjectInstance } from "../../../logic/services/SceneObjectManager";

export interface Primitive {
  readonly data: Float32Array;
}

export interface StaticPrimitive extends Primitive {}

export interface DynamicPrimitive extends Primitive {
  update(instance: SceneObjectInstance): Float32Array | null;
}

export interface ObjectRegistration {
  staticPrimitives: StaticPrimitive[];
  dynamicPrimitives: DynamicPrimitive[];
}

export interface DynamicPrimitiveUpdate {
  primitive: DynamicPrimitive;
  data: Float32Array;
}

export abstract class ObjectRenderer {
  public abstract register(instance: SceneObjectInstance): ObjectRegistration;

  public update(
    instance: SceneObjectInstance,
    registration: ObjectRegistration
  ): DynamicPrimitiveUpdate[] {
    const updates: DynamicPrimitiveUpdate[] = [];
    registration.dynamicPrimitives.forEach((primitive) => {
      const data = primitive.update(instance);
      if (data) {
        updates.push({ primitive, data });
      }
    });
    return updates;
  }

  public remove(
    _instance: SceneObjectInstance,
    _registration: ObjectRegistration
  ): void {
    // Default implementation does nothing.
  }
}
