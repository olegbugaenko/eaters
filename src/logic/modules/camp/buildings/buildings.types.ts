import type { DataBridge } from "../../../core/DataBridge";
import type { BuildingId } from "../../../../db/buildings-db";
import type { BonusesModule } from "../../shared/bonuses/bonuses.module";
import type { ResourcesModule } from "../../shared/resources/resources.module";
import type { UnlockService } from "../../../services/unlock/UnlockService";
import type { SkillId } from "../../../../db/skills-db";
import type { BonusEffectPreview } from "@shared/types/bonuses";

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
}

export interface BuildingsModuleOptions {
  readonly bridge: DataBridge;
  readonly resources: ResourcesModule;
  readonly bonuses: BonusesModule;
  readonly unlocks: UnlockService;
  readonly getSkillLevel: (id: SkillId) => number;
}

export interface BuildingsSaveData {
  readonly levels?: Partial<Record<BuildingId, number>>;
}

export interface BuildingsModuleUiApi {
  tryUpgradeBuilding(id: BuildingId): boolean;
}

declare module "@/logic/core/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    buildings: BuildingsModuleUiApi;
  }
}
