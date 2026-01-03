import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
} from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { createDynamicCirclePrimitive } from "../../../primitives";
import { createParticleEmitterPrimitive } from "../../../primitives/ParticleEmitterPrimitive";
import { DEFAULT_PORTAL_FILL, DEFAULT_PORTAL_RADIUS, DEFAULT_PORTAL_SEGMENTS } from "./constants";
import { getEmitterConfig, getEmitterOrigin, spawnPortalParticle } from "./helpers";
import type { PortalCustomData, PortalEmitterConfig } from "./types";

export class PortalObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const custom = instance.data.customData as PortalCustomData | undefined;
    const radius = Math.max(custom?.radius ?? DEFAULT_PORTAL_RADIUS, 1);

    const dynamicPrimitives: DynamicPrimitive[] = [];

    // Portal ring
    dynamicPrimitives.push(
      createDynamicCirclePrimitive(instance, {
        radius,
        segments: DEFAULT_PORTAL_SEGMENTS,
        getFill: (target) => target.data.fill ?? DEFAULT_PORTAL_FILL,
      })
    );

    // Particles rising from center
    const emitterPrimitive = createParticleEmitterPrimitive<PortalEmitterConfig>(instance, {
      getConfig: getEmitterConfig,
      getOrigin: getEmitterOrigin,
      spawnParticle: spawnPortalParticle,
    });
    if (emitterPrimitive) {
      dynamicPrimitives.push(emitterPrimitive);
    }

    return { staticPrimitives: [], dynamicPrimitives };
  }
}
