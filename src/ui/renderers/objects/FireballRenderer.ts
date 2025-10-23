import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
} from "./ObjectRenderer";
import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneObjectInstance,
  SceneVector2,
} from "../../../logic/services/SceneObjectManager";
import {
  createDynamicCirclePrimitive,
  createParticleEmitterPrimitive,
} from "../primitives";
import {
  ParticleEmitterBaseConfig,
  ParticleEmitterParticleState,
  sanitizeParticleEmitterConfig,
} from "../primitives/ParticleEmitterPrimitive";

interface FireballRendererCustomData {
  fireballId?: string;
  glowColor: SceneColor;
  radius: number;
}

const FIREBALL_CORE_COLOR: SceneColor = { r: 1.0, g: 0.4, b: 0.1, a: 1.0 };
const FIREBALL_GLOW_COLOR: SceneColor = { r: 1.0, g: 0.7, b: 0.3, a: 0.8 };

const FIREBALL_PARTICLE_CONFIG = {
  particlesPerSecond: 20,
  particleLifetimeMs: 300,
  fadeStartMs: 200,
  sizeRange: { min: 2, max: 4 },
  offset: { x: 0, y: 0 },
  color: FIREBALL_GLOW_COLOR,
  shape: "circle" as const,
  capacity: 10,
};

export class FireballRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const data = instance.data.customData as FireballRendererCustomData | undefined;
    console.log('[FireballRenderer] Registering fireball:', instance.id, data);
    if (!data) {
      console.log('[FireballRenderer] No custom data, returning empty');
      return { staticPrimitives: [], dynamicPrimitives: [] };
    }

    const coreRadius = data.radius || 8;
    const glowRadius = coreRadius * 1.5;

    // Core fireball circle
    const corePrimitive = createDynamicCirclePrimitive(instance, {
      radius: coreRadius,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: FIREBALL_CORE_COLOR,
      },
    });

    // Glow effect circle
    const glowPrimitive = createDynamicCirclePrimitive(instance, {
      radius: glowRadius,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: data.glowColor || FIREBALL_GLOW_COLOR,
      },
    });

    // Particle emitter for fire trail
    const particleConfig = sanitizeParticleEmitterConfig(FIREBALL_PARTICLE_CONFIG);
    if (!particleConfig) {
      return {
        staticPrimitives: [],
        dynamicPrimitives: [glowPrimitive, corePrimitive],
      };
    }

    const particlePrimitive = createParticleEmitterPrimitive(instance, {
      getConfig: () => particleConfig,
      getOrigin: () => instance.data.position,
      spawnParticle: (origin: SceneVector2) => ({
        position: { ...origin },
        velocity: {
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 100,
        },
        ageMs: 0,
        lifetimeMs: particleConfig.particleLifetimeMs,
        size: particleConfig.sizeRange.min + 
          Math.random() * (particleConfig.sizeRange.max - particleConfig.sizeRange.min),
      }),
    });

    const dynamicPrimitives: DynamicPrimitive[] = [glowPrimitive, corePrimitive];
    if (particlePrimitive) {
      dynamicPrimitives.push(particlePrimitive);
    }

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
