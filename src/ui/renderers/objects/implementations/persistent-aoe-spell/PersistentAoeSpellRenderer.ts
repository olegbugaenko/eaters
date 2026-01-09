import { ObjectRenderer, ObjectRegistration } from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { DynamicPrimitive } from "../../ObjectRenderer";
import { createFireRingPrimitive } from "../../../primitives";
import { getCustomData } from "./helpers";

export class PersistentAoeSpellRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const initialData = getCustomData(instance);
    const dynamicPrimitives: DynamicPrimitive[] = [];

    // If explosion mode - no rendering here (explosions render via ExplosionRenderer)
    if (initialData.explosion) {
      return {
        staticPrimitives: [],
        dynamicPrimitives: [],
      };
    }

    // Fire mode: GPU fire ring shader
    const fireRingPrimitive = createFireRingPrimitive(instance, {
      getConfig: (target) => {
        const data = getCustomData(target);
        if (data.intensity <= 0) {
          return null;
        }
        return {
          innerRadius: data.innerRadius,
          outerRadius: data.outerRadius,
          thickness: data.thickness,
          intensity: data.intensity,
          lifetime: data.durationMs,
          color: {
            r: data.fireColor.r,
            g: data.fireColor.g,
            b: data.fireColor.b,
            a: data.fireColor.a,
          },
        };
      },
    });
    if (fireRingPrimitive) {
      dynamicPrimitives.push(fireRingPrimitive);
    }

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
