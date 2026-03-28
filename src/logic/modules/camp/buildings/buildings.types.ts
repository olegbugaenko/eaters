import type { DataBridge } from "@/core/logic/ui/DataBridge";
import type { BuildingId } from "../../../../db/buildings-db";
import type { BonusesModule } from "../../shared/bonuses/bonuses.module";
import type { ResourcesModule } from "../../shared/resources/resources.module";
import type { UnlockService } from "../../../services/unlock/UnlockService";
import type { SkillId } from "../../../../db/skills-db";
import type { BonusEffectPreview } from "@shared/types/bonuses";
import type { NewUnlockNotificationService } from "@logic/services/new-unlock-notification/NewUnlockNotification";
import type { LocalizationService } from "@logic/services/localization/LocalizationService";

export interface BuildingWorkshopItemState {
  readonly id: BuildingId;
  readonly name: string;
  readonly description: string;
  readonly level: number;
  readonly maxLevel: number | null;
  readonly maxed: boolean;
  readonly available: boolean;
  readonly nextCost: Record<string, number> | null;
  readonly bonusEffects: readonly BonusEffectPreview[];
}

export interface BuildingsWorkshopBridgeState {
  readonly unlocked: boolean;
  readonly buildings: readonly BuildingWorkshopItemState[];
  readonly hideMaxedWorkshop?: boolean;
  readonly showHiddenWorkshop?: boolean;
  readonly hiddenBuildingIds?: readonly BuildingId[];
}

export interface BuildingsModuleOptions {
  readonly bridge: DataBridge;
  readonly resources: ResourcesModule;
  readonly bonuses: BonusesModule;
  readonly unlocks: UnlockService;
  readonly newUnlocks: NewUnlockNotificationService;
  readonly getSkillLevel: (id: SkillId) => number;
  readonly localization?: LocalizationService;
}

export interface BuildingsSaveData {
  readonly levels?: Partial<Record<BuildingId, number>>;
  readonly hideMaxedWorkshop?: boolean;
  readonly showHiddenWorkshop?: boolean;
  readonly hiddenBuildingIds?: BuildingId[];
}

export interface BuildingsModuleUiApi {
  tryUpgradeBuilding(id: BuildingId): boolean;
  setHideMaxedWorkshop(value: boolean): void;
  setShowHiddenWorkshop(value: boolean): void;
  setBuildingHidden(id: BuildingId, hidden: boolean): void;
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    buildings: BuildingsModuleUiApi;
  }
}
