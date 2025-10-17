import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
  transformObjectPoint,
} from "./ObjectRenderer";
import {
  SceneObjectInstance,
  FILL_TYPES,
  SceneFill,
} from "../../../logic/services/SceneObjectManager";
import {
  createDynamicCirclePrimitive,
} from "../primitives";
import {
  createParticleEmitterPrimitive,
  sanitizeParticleEmitterConfig,
  type ParticleEmitterBaseConfig,
  type ParticleEmitterParticleState,
} from "../primitives/ParticleEmitterPrimitive";

interface PortalCustomData {
  emitter?: Partial<ParticleEmitterBaseConfig> & {
    baseSpeed?: number;
    speedVariation?: number;
  };
  radius?: number;
}

type PortalEmitterConfig = ParticleEmitterBaseConfig & {
  baseSpeed: number;
  speedVariation: number;
};

const DEFAULT_PORTAL_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 18,
  stops: [
    { offset: 0, color: { r: 0.4, g: 0.7, b: 1, a: 0.6 } },
    { offset: 0.45, color: { r: 0.25, g: 0.5, b: 0.9, a: 0.35 } },
    { offset: 1, color: { r: 0.15, g: 0.25, b: 0.7, a: 0 } },
  ],
};

const DEFAULT_PORTAL_EMITTER: PortalEmitterConfig = {
  particlesPerSecond: 90,
  particleLifetimeMs: 900,
  fadeStartMs: 450,
  emissionDurationMs: 900,
  sizeRange: { min: 1, max: 3 },
  offset: { x: 0, y: 0 },
  color: { r: 0.4, g: 0.8, b: 1, a: 0.9 },
  fill: undefined,
  shape: "circle",
  capacity: 100,
  baseSpeed: 0.06,
  speedVariation: 0.04,
};

export class PortalObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const custom = instance.data.customData as PortalCustomData | undefined;
    const radius = Math.max(custom?.radius ?? 18, 1);

    const dynamicPrimitives: DynamicPrimitive[] = [];

    // Portal ring
    dynamicPrimitives.push(
      createDynamicCirclePrimitive(instance, {
        radius,
        segments: 48,
        getFill: (target) => target.data.fill ?? DEFAULT_PORTAL_FILL,
      })
    );

    // Particles rising from center
    const emitterPrimitive = createParticleEmitterPrimitive<PortalEmitterConfig>(
      instance,
      {
        getConfig: (target) => this.getEmitterConfig(target, custom),
        getOrigin: (target) => transformObjectPoint(target.data.position, target.data.rotation, { x: 0, y: 0 }),
        spawnParticle: (origin, _inst, config) => this.spawnPortalParticle(origin, config),
      }
    );
    if (emitterPrimitive) {
      dynamicPrimitives.push(emitterPrimitive);
    }

    return { staticPrimitives: [], dynamicPrimitives };
  }

  private getEmitterConfig(
    instance: SceneObjectInstance,
    custom: PortalCustomData | undefined
  ): PortalEmitterConfig | null {
    const base = sanitizeParticleEmitterConfig(custom?.emitter ?? {}, {
      defaultColor: { r: 0.4, g: 0.8, b: 1, a: 0.9 },
      defaultOffset: { x: 0, y: 0 },
      minCapacity: 32,
      defaultShape: "circle",
    });
    if (!base) {
      return { ...DEFAULT_PORTAL_EMITTER };
    }
    return {
      ...base,
      baseSpeed: Math.max(0, custom?.emitter?.baseSpeed ?? DEFAULT_PORTAL_EMITTER.baseSpeed),
      speedVariation: Math.max(0, custom?.emitter?.speedVariation ?? DEFAULT_PORTAL_EMITTER.speedVariation),
    };
  }

  private spawnPortalParticle(
    origin: { x: number; y: number },
    config: PortalEmitterConfig
  ): ParticleEmitterParticleState {
    // Emit uniformly in all directions
    const direction = Math.random() * Math.PI * 2;
    const speed = Math.max(
      0,
      config.baseSpeed + (config.speedVariation > 0 ? (Math.random() * 2 - 1) * config.speedVariation : 0)
    );
    const size =
      config.sizeRange.min === config.sizeRange.max
        ? config.sizeRange.min
        : config.sizeRange.min + Math.random() * (config.sizeRange.max - config.sizeRange.min);
    return {
      position: { x: origin.x, y: origin.y },
      velocity: { x: Math.cos(direction) * speed, y: Math.sin(direction) * speed },
      ageMs: 0,
      lifetimeMs: config.particleLifetimeMs,
      size,
    };
  }
}


