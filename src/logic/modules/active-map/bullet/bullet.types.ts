import type { SceneFill, SceneVector2 } from "../../../services/scene-object-manager/scene-object-manager.types";
import type { SceneObjectManager } from "../../../services/scene-object-manager/SceneObjectManager";
import type { BulletConfig, BulletTailConfig, BulletType } from "../../../../db/bullets-db";
import type { ParticleEmitterConfig } from "../../../interfaces/visuals/particle-emitters-config";
import type { ExplosionModule } from "../../scene/explosion/explosion.module";
import type { ExplosionType } from "../../../../db/explosions-db";
import type { MapRunState } from "../map/MapRunState";

export interface BulletCustomData {
  type: BulletType;
  tail: BulletTailConfig;
  tailEmitter?: ParticleEmitterConfig;
}

export interface BulletState {
  id: string;
  type: BulletType;
  config: BulletConfig;
  position: SceneVector2;
  velocity: SceneVector2;
  radius: number;
  fill: SceneFill;
  lifetimeMs: number;
  elapsedMs: number;
  rotation: number;
  explosionType: ExplosionType | undefined;
  customData: BulletCustomData;
}

export interface SpawnBulletByTypeOptions {
  position?: SceneVector2;
  velocity?: SceneVector2;
  rotation?: number;
  sourceUnitId?: string;
  targetBrickId?: string;
  run?: MapRunState;
  directionAngle?: number;
  lifetimeMs?: number;
}

export interface BulletModuleOptions {
  scene: SceneObjectManager;
  runState: MapRunState;
  explosions: ExplosionModule;
}
