import { GameModule } from "@core/logic/types";
import type { DataBridge } from "@/core/logic/ui/DataBridge";
import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import { UnlockService } from "../../../services/unlock/UnlockService";
import { BonusesModule } from "../../shared/bonuses/bonuses.module";
import type { BonusValueMap } from "../../shared/bonuses/bonuses.types";
import { ResourcesModule } from "../../shared/resources/resources.module";
import {
  CRAFTING_RECIPE_IDS,
  CraftingRecipeConfig,
  CraftingRecipeId,
  getCraftingRecipeConfig,
} from "../../../../db/crafting-recipes-db";
import {
  ResourceId,
  ResourceStockpile,
  getResourceConfig,
  normalizeResourceAmount,
} from "../../../../db/resources-db";
import { clamp01 } from "@shared/helpers/numbers.helper";
import type {
  CraftingRecipeBridgeState,
  CraftingBridgeState,
  CraftingModuleOptions,
  CraftingRecipeRuntimeState,
  CraftingRecipeSaveState,
  CraftingModuleSaveData,
} from "./crafting.types";
import {
  DEFAULT_CRAFTING_STATE,
  CRAFTING_STATE_BRIDGE_KEY,
  PROGRESS_PUSH_INTERVAL_MS,
} from "./crafting.const";
import {
  createEmptyRuntimeState,
  sanitizeQueueValue,
  sanitizeProgressValue,
  toCostRecord,
  createProductAmount,
} from "./crafting.helpers";

export class CraftingModule implements GameModule {
  public readonly id = "crafting";

  private readonly bridge: DataBridge;
  private readonly resources: ResourcesModule;
  private readonly unlocks: UnlockService;
  private readonly bonuses: BonusesModule;

  private runtimeStates = new Map<CraftingRecipeId, CraftingRecipeRuntimeState>();
  private visibleRecipeIds: CraftingRecipeId[] = [];
  private unlocked = false;
  private progressBroadcastTimer = 0;
  private craftingSpeedMultiplier = 1;
  private craftingSpeedDirty = true;

  constructor(options: CraftingModuleOptions) {
    this.bridge = options.bridge;
    this.resources = options.resources;
    this.unlocks = options.unlocks;
    this.bonuses = options.bonuses;
    this.craftingSpeedMultiplier = this.sanitizeCraftingSpeedMultiplier(
      this.bonuses.getBonusValue("crafting_speed_mult")
    );
    this.bonuses.subscribe((values) => this.handleBonusValuesUpdated(values));
    CRAFTING_RECIPE_IDS.forEach((id) => {
      this.runtimeStates.set(id, createEmptyRuntimeState());
    });
  }

  public initialize(): void {
    this.refreshVisibility();
    this.pushState();
  }

  public reset(): void {
    this.runtimeStates.forEach((state) => {
      state.queue = 0;
      state.inProgress = false;
      state.progressMs = 0;
    });
    this.refreshVisibility();
    this.pushState();
    this.craftingSpeedDirty = true;
  }

  public load(data: unknown | undefined): void {
    this.applySaveData(data);
    this.refreshVisibility();
    this.pushState();
  }

  public save(): unknown {
    const serialized: Partial<Record<CraftingRecipeId, CraftingRecipeSaveState>> = {};
    this.runtimeStates.forEach((state, id) => {
      if (state.queue <= 0 && !state.inProgress) {
        return;
      }
      serialized[id] = {
        queue: state.queue,
        progressMs: state.progressMs > 0 ? state.progressMs : undefined,
        inProgress: state.inProgress || undefined,
      };
    });
    if (Object.keys(serialized).length === 0) {
      return {} satisfies CraftingModuleSaveData;
    }
    return { recipes: serialized } satisfies CraftingModuleSaveData;
  }

  public tick(deltaMs: number): void {
    const clampedDelta = Math.max(0, deltaMs);
    let stateChanged = false;

    if (this.craftingSpeedDirty) {
      stateChanged = true;
      this.craftingSpeedDirty = false;
    }

    CRAFTING_RECIPE_IDS.forEach((id) => {
      const config = getCraftingRecipeConfig(id);
      const state = this.getRuntimeState(id);
      const available = this.unlocks.areConditionsMet(config.unlockedBy ?? []);
      const duration = this.getRecipeDuration(config);

      if (state.inProgress) {
        if (state.queue <= 0) {
          this.cancelActiveRecipe(id, state, config);
          stateChanged = true;
          return;
        }
        state.progressMs += clampedDelta;
        if (state.progressMs >= duration) {
          this.completeRecipe(id, state, config);
          stateChanged = true;
        }
        return;
      }

      if (state.queue > 0) {
        if (!available) {
          state.progressMs = 0;
          return;
        }
        if (this.tryStartRecipe(config)) {
          state.inProgress = true;
          state.progressMs = 0;
          stateChanged = true;
        }
      } else {
        state.progressMs = 0;
      }
    });

    const visibilityChanged = this.refreshVisibility();
    const hasActiveRecipe = this.hasRecipeInProgress();
    if (hasActiveRecipe) {
      this.progressBroadcastTimer += clampedDelta;
    } else {
      this.progressBroadcastTimer = 0;
    }

    const periodicUpdate =
      hasActiveRecipe && this.progressBroadcastTimer >= PROGRESS_PUSH_INTERVAL_MS;

    if (visibilityChanged || stateChanged || periodicUpdate) {
      this.pushState();
      this.progressBroadcastTimer = 0;
    }
  }

