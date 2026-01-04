import { SceneColor, SceneObjectInstance } from "../../../logic/services/scene-object-manager/scene-object-manager.types";
import { DynamicPrimitive } from "../objects/ObjectRenderer";
import { ensureColorAlpha } from "@shared/helpers/scene-color.helper";
import {
  fireRingGpuRenderer,
  type FireRingInstance,
  type FireRingSlotHandle,
} from "./gpu/fire-ring";
import { getParticleEmitterGlContext } from "./utils/gpuContext";
import { getSceneTimelineNow } from "./utils/sceneTimeline";

export interface FireRingPrimitiveConfig {
  innerRadius: number;
  outerRadius: number;
  thickness: number;
  intensity: number;
  lifetime?: number;
  color: SceneColor;
}

export interface FireRingPrimitiveOptions {
  getConfig: (instance: SceneObjectInstance) => FireRingPrimitiveConfig | null;
}

export const createFireRingPrimitive = (
  instance: SceneObjectInstance,
  options: FireRingPrimitiveOptions
): DynamicPrimitive | null => {
  let gl = getParticleEmitterGlContext();
  const ensureGl = () => {
    if (!gl) {
      gl = getParticleEmitterGlContext();
    }
    return gl;
  };

  let fireInstance: FireRingInstance | null = null;
  let slotHandle: FireRingSlotHandle | null = null;

  const primitive: DynamicPrimitive = {
    get data() {
      return new Float32Array(0);
    },

    update(target: SceneObjectInstance): Float32Array | null {
      const config = options.getConfig(target);
      
      if (!config) {
        if (slotHandle) {
          fireRingGpuRenderer.releaseSlot(slotHandle);
          slotHandle = null;
          fireInstance = null;
        }
        return null;
      }

      const glContext = ensureGl();
      if (!glContext) {
        return null;
      }

      // Set context if not already set
      if (fireRingGpuRenderer["gl"] !== glContext) {
        fireRingGpuRenderer.setContext(glContext);
      }

      const position = target.data.position;
      const currentTime = getSceneTimelineNow();

      if (!fireInstance || !slotHandle) {
        // Створюємо новий інстанс
        fireInstance = {
          center: { x: position.x, y: position.y },
          innerRadius: config.innerRadius,
          outerRadius: config.outerRadius,
          birthTimeMs: currentTime,
          lifetime: config.lifetime || 0,
          intensity: config.intensity,
          color: {
            r: config.color.r,
            g: config.color.g,
            b: config.color.b,
            a: ensureColorAlpha(config.color),
          },
          active: true,
        };
        slotHandle = fireRingGpuRenderer.acquireSlot(undefined);
        if (slotHandle) {
          fireRingGpuRenderer.updateSlot(slotHandle, fireInstance);
        } else {
          fireInstance = null;
        }
      } else {
        // Оновлюємо існуючий інстанс
        fireInstance.center.x = position.x;
        fireInstance.center.y = position.y;
        fireInstance.innerRadius = config.innerRadius;
        fireInstance.outerRadius = config.outerRadius;
        fireInstance.intensity = config.intensity;
        fireInstance.color.r = config.color.r;
        fireInstance.color.g = config.color.g;
        fireInstance.color.b = config.color.b;
        fireInstance.color.a = ensureColorAlpha(config.color);

        if (config.lifetime) {
          fireInstance.lifetime = config.lifetime;
        }

        // Check if lifetime expired
        if (fireInstance.lifetime > 0) {
          const age = currentTime - fireInstance.birthTimeMs;
          if (age >= fireInstance.lifetime) {
            fireInstance.active = false;
          }
        }

        if (slotHandle) {
          fireRingGpuRenderer.updateSlot(slotHandle, fireInstance);
        }
      }
      
      return null; // GPU rendering, no vertex data needed
    },

    dispose() {
      if (slotHandle) {
        fireRingGpuRenderer.releaseSlot(slotHandle);
        slotHandle = null;
        fireInstance = null;
      }
    },
  };

  return primitive;
};
