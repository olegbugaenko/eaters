import type {
  PersistentAoeObjectCustomData,
  PersistentAoeParticleCustomData,
} from "@logic/modules/active-map/spellcasting/implementations/PersistentAoeSpellBehavior.types";
import type { ParticleEmitterBaseConfig } from "../../../primitives/ParticleEmitterPrimitive";

export interface FireRingEmitterConfig extends ParticleEmitterBaseConfig {
  meta: {
    radialSpeed: { min: number; max: number };
    tangentialSpeed: { min: number; max: number };
    spawnJitter: { radial: number; angular: number };
    intensity: number;
  };
}

export type { PersistentAoeObjectCustomData, PersistentAoeParticleCustomData };
