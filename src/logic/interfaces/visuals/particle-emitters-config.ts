import type { SceneColor, SceneFill, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ParticleEmitterShape } from "../../services/particles/ParticleEmitterShared";

/**
 * Common particle emitter configuration interface.
 * Used across bullets, fireballs, player units, explosions, and spells.
 * Contains all possible fields - some are required, some are optional depending on use case.
 * 
 * Required fields (used by all emitters):
 * - particlesPerSecond, particleLifetimeMs, fadeStartMs, sizeRange, color
 * 
 * Common optional fields (used by most emitters):
 * - baseSpeed, speedVariation, spread, offset (for bullets, fireballs, player units)
 * - radialSpeed, tangentialSpeed, spawnJitter (for spells)
 * - emissionDurationMs, spawnRadius, arc, direction (for explosions)
 */
export interface ParticleEmitterConfig {
  // Core emission properties (required for all)
  particlesPerSecond: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  sizeRange: { min: number; max: number };
  color: SceneColor;

  // Speed properties (optional - used by bullets, fireballs, player units, explosions)
  baseSpeed?: number;
  speedVariation?: number;
  
  // Alternative speed properties (optional - used by spells instead of baseSpeed/speedVariation)
  radialSpeed?: { min: number; max: number };
  tangentialSpeed?: { min: number; max: number };

  // Size evolution (optional)
  sizeEvolutionMult?: number; // Size multiplier at end of lifetime (>1 = grow, <1 = shrink)
  sizeGrowthRate?: number; // Size multiplier per second (for explosions)

  // Direction and spread (optional - used by bullets, fireballs, player units)
  spread?: number; // Angular spread in radians
  offset?: SceneVector2; // Offset from emitter origin

  // Explosion-specific properties (optional)
  emissionDurationMs?: number; // How long particles are emitted
  spawnRadius?: { min: number; max: number }; // Spawn radius range
  /**
   * Ensures the maximum spawn radius scales with the initial radius of the explosion.
   */
  spawnRadiusMultiplier?: number;
  arc?: number; // Arc angle in radians
  direction?: number; // Direction angle in radians
  /**
   * If true, particles move radially outward from the explosion center.
   * Direction is calculated from origin to spawn position.
   * If false, uses the configured direction/arc as normal.
   */
  radialVelocity?: boolean;

  // Spell-specific properties (optional)
  spawnJitter?: { radial?: number; angular?: number };

  // Visual properties (optional)
  fill?: SceneFill;
  shape?: ParticleEmitterShape;
  /**
   * If true, rotate particle quads to face their velocity direction.
   */
  alignToVelocity?: boolean;

  // Limits (optional)
  maxParticles?: number;
}
