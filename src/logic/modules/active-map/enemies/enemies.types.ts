import type { SceneFill, SceneStroke, SceneVector2 } from "../../../services/scene-object-manager/scene-object-manager.types";
import type { DataBridge } from "../../../core/DataBridge";
import type { SceneObjectManager } from "../../../services/scene-object-manager/SceneObjectManager";
import type { MapRunState } from "../map/MapRunState";
import type { TargetingService } from "../targeting/TargetingService";
import type { DamageService } from "../targeting/DamageService";
import type { ExplosionModule } from "../../scene/explosion/explosion.module";
import type { ResourceStockpile } from "../../../../db/resources-db";
import type { TargetType } from "../targeting/targeting.types";

export type EnemyType = "enemy" | TargetType;

export interface EnemyBlueprint {
  readonly type: EnemyType;
  readonly maxHp: number;
  readonly armor: number;
  readonly baseDamage: number;
  readonly attackInterval: number;
  readonly attackRange?: number;
  readonly moveSpeed: number;
  readonly physicalSize: number;
  readonly fill?: SceneFill;
  readonly stroke?: SceneStroke;
  readonly reward?: ResourceStockpile;
}

export interface EnemySpawnData {
  readonly id?: string;
  readonly blueprint: EnemyBlueprint;
  readonly position: SceneVector2;
  readonly rotation?: number;
  readonly hp?: number;
  readonly attackCooldown?: number;
}

export interface EnemyRuntimeState {
  id: string;
  type: EnemyType;
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
  fill?: SceneFill;
  stroke?: SceneStroke;
}

export interface EnemySaveData {
  readonly enemies: EnemySpawnData[];
}

export interface EnemiesModuleOptions {
  readonly scene: SceneObjectManager;
  readonly bridge: DataBridge;
  readonly runState: MapRunState;
  readonly targeting?: TargetingService;
  readonly damage?: DamageService;
  readonly explosions?: ExplosionModule;
}
