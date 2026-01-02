import type { SceneFill, SceneObjectManager, SceneVector2 } from "../../services/SceneObjectManager";
import type { BulletConfig, BulletTailConfig, BulletTailEmitterConfig, BulletType } from "../../../db/bullets-db";
import type { ExplosionModule } from "../explosion/explosion.module";
import type { ExplosionType } from "../../../db/explosions-db";
import type { MapRunState } from "../map/MapRunState";

export interface BulletCustomData {
  type: BulletType;
  tail: BulletTailConfig;
  tailEmitter?: BulletTailEmitterConfig;
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
