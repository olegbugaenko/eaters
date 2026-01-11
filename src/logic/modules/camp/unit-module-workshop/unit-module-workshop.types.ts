import type { DataBridge } from "@/core/logic/ui/DataBridge";
import type { UnitModuleId, UnitModuleBonusType } from "../../../../db/unit-modules-db";
import type { ResourcesModule } from "../../shared/resources/resources.module";
import type { SkillId } from "../../../../db/skills-db";
import type { UnlockService } from "../../../services/unlock/UnlockService";

export interface UnitModuleWorkshopItemState {
  readonly id: UnitModuleId;
  readonly name: string;
  readonly description: string;
  readonly bonusLabel: string;
  readonly bonusType: UnitModuleBonusType;
  readonly baseBonusValue: number;
  readonly bonusPerLevel: number;
  readonly currentBonusValue: number;
  readonly manaCostMultiplier: number;
  readonly sanityCost: number;
  readonly level: number;
  readonly nextCost: Record<string, number> | null;
}

export interface UnitModuleWorkshopBridgeState {
  readonly unlocked: boolean;
  readonly modules: readonly UnitModuleWorkshopItemState[];
}

export interface UnitModuleWorkshopModuleOptions {
  bridge: DataBridge;
  resources: ResourcesModule;
  getSkillLevel: (id: SkillId) => number;
  unlocks: UnlockService;
}

export interface UnitModuleWorkshopSaveData {
  readonly levels?: Partial<Record<UnitModuleId, number>>;
}

export interface UnitModuleWorkshopUiApi {
  tryUpgradeModule(id: UnitModuleId): boolean;
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    unitModuleWorkshop: UnitModuleWorkshopUiApi;
  }
}
