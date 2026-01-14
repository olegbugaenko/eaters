import type {
  SceneFill,
  SceneStroke,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { DataBridge } from "@/core/logic/ui/DataBridge";
import type { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { MapRunState } from "../map/MapRunState";
import type { TargetingService } from "../targeting/TargetingService";
import type { DamageService } from "../targeting/DamageService";
import type { ExplosionModule } from "../../scene/explosion/explosion.module";
import type { ResourceStockpile } from "../../../../db/resources-db";
import type { EnemyType } from "../../../../db/enemies-db";
import type { UnitProjectileController } from "../projectiles/ProjectileController";
import type { ObstacleProvider } from "@/logic/shared/navigation/navigation.types";
import type { PathfindingService } from "@/logic/shared/navigation/PathfindingService";
import type { BricksModule } from "../bricks/bricks.module";
import type { StatusEffectsModule } from "../status-effects/status-effects.module";
import type { ArcModule } from "../../scene/arc/arc.module";

export interface AttackSeriesState {
  remainingShots: number;
  cooldownMs: number;
  intervalMs: number;
}

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
  attackSeriesState?: AttackSeriesState;
  moveSpeed: number;
  physicalSize: number;
  selfKnockBackDistance: number;
  selfKnockBackSpeed: number;
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

import type { MovementService } from "@core/logic/provided/services/movement/MovementService";

export interface EnemiesModuleOptions {
  readonly scene: SceneObjectManager;
  readonly bridge: DataBridge;
  readonly runState: MapRunState;
  readonly movement: MovementService;
  readonly targeting?: TargetingService;
  readonly damage?: DamageService;
  readonly explosions?: ExplosionModule;
  readonly projectiles?: UnitProjectileController;
  readonly arcs?: ArcModule;
  readonly bricks: BricksModule;
  readonly statusEffects: StatusEffectsModule;
  readonly obstacles?: ObstacleProvider;
  readonly pathfinder?: PathfindingService;
}
