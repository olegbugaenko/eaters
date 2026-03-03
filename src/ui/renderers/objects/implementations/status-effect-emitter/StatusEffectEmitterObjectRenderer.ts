import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
} from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { createParticleEmitterPrimitive } from "../../../primitives";
import {
  createEmitterParticle,
  getEmitterOrigin,
  getGpuSpawnConfig,
  getStatusEffectEmitterConfig,
  serializeEmitterConfig,
} from "./emitter.helpers";
import type { StatusEffectEmitterRenderConfig } from "./types";

export class StatusEffectEmitterObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const emitterPrimitive = createParticleEmitterPrimitive<StatusEffectEmitterRenderConfig>(
      instance,
      {
        getConfig: getStatusEffectEmitterConfig,
        getOrigin: getEmitterOrigin,
        spawnParticle: createEmitterParticle,
        serializeConfig: serializeEmitterConfig,
        getGpuSpawnConfig,
      }
    );

    const dynamicPrimitives: DynamicPrimitive[] = [];
    if (emitterPrimitive) {
      emitterPrimitive.autoAnimate = true;
      dynamicPrimitives.push(emitterPrimitive);
    }

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