  public setRecipeQueue(id: CraftingRecipeId, value: number): void {
    if (!CRAFTING_RECIPE_IDS.includes(id)) {
      return;
    }
    const config = getCraftingRecipeConfig(id);
    const state = this.getRuntimeState(id);
    const sanitized = Math.max(0, Math.floor(value));

    if (sanitized === state.queue && !(sanitized === 0 && state.inProgress)) {
      return;
    }

    state.queue = sanitized;
    if (state.queue === 0 && state.inProgress) {
      this.cancelActiveRecipe(id, state, config, true);
    }

    this.refreshVisibility();
    this.pushState();
  }

  public adjustRecipeQueue(id: CraftingRecipeId, delta: number): void {
    if (!CRAFTING_RECIPE_IDS.includes(id)) {
      return;
    }
    const state = this.getRuntimeState(id);
    const sanitizedDelta = Math.trunc(delta);
    const nextValue = state.queue + sanitizedDelta;
    this.setRecipeQueue(id, nextValue);
  }

  public setRecipeQueueToMax(id: CraftingRecipeId): void {
    if (!CRAFTING_RECIPE_IDS.includes(id)) {
      return;
    }
    const state = this.getRuntimeState(id);
    const totals = this.resources.getTotals();
    const maxQueue = this.computeMaxQueue(id, state, totals);
    this.setRecipeQueue(id, maxQueue);
  }

  public getRecipeQueue(id: CraftingRecipeId): number {
    return this.getRuntimeState(id).queue;
  }

  private tryStartRecipe(config: CraftingRecipeConfig): boolean {
    return this.resources.spendResources(config.ingredients);
  }

  private completeRecipe(
    id: CraftingRecipeId,
    state: CraftingRecipeRuntimeState,
    config: CraftingRecipeConfig
  ): void {
    const reward = createProductAmount(config.productId, config.productAmount);
    this.resources.grantResources(reward, { includeInRunSummary: false });
    state.queue = Math.max(0, state.queue - 1);
    state.inProgress = false;
    state.progressMs = 0;
  }

  private cancelActiveRecipe(
    id: CraftingRecipeId,
    state: CraftingRecipeRuntimeState,
    config: CraftingRecipeConfig,
    refund = false
  ): void {
    state.inProgress = false;
    state.progressMs = 0;
    if (refund) {
      this.resources.grantResources(config.ingredients, { includeInRunSummary: false });
    }
  }

  private computeMaxQueue(
    id: CraftingRecipeId,
    state: CraftingRecipeRuntimeState,
    totals: ResourceStockpile
  ): number {
    const config = getCraftingRecipeConfig(id);
    const normalized = normalizeResourceAmount(config.ingredients);
    let maxAdditional = Infinity;
    (Object.keys(normalized) as ResourceId[]).forEach((resourceId) => {
      const cost = normalized[resourceId];
      if (cost <= 0) {
        return;
      }
      const available = totals[resourceId] ?? 0;
      const possible = Math.floor(available / cost);
      if (possible < maxAdditional) {
        maxAdditional = possible;
      }
    });
    if (!Number.isFinite(maxAdditional)) {
      maxAdditional = 0;
    }
    const active = state.inProgress ? 1 : 0;
    return Math.max(active, active + Math.max(0, maxAdditional));
  }

  private refreshVisibility(): boolean {
    const visible = CRAFTING_RECIPE_IDS.filter((id) => {
      const config = getCraftingRecipeConfig(id);
      const state = this.getRuntimeState(id);
      if (state.queue > 0 || state.inProgress) {
        return true;
      }
      return this.unlocks.areConditionsMet(config.unlockedBy ?? []);
    });
    const unlocked = visible.length > 0;
    const changed =
      unlocked !== this.unlocked ||
      visible.length !== this.visibleRecipeIds.length ||
      visible.some((id, index) => this.visibleRecipeIds[index] !== id);
    if (changed) {
      this.unlocked = unlocked;
      this.visibleRecipeIds = visible;
    }
    return changed;
  }

