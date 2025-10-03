import { ObjectRegistration, ObjectRenderer } from "./ObjectRenderer";
import { SceneObjectInstance } from "../../../logic/services/SceneObjectManager";
import {
  createDynamicCirclePrimitive,
  createParticleSystemPrimitive,
} from "../primitives";

export class ExplosionObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    return {
      staticPrimitives: [],
      dynamicPrimitives: [
        createDynamicCirclePrimitive(instance),
        createParticleSystemPrimitive(instance),
      ],
    };
  }
}
