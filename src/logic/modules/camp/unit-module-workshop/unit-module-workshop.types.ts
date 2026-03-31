import type { DataBridge } from "@/core/logic/ui/DataBridge";
import type { UnitModuleId, UnitModuleBonusType } from "../../../../db/unit-modules-db";
import type { ResourcesModule } from "../../shared/resources/resources.module";
import type { SkillId } from "../../../../db/skills-db";
import type { UnlockService } from "../../../services/unlock/UnlockService";
import type { NewUnlockNotificationService } from "@logic/services/new-unlock-notification/NewUnlockNotification";
import type { LocalizationService } from "@logic/services/localization/LocalizationService";

export interface UnitModuleWorkshopItemState {
  readonly id: UnitModuleId;
  readonly name: string;
  readonly description: string;
  readonly bonusLabel: string;
  readonly bonusType: UnitModuleBonusType;
  readonly baseBonusValue: number;
  readonly bonusPerLevel: number;
  readonly currentBonusValue: number;
  readonly bonusLines: readonly {
    label: string;
    bonusType: UnitModuleBonusType;
    currentBonusValue: number;
    nextBonusValue: number | null;
  }[];
  readonly manaCostMultiplier: number;
  readonly sanityCost: number;
  readonly level: number;
  readonly maxLevel: number | null;
  readonly maxed: boolean;
  readonly nextCost: Record<string, number> | null;
}

export interface UnitModuleWorkshopBridgeState {
  readonly unlocked: boolean;
  readonly modules: readonly UnitModuleWorkshopItemState[];
  readonly hideMaxedWorkshop?: boolean;
  readonly showHiddenWorkshop?: boolean;
  readonly hiddenModuleIds?: readonly UnitModuleId[];
}

export interface UnitModuleWorkshopModuleOptions {
  bridge: DataBridge;
  resources: ResourcesModule;
  getSkillLevel: (id: SkillId) => number;
  unlocks: UnlockService;
  newUnlocks: NewUnlockNotificationService;
  localization?: LocalizationService;
}

export interface UnitModuleWorkshopSaveData {
  readonly levels?: Partial<Record<UnitModuleId, number>>;
  readonly hideMaxedWorkshop?: boolean;
  readonly showHiddenWorkshop?: boolean;
  readonly hiddenModuleIds?: UnitModuleId[];
}

export interface UnitModuleWorkshopUiApi {
  tryUpgradeModule(id: UnitModuleId): boolean;
  setHideMaxedWorkshop(value: boolean): void;
  setShowHiddenWorkshop(value: boolean): void;
  setModuleHidden(id: UnitModuleId, hidden: boolean): void;
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    unitModuleWorkshop: UnitModuleWorkshopUiApi;
  }
}
