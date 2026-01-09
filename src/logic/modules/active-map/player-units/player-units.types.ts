import type { SceneVector2 } from "../../../services/scene-object-manager/scene-object-manager.types";
import type { PlayerUnitType } from "../../../../db/player-units-db";
import type { UnitModuleId } from "../../../../db/unit-modules-db";
import type { PlayerUnitRuntimeModifiers } from "@shared/types/player-units";
import type { UnitDesignId } from "../../camp/unit-design/unit-design.types";
import type { SceneObjectManager } from "../../../services/scene-object-manager/SceneObjectManager";
import type { DataBridge } from "@/core/logic/ui/DataBridge";
import type { MovementService } from "../../../services/movement/MovementService";
import type { BricksModule } from "../bricks/bricks.module";
import type { BonusesModule } from "../../shared/bonuses/bonuses.module";
import type { ExplosionModule } from "../../scene/explosion/explosion.module";
import type { UnitProjectileController } from "../projectiles/ProjectileController";
import type { ArcModule } from "../../scene/arc/arc.module";
import type { EffectsModule } from "../../scene/effects/effects.module";
import type { FireballModule } from "../../scene/fireball/fireball.module";
import type { UnitDesignModule } from "../../camp/unit-design/unit-design.module";
import type { SkillId } from "../../../../db/skills-db";
import type { UnitTargetingMode } from "@shared/types/unit-targeting";
import type { StatisticsTracker } from "../../shared/statistics/statistics.module";
import type { MapRunState } from "../map/MapRunState";
import type { AbilitySoundPlayer } from "./PlayerUnitAbilities";
import type { TargetingService } from "../targeting/TargetingService";
import type { DamageService } from "../targeting/DamageService";
import type { EnemiesModule } from "../enemies/enemies.module";
import type { StatusEffectsModule } from "../status-effects/status-effects.module";

export interface PlayerUnitSpawnData {
  readonly designId?: UnitDesignId;
  readonly type: PlayerUnitType;
  readonly position: SceneVector2;
  readonly hp?: number;
  readonly attackCooldown?: number;
  readonly runtimeModifiers?: PlayerUnitRuntimeModifiers;
  readonly equippedModules?: UnitModuleId[];
}

export interface PlayerUnitsModuleOptions {
  scene: SceneObjectManager;
  bricks: BricksModule;
  bridge: DataBridge;
  movement: MovementService;
  bonuses: BonusesModule;
  explosions: ExplosionModule;
  statusEffects: StatusEffectsModule;
  projectiles: UnitProjectileController;
  targeting?: TargetingService;
  damage?: DamageService;
  enemies?: EnemiesModule;
  arcs?: ArcModule;
  effects?: EffectsModule;
  fireballs?: FireballModule;
  unitDesign?: UnitDesignModule;
  onAllUnitsDefeated?: () => void;
  getModuleLevel: (id: UnitModuleId) => number;
  hasSkill: (id: SkillId) => boolean;
  getDesignTargetingMode: (
    designId: UnitDesignId | null,
    type: PlayerUnitType
  ) => UnitTargetingMode;
  statistics?: StatisticsTracker;
  audio?: AbilitySoundPlayer;
  runState: MapRunState;
}

export interface PlayerUnitSaveData {
  readonly units: PlayerUnitSpawnData[];
}
