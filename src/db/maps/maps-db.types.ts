import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { PlayerUnitType } from "../player-units-db";
import type { EnemyType } from "../enemies-db";
import type { EnemySpawnData } from "../../logic/modules/active-map/enemies/enemies.types";
import type { UnlockCondition } from "@shared/types/unlocks";
import type { SkillId } from "../skills-db";
import type { AchievementId } from "../achievements-db";
import type { MapEffectId } from "../map-effects-db";
import type { BrickShapeBlueprint } from "../../logic/services/brick-layout/BrickLayoutService";
import type { ParticleEmitterConfig } from "../../logic/interfaces/visuals/particle-emitters-config";

export type MapId =
  | "tutorialZone"
  | "trainingGrounds"
  | "foundations"
  | "initial"
  | "turretRings"
  | "thicket"
  | "oldForge"
  | "spruce"
  | "deadOak"
  | "theWheel"
  | "sphinx"
  | "spiralSleeves"
  | "stoneCottage"
  | "bezierGrove"
  | "snakeNest"
  | "wire"
  | "coil"
  | "mine"
  | "adit"
  | "silverRing"
  | "portalRing"
  | "frozenForest"
  | "volcano"
  | "megaBrick"
  | "ancientPyramids"
  | "deathfulGuns"
  | "deadlyTunnels"
  | "encagedBeast"
  | "greatOctopus"
  | "coalConvoy"
  | "gear"
  | "uranium_fields";

export interface MapBrickGeneratorOptions {
  readonly mapLevel: number;
}

export type MapBrickGenerator = (
  options: MapBrickGeneratorOptions,
) => readonly BrickShapeBlueprint[];

export interface MapEnemyGeneratorOptions {
  readonly mapLevel: number;
}

export type MapEnemyGenerator = (
  options: MapEnemyGeneratorOptions,
) => readonly EnemySpawnData[];

export interface MapNodePosition {
  readonly x: number;
  readonly y: number;
}

export interface MapEnemySpawnTypeConfig {
  readonly type: EnemyType;
  readonly weight: number;
  readonly minLevel?: number;
  readonly maxLevel?: number;
}

export interface MapEnemySpawnPointConfig {
  readonly position: SceneVector2;
  readonly spawnRate: number;
  readonly enemyTypes: readonly MapEnemySpawnTypeConfig[];
  readonly maxConcurrent?: number;
  readonly enabled?: boolean;
  readonly levelOffset?: number;
}

export interface MapConfig {
  readonly name: string;
  readonly size: SceneSize;
  readonly bricks: MapBrickGenerator;
  readonly playerUnits?: readonly MapPlayerUnitConfig[];
  readonly spawnPoints?: readonly SceneVector2[];
  readonly enemySpawnPoints?: readonly MapEnemySpawnPointConfig[];
  readonly enemies?: MapEnemyGenerator;
  readonly mapEffects?: readonly MapEffectId[];
  readonly visualEffects?: MapVisualEffectsConfig;
  readonly unlockedBy?: readonly UnlockCondition<MapId, SkillId>[];
  readonly icon?: string;
  readonly nodePosition: MapNodePosition;
  readonly mapsRequired?: Partial<Record<MapId, number>>;
  readonly maxLevel: number;
  readonly resourceMultiplier?: number;
  readonly achievementId?: AchievementId;
  readonly lockedForDemo?: boolean;
}

export interface MapListEntry {
  readonly id: MapId;
  readonly name: string;
  readonly size: SceneSize;
  readonly icon?: string;
}

export interface MapPlayerUnitConfig {
  readonly type: PlayerUnitType;
  readonly position: SceneVector2;
}

export interface MapSnowfallSpawnArea {
  readonly height: number;
  readonly horizontalPadding: number;
  readonly topOffset?: number;
}

export interface MapSnowfallEffectConfig {
  readonly emitter: ParticleEmitterConfig;
  readonly spawnArea?: MapSnowfallSpawnArea;
  readonly cullPadding?: number;
}

export interface MapVisualEffectsConfig {
  readonly snowfall?: MapSnowfallEffectConfig;
}
