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
import type { BonusesModule } from "../../shared/bonuses/bonuses.module";
import type { StatusEffectsModule } from "../status-effects/status-effects.module";
import type { ArcModule } from "../../scene/arc/arc.module";
import type { DarkResearchModule } from "@logic/modules/camp/dark-research/dark-research.module";

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
  readonly spawnSourceId?: string;
  readonly linkedEnemyIds?: readonly string[];
  readonly bodyEnemyId?: string;
  readonly tentacleIndex?: number;
  readonly segmentIndex?: number;
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
  lockRotation: boolean;
  selfKnockBackDistance: number;
  selfKnockBackSpeed: number;
  reward?: ResourceStockpile;
  soulReward?: number;
  spawnSourceId?: string;
}

export interface EnemyResourceCollector {
  grantResources(amount: ResourceStockpile, options?: { includeInRunSummary?: boolean }): void;
}

export interface InternalEnemyState extends EnemyRuntimeState {
  sceneObjectId: string;
  movementId: string;
  fill?: SceneFill;
  stroke?: SceneStroke;
  knockback: EnemyKnockbackState | null;
  linkedEnemyIds?: string[];
  bodyEnemyId?: string;
  tentacleIndex?: number;
  segmentIndex?: number;
  visualRotationSpin?: {
    radiansPerSec: number;
    rotationRad: number;
  };
}

export interface EnemyKnockbackState {
  initialOffset: SceneVector2;
  currentOffset: SceneVector2;
  elapsed: number;
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
  readonly resources: EnemyResourceCollector;
  readonly bonuses: BonusesModule;
  readonly targeting?: TargetingService;
  readonly damage?: DamageService;
  readonly explosions?: ExplosionModule;
  readonly projectiles?: UnitProjectileController;
  readonly arcs?: ArcModule;
  readonly bricks: BricksModule;
  readonly statusEffects: StatusEffectsModule;
  readonly darkResearch?: DarkResearchModule;
  readonly obstacles?: ObstacleProvider;
  readonly pathfinder?: PathfindingService;
}
