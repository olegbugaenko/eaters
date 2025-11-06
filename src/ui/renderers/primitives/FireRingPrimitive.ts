import { SceneColor, SceneObjectInstance } from "../../../logic/services/SceneObjectManager";
import { DynamicPrimitive } from "../objects/ObjectRenderer";
import {
  addFireRingInstance,
  updateFireRing,
  type FireRingInstance,
} from "./gpu/FireRingGpuRenderer";
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

  const primitive: DynamicPrimitive = {
    get data() {
      return new Float32Array(0);
    },

    update(target: SceneObjectInstance): Float32Array | null {
      const config = options.getConfig(target);
      
      if (!config) {
        if (fireInstance) {
          fireInstance.active = false;
          fireInstance = null;
        }
        return null;
      }

      const glContext = ensureGl();
      if (!glContext) {
        return null;
      }

      const position = target.data.position;
      const currentTime = getSceneTimelineNow();

      if (!fireInstance) {
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
            a: typeof config.color.a === "number" ? config.color.a : 1,
          },
          active: true,
        };
        addFireRingInstance(glContext, fireInstance);
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
        fireInstance.color.a = typeof config.color.a === "number" ? config.color.a : 1;

        if (config.lifetime) {
          fireInstance.lifetime = config.lifetime;
        }
        updateFireRing(glContext, fireInstance, currentTime);
      }
      
      return null; // GPU rendering, no vertex data needed
    },

    dispose() {
      if (fireInstance) {
        fireInstance.active = false;
        fireInstance = null;
      }
    },
  };

  return primitive;
};

