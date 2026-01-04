import {
  SceneObjectInstance,
  SceneVector2,
} from "../../../logic/services/scene-object-manager/scene-object-manager.types";

export const POSITION_COMPONENTS = 2;
export const FILL_INFO_COMPONENTS = 4;
export const FILL_PARAMS0_COMPONENTS = 4;
export const FILL_PARAMS1_COMPONENTS = 4;
export const FILL_FILAMENTS0_COMPONENTS = 4;
export const FILL_FILAMENTS1_COMPONENTS = 1;
export const FILL_FILAMENTS_COMPONENTS =
  FILL_FILAMENTS0_COMPONENTS + FILL_FILAMENTS1_COMPONENTS;
export const STOP_OFFSETS_COMPONENTS = 3;
export const STOP_COLOR_COMPONENTS = 4;
export const MAX_GRADIENT_STOPS = 3;
export const FILL_COMPONENTS =
  FILL_INFO_COMPONENTS +
  FILL_PARAMS0_COMPONENTS +
  FILL_PARAMS1_COMPONENTS +
  FILL_FILAMENTS_COMPONENTS +
  STOP_OFFSETS_COMPONENTS +
  STOP_COLOR_COMPONENTS * MAX_GRADIENT_STOPS;
export const VERTEX_COMPONENTS = POSITION_COMPONENTS + FILL_COMPONENTS;

export interface Primitive {
  readonly data: Float32Array;
}

export interface StaticPrimitive extends Primitive {}

export interface DynamicPrimitive extends Primitive {
  update(instance: SceneObjectInstance): Float32Array | null;
  dispose?(): void;
}

export interface ObjectRegistration {
  staticPrimitives: StaticPrimitive[];
  dynamicPrimitives: DynamicPrimitive[];
}

export interface DynamicPrimitiveUpdate {
  primitive: DynamicPrimitive;
  data: Float32Array;
}

export const transformObjectPoint = (
  center: SceneVector2,
  rotation: number | undefined,
  offset?: SceneVector2
): SceneVector2 => {
  if (!offset) {
    return { x: center.x, y: center.y };
  }
  const angle = typeof rotation === "number" ? rotation : 0;
  if (angle === 0) {
    return { x: center.x + offset.x, y: center.y + offset.y };
  }
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: center.x + offset.x * cos - offset.y * sin,
    y: center.y + offset.x * sin + offset.y * cos,
  };
};

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

  protected getTransformedPosition(
    instance: SceneObjectInstance,
    offset?: SceneVector2
  ): SceneVector2 {
    return transformObjectPoint(
      instance.data.position,
      instance.data.rotation,
      offset
    );
  }
}
