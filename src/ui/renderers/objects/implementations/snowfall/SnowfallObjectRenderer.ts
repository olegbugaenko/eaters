import type { SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
} from "../../ObjectRenderer";
import { createParticleEmitterPrimitive } from "../../../primitives/ParticleEmitterPrimitive";
import {
  getEmitterConfig,
  getEmitterOrigin,
  spawnSnowfallParticle,
  updateSnowfallParticle,
  getGpuSpawnConfig,
} from "./helpers";
import type { SnowfallEmitterConfig } from "./types";

export class SnowfallObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const dynamicPrimitives: DynamicPrimitive[] = [];

    const emitterPrimitive = createParticleEmitterPrimitive<SnowfallEmitterConfig>(instance, {
      getConfig: getEmitterConfig,
      getOrigin: getEmitterOrigin,
      spawnParticle: spawnSnowfallParticle,
      updateParticle: updateSnowfallParticle,
      getGpuSpawnConfig,
    });
    if (emitterPrimitive) {
      dynamicPrimitives.push(emitterPrimitive);
    }

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
