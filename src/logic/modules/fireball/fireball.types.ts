import type { SceneVector2, SceneFill, SceneColor, SceneObjectManager } from "../../services/SceneObjectManager";
import type { ParticleEmitterShape } from "../../services/particles/ParticleEmitterShared";
import type { BricksModule } from "../bricks/bricks.module";
import type { ExplosionModule } from "../explosion/explosion.module";

export interface FireballModuleOptions {
  scene: SceneObjectManager;
  bricks: BricksModule;
  explosions: ExplosionModule;
  logEvent: (message: string) => void;
}

export interface FireballState {
  targetBrickId: string;
  damage: number;
  radius: number;
  explosionRadius: number;
  sourceUnitId: string;
  trailEmitter: FireballTrailEmitterConfig;
  smokeEmitter: FireballTrailEmitterConfig;
}

export interface FireballSpawnOptions {
  sourceUnitId: string;
  sourcePosition: SceneVector2;
  targetBrickId: string;
  damage: number;
  explosionRadius: number;
  maxDistance: number;
}

export interface FireballTrailEmitterConfig {
  particlesPerSecond: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  baseSpeed: number;
  speedVariation: number;
  sizeRange: { min: number; max: number };
  spread: number;
  offset: SceneVector2;
  color: SceneColor;
  fill?: SceneFill;
  shape?: ParticleEmitterShape;
  maxParticles?: number;
}
