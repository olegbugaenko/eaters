import { SceneObjectManager } from "../../../services/scene-object-manager/SceneObjectManager";
import { resetAllArcBatches } from "../../../../ui/renderers/primitives/gpu/ArcGpuRenderer";
import { clearAllParticleEmitters } from "../../../../ui/renderers/primitives/gpu/ParticleEmitterGpuRenderer";
import { resetAllWaveBatches } from "../../../../ui/renderers/primitives/gpu/ExplosionWaveGpuRenderer";
import { FireballModule } from "../../scene/fireball/fireball.module";
import { BulletModule } from "../bullet/bullet.module";
import { ExplosionModule } from "../../scene/explosion/explosion.module";
import { ArcModule } from "../../scene/arc/arc.module";
import { EffectsModule } from "../../scene/effects/effects.module";

export type MapSceneCleanupContract = {
  resetAfterRun: () => void;
};

interface CleanupTargets {
  fireball: FireballModule;
  bullet: BulletModule;
  explosion: ExplosionModule;
  arc: ArcModule;
  effects: EffectsModule;
  sceneObjects: SceneObjectManager;
}

export class MapSceneCleanup implements MapSceneCleanupContract {
  constructor(private readonly targets: CleanupTargets) {}

  public resetAfterRun(): void {
    this.targets.fireball.reset();
    this.targets.bullet.reset();
    this.targets.explosion.reset();
    this.targets.arc.reset();
    this.targets.effects.reset();
    this.targets.sceneObjects.flushAllPendingRemovals();
    this.resetGpuCaches();
  }

  private resetGpuCaches(): void {
    // Clear GPU caches to avoid lingering artifacts and memory leaks between runs
    try {
      resetAllWaveBatches();
    } catch {}
    try {
      resetAllArcBatches();
    } catch {}
    try {
      clearAllParticleEmitters();
    } catch {}
  }
}

