import type { PlayerUnitType } from "../../../../db/player-units-db";
import type { UnitDesignId, UnitDesignModuleDetail } from "../../camp/unit-design/unit-design.types";
import type { ResourceAmountMap } from "../../../../types/resources";
import type { PlayerUnitBlueprintStats, PlayerUnitRuntimeModifiers } from "../../../../types/player-units";

/**
 * Resource meter for necromancer resources (mana/sanity).
 */
export interface NecromancerResourceMeter {
  current: number;
  max: number;
}

/**
 * Payload for necromancer resources bridge.
 */
export interface NecromancerResourcesPayload {
  mana: NecromancerResourceMeter;
  sanity: NecromancerResourceMeter;
}

/**
 * Snapshot of necromancer resources with regeneration info.
 */
export interface NecromancerResourceSnapshot {
  mana: NecromancerResourceMeter & { regenPerSecond: number };
  sanity: NecromancerResourceMeter;
}

/**
 * Spawn option for necromancer units.
 */
export interface NecromancerSpawnOption {
  designId: UnitDesignId;
  type: PlayerUnitType;
  name: string;
  cost: ResourceAmountMap;
  blueprint: PlayerUnitBlueprintStats;
  modules: readonly UnitDesignModuleDetail[];
  runtime: PlayerUnitRuntimeModifiers;
}

/**
 * Internal module options interface.
 */
export interface NecromancerModuleOptions {
  bridge: import("../../../core/DataBridge").DataBridge;
  playerUnits: import("../player-units/player-units.module").PlayerUnitsModule;
  scene: import("../../../services/scene-object-manager/SceneObjectManager").SceneObjectManager;
  bonuses: import("../../shared/bonuses/bonuses.module").BonusesModule;
  unitDesigns: import("../../camp/unit-design/unit-design.module").UnitDesignModule;
  runState: import("../map/MapRunState").MapRunState;
}

/**
 * Save data structure for necromancer module.
 */
export interface NecromancerSaveData {
  mana: number;
  sanity: number;
}

/**
 * Internal resource state.
 */
export interface ResourceState {
  current: number;
  max: number;
  regenPerSecond: number;
}
