import type { SceneFill, SceneStroke, SceneVector2 } from "../../../services/scene-object-manager/scene-object-manager.types";
import type { DataBridge } from "../../../core/DataBridge";
import type { SceneObjectManager } from "../../../services/scene-object-manager/SceneObjectManager";
import type { MapRunState } from "../map/MapRunState";
import type { TargetingService } from "../targeting/TargetingService";
import type { DamageService } from "../targeting/DamageService";
import type { ExplosionModule } from "../../scene/explosion/explosion.module";
import type { ResourceStockpile } from "../../../../db/resources-db";
import type { EnemyType } from "../../../../db/enemies-db";
import type { UnitProjectileController } from "../projectiles/ProjectileController";

export interface EnemySpawnData {
  readonly id?: string;
  readonly type: EnemyType;
  readonly level?: number;
  readonly position: SceneVector2;
  readonly rotation?: number;
  readonly hp?: number;
  readonly attackCooldown?: number;
}

export interface EnemyRuntimeState {
  id: string;
  type: EnemyType;
  level: number;
  position: SceneVector2;
  rotation: number;
  hp: number;
  maxHp: number;
  armor: number;
  baseDamage: number;
  attackInterval: number;
  attackCooldown: number;
  attackRange: number;
  moveSpeed: number;
  physicalSize: number;
  reward?: ResourceStockpile;
}

export interface InternalEnemyState extends EnemyRuntimeState {
  sceneObjectId: string;
  movementId: string;
  fill?: SceneFill;
  stroke?: SceneStroke;
}

export interface EnemySaveData {
  readonly enemies: EnemySpawnData[];
}

import type { MovementService } from "../../../services/movement/MovementService";

export interface EnemiesModuleOptions {
  readonly scene: SceneObjectManager;
  readonly bridge: DataBridge;
  readonly runState: MapRunState;
  readonly movement: MovementService;
  readonly targeting?: TargetingService;
  readonly damage?: DamageService;
  readonly explosions?: ExplosionModule;
  readonly projectiles?: UnitProjectileController;
}
