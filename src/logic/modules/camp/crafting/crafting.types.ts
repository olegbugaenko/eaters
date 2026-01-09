import type { DataBridge } from "../../../core/DataBridge";
import type { CraftingRecipeId } from "../../../../db/crafting-recipes-db";
import type { ResourceId } from "../../../../db/resources-db";
import type { ResourcesModule } from "../../shared/resources/resources.module";
import type { UnlockService } from "../../../services/unlock/UnlockService";
import type { BonusesModule } from "../../shared/bonuses/bonuses.module";

export interface CraftingRecipeBridgeState {
  readonly id: CraftingRecipeId;
  readonly name: string;
  readonly productId: ResourceId;
  readonly productName: string;
  readonly productAmount: number;
  readonly cost: Record<string, number>;
  readonly queue: number;
  readonly inProgress: boolean;
  readonly progress: number;
  readonly durationMs: number;
  readonly maxQueue: number;
  readonly waitingForResources: boolean;
}

export interface CraftingBridgeState {
  readonly unlocked: boolean;
  readonly recipes: readonly CraftingRecipeBridgeState[];
}

export interface CraftingModuleOptions {
  readonly bridge: DataBridge;
  readonly resources: ResourcesModule;
  readonly unlocks: UnlockService;
  readonly bonuses: BonusesModule;
}

export interface CraftingRecipeRuntimeState {
  queue: number;
  progressMs: number;
  inProgress: boolean;
}

export interface CraftingRecipeSaveState {
  readonly queue?: number;
  readonly progressMs?: number;
  readonly inProgress?: boolean;
}

export interface CraftingModuleSaveData {
  readonly recipes?: Partial<Record<CraftingRecipeId, CraftingRecipeSaveState>>;
}

export interface CraftingModuleUiApi {
  setRecipeQueue(id: CraftingRecipeId, value: number): void;
  adjustRecipeQueue(id: CraftingRecipeId, delta: number): void;
  setRecipeQueueToMax(id: CraftingRecipeId): void;
}

declare module "@/logic/core/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    crafting: CraftingModuleUiApi;
  }
}