  private pushState(): void {
    const totals = this.resources.getTotals();
    const payload: CraftingBridgeState = {
      unlocked: this.unlocked,
      recipes: this.visibleRecipeIds.map((id) => this.createRecipePayload(id, totals)),
    };
    DataBridgeHelpers.pushState(this.bridge, CRAFTING_STATE_BRIDGE_KEY, payload);
  }

  private hasRecipeInProgress(): boolean {
    return CRAFTING_RECIPE_IDS.some((id) => this.getRuntimeState(id).inProgress);
  }

  private createRecipePayload(
    id: CraftingRecipeId,
    totals: ResourceStockpile
  ): CraftingRecipeBridgeState {
    const config = getCraftingRecipeConfig(id);
    const state = this.getRuntimeState(id);
    const cost = toCostRecord(config.ingredients);
    const duration = this.getRecipeDuration(config);
    const progress = state.inProgress ? clamp01(state.progressMs / duration) : 0;
    const maxQueue = this.computeMaxQueue(id, state, totals);
    const available = this.unlocks.areConditionsMet(config.unlockedBy ?? []);
    const waitingForResources =
      state.queue > 0 &&
      !state.inProgress &&
      (!available || !this.resources.canAfford(config.ingredients));

    const productConfig = getResourceConfig(config.productId);

    return {
      id,
      name: config.name,
      productId: config.productId,
      productName: productConfig.name,
      productAmount: config.productAmount,
      cost,
      queue: state.queue,
      inProgress: state.inProgress,
      progress,
      durationMs: duration,
      maxQueue,
      waitingForResources,
    };
  }

  private getRuntimeState(id: CraftingRecipeId): CraftingRecipeRuntimeState {
    let state = this.runtimeStates.get(id);
    if (!state) {
      state = createEmptyRuntimeState();
      this.runtimeStates.set(id, state);
    }
    return state;
  }

  private applySaveData(data: unknown | undefined): void {
    this.runtimeStates.forEach((state) => {
      state.queue = 0;
      state.progressMs = 0;
      state.inProgress = false;
    });

    if (!data || typeof data !== "object") {
      return;
    }

    const raw = data as CraftingModuleSaveData;
    const recipes = raw.recipes ?? {};

    (Object.keys(recipes) as CraftingRecipeId[]).forEach((id) => {
      if (!CRAFTING_RECIPE_IDS.includes(id)) {
        return;
      }
      const config = getCraftingRecipeConfig(id);
      const entry = recipes[id];
      if (!entry) {
        return;
      }
      const state = this.getRuntimeState(id);
      const queue = sanitizeQueueValue(entry.queue);
      const duration = this.getRecipeDuration(config);
      const progress = sanitizeProgressValue(entry.progressMs, duration);
      const inProgress = Boolean(entry.inProgress) && queue > 0;

      state.queue = inProgress ? Math.max(queue, 1) : queue;
      state.inProgress = inProgress;
      state.progressMs = inProgress ? progress : 0;
    });
  }

  private handleBonusValuesUpdated(values: BonusValueMap): void {
    const multiplier = this.sanitizeCraftingSpeedMultiplier(
      values.crafting_speed_mult ?? this.craftingSpeedMultiplier
    );
    if (Math.abs(multiplier - this.craftingSpeedMultiplier) < 1e-9) {
      return;
    }
    this.craftingSpeedMultiplier = multiplier;
    this.onCraftingSpeedMultiplierChanged();
  }

  private onCraftingSpeedMultiplierChanged(): void {
    this.craftingSpeedDirty = true;
    this.progressBroadcastTimer = 0;
    CRAFTING_RECIPE_IDS.forEach((id) => {
      const state = this.getRuntimeState(id);
      if (!state.inProgress) {
        return;
      }
      const config = getCraftingRecipeConfig(id);
      const duration = this.getRecipeDuration(config);
      if (state.progressMs > duration) {
        state.progressMs = duration;
      }
    });
  }

  private getRecipeDuration(config: CraftingRecipeConfig): number {
    const multiplier = this.craftingSpeedMultiplier;
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      return Math.max(1, Math.round(config.baseDurationMs));
    }
    const adjusted = config.baseDurationMs / multiplier;
    return Math.max(1, Math.round(adjusted));
  }

  private sanitizeCraftingSpeedMultiplier(value: number | undefined): number {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) {
      return 1;
    }
    return value ?? 1;
  }
}
