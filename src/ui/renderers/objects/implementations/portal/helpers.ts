import type { SceneObjectInstance, SceneVector2 } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import type { ParticleEmitterParticleState } from "../../../primitives/ParticleEmitterPrimitive";
import { sanitizeParticleEmitterConfig } from "../../../primitives/ParticleEmitterPrimitive";
import { transformObjectPoint } from "../../ObjectRenderer";
import { randomBetween } from "../../shared/helpers";
import { DEFAULT_PORTAL_EMITTER } from "./constants";
import type { PortalCustomData, PortalEmitterConfig } from "./types";

/**
 * Gets the emitter config for a portal instance
 */
export const getEmitterConfig = (
  instance: SceneObjectInstance
): PortalEmitterConfig | null => {
  const custom = instance.data.customData as PortalCustomData | undefined;
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
    speedVariation: Math.max(
      0,
      custom?.emitter?.speedVariation ?? DEFAULT_PORTAL_EMITTER.speedVariation
    ),
  };
};

/**
 * Gets the emitter origin position (with rotation applied)
 */
export const getEmitterOrigin = (
  instance: SceneObjectInstance,
  config: PortalEmitterConfig
): SceneVector2 => {
  const offset = config.offset ?? { x: 0, y: 0 };
  return transformObjectPoint(instance.data.position, instance.data.rotation, offset);
};

/**
 * Creates a particle state for portal emitter
 */
export const spawnPortalParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: PortalEmitterConfig
): ParticleEmitterParticleState => {
  // Emit uniformly in all directions
  const direction = Math.random() * Math.PI * 2;
  const speed = Math.max(
    0,
    config.baseSpeed +
      (config.speedVariation > 0 ? (Math.random() * 2 - 1) * config.speedVariation : 0)
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
};
