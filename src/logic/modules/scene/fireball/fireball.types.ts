import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { ParticleEmitterConfig } from "../../../interfaces/visuals/particle-emitters-config";
import type { BricksModule } from "../../active-map/bricks/bricks.module";
import type { ExplosionModule } from "../explosion/explosion.module";
import type { UnitProjectileController } from "../../active-map/projectiles/ProjectileController";
import type { DamageService } from "../../active-map/targeting/DamageService";

export interface FireballModuleOptions {
  scene: SceneObjectManager;
  bricks: BricksModule;
  explosions: ExplosionModule;
  projectiles: UnitProjectileController;
  damage: DamageService;
  logEvent: (message: string) => void;
}

export interface FireballState {
  targetBrickId: string;
  damage: number;
  radius: number;
  explosionRadius: number;
  sourceUnitId: string;
  trailEmitter: ParticleEmitterConfig;
  smokeEmitter: ParticleEmitterConfig;
}

export interface FireballSpawnOptions {
  sourceUnitId: string;
  sourcePosition: SceneVector2;
  targetBrickId: string;
  damage: number;
  explosionRadius: number;
  maxDistance: number;
}
