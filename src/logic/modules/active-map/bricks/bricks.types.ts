import type { SceneVector2, SceneFill, SceneColor } from "../../../services/scene-object-manager/scene-object-manager.types";
import type { BrickType } from "../../../../db/bricks-db";
import type { ExplosionType } from "../../../../db/explosions-db";
import type { ResourceStockpile } from "../../../../db/resources-db";
import type { SoundEffectPlayer } from "../../shared/audio/audio.types";
import type { SceneObjectManager } from "../../../services/scene-object-manager/SceneObjectManager";
import type { DataBridge } from "../../../core/DataBridge";
import type { ExplosionModule } from "../../scene/explosion/explosion.module";
import type { BonusesModule } from "../../shared/bonuses/bonuses.module";
import type { MapRunState } from "../map/MapRunState";
import type { StatisticsTracker } from "../../shared/statistics/statistics.module";
import type { TargetingService } from "../targeting/TargetingService";
import type { PassabilityTag } from "@/logic/shared/navigation/passability.types";

export interface ResourceCollector {
  grantResources(amount: ResourceStockpile, options?: { includeInRunSummary?: boolean }): void;
  notifyBrickDestroyed(): void;
}

export interface BrickData {
  position: SceneVector2;
  rotation: number;
  type: BrickType;
  level: number;
  hp?: number;
}

export interface BrickRuntimeState {
  id: string;
  type: BrickType;
  position: SceneVector2;
  rotation: number;
  level: number;
  hp: number;
  maxHp: number;
  armor: number;
  baseDamage: number;
  brickKnockBackDistance: number;
  brickKnockBackSpeed: number;
  brickKnockBackAmplitude: number;
  physicalSize: number;
  rewards: ResourceStockpile;
  passableFor?: readonly PassabilityTag[];
}

export interface BricksModuleOptions {
  scene: SceneObjectManager;
  bridge: DataBridge;
  explosions: ExplosionModule;
  resources: ResourceCollector;
  bonuses: BonusesModule;
  runState: MapRunState;
  targeting?: TargetingService;
  audio?: SoundEffectPlayer;
  statistics?: StatisticsTracker;
}

export interface BrickSaveData {
  bricks: BrickData[];
}

export interface InternalBrickState extends BrickRuntimeState {
  sceneObjectId: string;
  damageExplosion?: BrickExplosionState;
  destructionExplosion?: BrickExplosionState;
  knockback: BrickKnockbackState | null;
  baseFill: SceneFill;
  appliedFill: SceneFill;
  activeTint: BrickEffectTint | null;
}

export interface BrickExplosionState {
  type: ExplosionType;
  initialRadius: number;
}

export interface BrickKnockbackState {
  initialOffset: SceneVector2;
  currentOffset: SceneVector2;
  elapsed: number;
}

export interface BrickEffectTint {
  color: SceneColor;
  intensity: number;
}
