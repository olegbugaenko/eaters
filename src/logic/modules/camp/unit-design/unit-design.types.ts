import type { DataBridge } from "@/core/logic/ui/DataBridge";
import type { PlayerUnitType } from "../../../../db/player-units-db";
import type { UnitModuleId, UnitModuleBonusType } from "../../../../db/unit-modules-db";
import type { BonusesModule } from "../../shared/bonuses/bonuses.module";
import type { UnitModuleWorkshopModule } from "../unit-module-workshop/unit-module-workshop.module";
import type {
  PlayerUnitBlueprintStats,
  PlayerUnitRuntimeModifiers,
} from "@shared/types/player-units";
import type {
  UnitTargetingMode,
  UnitTargetingSettingsMap,
} from "@shared/types/unit-targeting";
import type { ResourceAmountMap } from "@shared/types/resources";

export type UnitDesignId = string;

export interface UnitDesignRecord {
  readonly id: UnitDesignId;
  readonly type: PlayerUnitType;
  name: string;
  modules: UnitModuleId[];
}

export interface UnitDesignModuleDetail {
  readonly id: UnitModuleId;
  readonly name: string;
  readonly description: string;
  readonly level: number;
  readonly bonusLabel: string;
  readonly bonusType: UnitModuleBonusType;
  readonly bonusValue: number;
  readonly manaCostMultiplier: number;
  readonly sanityCost: number;
}

export interface UnitDesignerUnitState {
  readonly id: UnitDesignId;
  readonly type: PlayerUnitType;
  readonly name: string;
  readonly modules: readonly UnitModuleId[];
  readonly moduleDetails: readonly UnitDesignModuleDetail[];
  readonly cost: ResourceAmountMap;
  readonly blueprint: PlayerUnitBlueprintStats;
  readonly runtime: PlayerUnitRuntimeModifiers;
  readonly targetingMode: UnitTargetingMode;
}

export interface UnitDesignerAvailableModuleState {
  readonly id: UnitModuleId;
  readonly name: string;
  readonly description: string;
  readonly level: number;
  readonly bonusLabel: string;
  readonly bonusType: UnitModuleBonusType;
  readonly bonusValue: number;
  readonly manaCostMultiplier: number;
  readonly sanityCost: number;
}

export interface UnitDesignerBridgeState {
  readonly units: readonly UnitDesignerUnitState[];
  readonly availableModules: readonly UnitDesignerAvailableModuleState[];
  readonly maxModules: number;
  readonly activeRoster: readonly UnitDesignId[];
  readonly maxActiveUnits: number;
  readonly targetingByUnit: UnitTargetingSettingsMap;
}

export interface UnitDesignerSaveDataEntry {
  readonly id: string;
  readonly type: PlayerUnitType;
  readonly name: string;
  readonly modules: UnitModuleId[];
}

export interface UnitDesignerSaveData {
  readonly units?: UnitDesignerSaveDataEntry[];
  readonly roster?: UnitDesignId[];
  readonly strategy?: UnitDesignerStrategySaveData;
}

export interface UnitDesignerStrategySaveData {
  readonly targetingModes?: Record<string, UnitTargetingMode>;
}

export interface UnitDesignModuleOptions {
  bridge: DataBridge;
  bonuses: BonusesModule;
  workshop: UnitModuleWorkshopModule;
}

export type UnitDesignerListener = (
  designs: readonly UnitDesignerUnitState[]
) => void;

export interface UnitDesignModuleUiApi {
  createDesign(type: PlayerUnitType): UnitDesignId;
  updateDesign(
    id: UnitDesignId,
    data: Partial<Pick<UnitDesignerUnitState, "name">> & { modules?: readonly UnitModuleId[] }
  ): void;
  deleteDesign(id: UnitDesignId): void;
  setActiveRoster(roster: readonly UnitDesignId[]): void;
  setDesignTargetingMode(id: UnitDesignId, mode: UnitTargetingMode): void;
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    unitDesign: UnitDesignModuleUiApi;
  }
}
