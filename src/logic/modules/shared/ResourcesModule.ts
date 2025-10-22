import { DataBridge } from "../../core/DataBridge";
import { GameModule } from "../../core/types";
import { UnlockService } from "../../services/UnlockService";
import { BonusesModule } from "./BonusesModule";
import { BonusId } from "../../../db/bonuses-db";
import {
  RESOURCE_IDS,
  ResourceAmount,
  ResourceId,
  ResourceStockpile,
  createEmptyResourceStockpile,
  getResourceConfig,
  normalizeResourceAmount,
  cloneResourceStockpile,
} from "../../../db/resources-db";

export const RESOURCE_TOTALS_BRIDGE_KEY = "resources/totals";
export const RESOURCE_RUN_SUMMARY_BRIDGE_KEY = "resources/runSummary";
export const RESOURCE_RUN_DURATION_BRIDGE_KEY = "resources/runDuration";

const PASSIVE_RESOURCE_BONUS_IDS: Partial<Record<ResourceId, BonusId>> = {
  stone: "stone_income",
};

export interface ResourceAmountPayload {
  id: ResourceId;
  name: string;
  amount: number;
}

export interface ResourceRunSummaryItem extends ResourceAmountPayload {
  gained: number;
  ratePerSecond: number;
}

export interface ResourceRunSummaryPayload {
  completed: boolean;
  resources: ResourceRunSummaryItem[];
  bricksDestroyed: number;
  totalBricksDestroyed: number;
}

export const DEFAULT_RESOURCE_RUN_SUMMARY: ResourceRunSummaryPayload = Object.freeze({
  completed: false,
  resources: [],
  bricksDestroyed: 0,
  totalBricksDestroyed: 0,
});

interface ResourcesModuleOptions {
  bridge: DataBridge;
  unlocks: UnlockService;
  bonuses: BonusesModule;
}

interface ResourcesSaveData {
  totals: ResourceAmount;
  bricksDestroyed?: number;
}

export class ResourcesModule implements GameModule {
  public readonly id = "resources";

  private readonly bridge: DataBridge;
  private readonly unlocks: UnlockService;
  private readonly bonuses: BonusesModule;
  private totals: ResourceStockpile = createEmptyResourceStockpile();
  private runGains: ResourceStockpile = createEmptyResourceStockpile();
  private runActive = false;
  private summaryCompleted = false;
  private totalBricksDestroyed = 0;
  private runBricksDestroyed = 0;
  private runDurationMs = 0;
  private visibleResourceIds: ResourceId[] = [];
  private passiveIncomeRemainder: ResourceStockpile = createEmptyResourceStockpile();
  // Throttle visibility recomputation to avoid hot areConditionsMet calls
  private lastVisibilityRefreshMs = 0;
  private static readonly VISIBILITY_REFRESH_INTERVAL_MS = 250; // 4x per second is enough

  constructor(options: ResourcesModuleOptions) {
    this.bridge = options.bridge;
    this.unlocks = options.unlocks;
    this.bonuses = options.bonuses;
  }

  public initialize(): void {
    this.refreshVisibleResourceIds();
    this.pushTotals();
    this.pushRunSummary();
    this.pushRunDuration();
  }

  public reset(): void {
    this.totals = createEmptyResourceStockpile();
    this.runGains = createEmptyResourceStockpile();
    this.runActive = false;
    this.summaryCompleted = false;
    this.totalBricksDestroyed = 0;
    this.runBricksDestroyed = 0;
    this.runDurationMs = 0;
    this.passiveIncomeRemainder = createEmptyResourceStockpile();
    this.refreshVisibleResourceIds();
    this.pushTotals();
    this.pushRunSummary();
    this.pushRunDuration();
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    if (parsed) {
      this.totals = parsed.totals;
      this.totalBricksDestroyed = parsed.bricksDestroyed;
      this.runBricksDestroyed = 0;
    }
    this.runDurationMs = 0;
    this.passiveIncomeRemainder = createEmptyResourceStockpile();
    this.refreshVisibleResourceIds();
    this.pushTotals();
    this.pushRunSummary();
    this.pushRunDuration();
  }

  public save(): unknown {
    return {
      totals: { ...this.totals },
      bricksDestroyed: this.totalBricksDestroyed,
    } satisfies ResourcesSaveData;
  }

  public tick(_deltaMs: number): void {
    const deltaMs = Math.max(_deltaMs, 0);
    const deltaSeconds = deltaMs / 1000;
    let passiveChanged = false;
    if (deltaSeconds > 0) {
      passiveChanged = this.applyPassiveIncome(deltaSeconds);
    }
    const visibilityChanged = this.refreshVisibleResourceIds();
    let summaryChanged = visibilityChanged || passiveChanged;
    let durationChanged = false;

    if (this.runActive && deltaMs > 0) {
      this.runDurationMs += deltaMs;
      summaryChanged = true;
      durationChanged = true;
    }

    if (visibilityChanged || passiveChanged) {
      this.pushTotals();
    }

    if (summaryChanged) {
      this.pushRunSummary();
    }

    if (durationChanged) {
      this.pushRunDuration();
    }
  }

  public startRun(): void {
    this.runGains = createEmptyResourceStockpile();
    this.runActive = true;
    this.summaryCompleted = false;
    this.runBricksDestroyed = 0;
    this.runDurationMs = 0;
    this.forceRefreshVisibleResourceIds();
    this.pushTotals();
    this.pushRunSummary();
    this.pushRunDuration();
  }

  public finishRun(): void {
    if (!this.runActive) {
      return;
    }
    this.runActive = false;
    this.summaryCompleted = true;
    this.forceRefreshVisibleResourceIds();
    this.pushTotals();
    this.pushRunSummary();
    this.pushRunDuration();
  }

  public cancelRun(): void {
    if (!this.runActive) {
      return;
    }
    this.runActive = false;
    this.summaryCompleted = false;
    this.runGains = createEmptyResourceStockpile();
    this.runBricksDestroyed = 0;
    this.runDurationMs = 0;
    this.forceRefreshVisibleResourceIds();
    this.pushTotals();
    this.pushRunSummary();
    this.pushRunDuration();
  }

  public grantResources(
    amount: ResourceAmount | ResourceStockpile,
    options?: { includeInRunSummary?: boolean }
  ): void {
    const normalized = normalizeResourceAmount(amount);
    let changed = false;
    const includeInRunSummary = options?.includeInRunSummary ?? true;
    RESOURCE_IDS.forEach((id) => {
      const value = normalized[id];
      if (value > 0) {
        this.totals[id] += value;
        if (includeInRunSummary) {
          this.runGains[id] += value;
        }
        changed = true;
      }
    });

    if (changed) {
      this.forceRefreshVisibleResourceIds();
      this.pushTotals();
      this.pushRunSummary();
    }
  }

  public notifyBrickDestroyed(): void {
    this.totalBricksDestroyed += 1;
    if (this.runActive) {
      this.runBricksDestroyed += 1;
    }

    const visibilityChanged = this.refreshVisibleResourceIds();
    if (visibilityChanged) {
      this.pushTotals();
    }
    this.pushRunSummary();
  }

  public getRunDurationMs(): number {
    return this.runDurationMs;
  }

  public canAfford(amount: ResourceAmount | ResourceStockpile): boolean {
    const normalized = normalizeResourceAmount(amount);
    return RESOURCE_IDS.every((id) => this.totals[id] >= normalized[id]);
  }

  public spendResources(amount: ResourceAmount | ResourceStockpile): boolean {
    const normalized = normalizeResourceAmount(amount);
    if (!this.canAfford(normalized)) {
      return false;
    }

    RESOURCE_IDS.forEach((id) => {
      this.totals[id] -= normalized[id];
    });

    this.forceRefreshVisibleResourceIds();
    this.pushTotals();
    if (this.summaryCompleted) {
      this.pushRunSummary();
    }
    return true;
  }

  public getTotals(): ResourceStockpile {
    return cloneResourceStockpile(this.totals);
  }

  public getRunGains(): ResourceStockpile {
    return cloneResourceStockpile(this.runGains);
  }

  public isRunSummaryAvailable(): boolean {
    return this.summaryCompleted;
  }

  private applyPassiveIncome(deltaSeconds: number): boolean {
    if (deltaSeconds <= 0) {
      return false;
    }
    let changed = false;
    RESOURCE_IDS.forEach((id) => {
      const rate = this.getPassiveIncomeRate(id);
      if (rate <= 0) {
        this.passiveIncomeRemainder[id] = 0;
        return;
      }
      const pending = rate * deltaSeconds + (this.passiveIncomeRemainder[id] ?? 0);
      const granted = Math.floor(pending * 100) / 100;
      this.passiveIncomeRemainder[id] = pending - granted;
      if (granted > 0) {
        this.totals[id] += granted;
        changed = true;
      }
    });
    return changed;
  }

  private getPassiveIncomeRate(resourceId: ResourceId): number {
    const bonusId = PASSIVE_RESOURCE_BONUS_IDS[resourceId];
    if (!bonusId) {
      return 0;
    }
    const value = this.bonuses.getBonusValue(bonusId);
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, value);
  }

  private pushTotals(): void {
    this.bridge.setValue(RESOURCE_TOTALS_BRIDGE_KEY, this.createTotalsPayload());
  }

  private pushRunSummary(): void {
    const payload: ResourceRunSummaryPayload = {
      completed: this.summaryCompleted,
      resources: this.createRunSummaryItems(),
      bricksDestroyed: this.runBricksDestroyed,
      totalBricksDestroyed: this.totalBricksDestroyed,
    };
    this.bridge.setValue(RESOURCE_RUN_SUMMARY_BRIDGE_KEY, payload);
  }

  private pushRunDuration(): void {
    this.bridge.setValue(RESOURCE_RUN_DURATION_BRIDGE_KEY, this.runDurationMs);
  }

  private createTotalsPayload(): ResourceAmountPayload[] {
    return this.visibleResourceIds.map((id) => {
      const config = getResourceConfig(id);
      return {
        id,
        name: config.name,
        amount: this.totals[id] ?? 0,
      };
    });
  }

  private createRunSummaryItems(): ResourceRunSummaryItem[] {
    const durationSeconds = this.runDurationMs / 1000;
    return this.visibleResourceIds.map((id) => {
      const config = getResourceConfig(id);
      const gained = this.runGains[id] ?? 0;
      const ratePerSecond = durationSeconds > 0 ? gained / durationSeconds : 0;
      return {
        id,
        name: config.name,
        amount: this.totals[id] ?? 0,
        gained,
        ratePerSecond,
      };
    });
  }

  private refreshVisibleResourceIds(): boolean {
    const now = Date.now();
    if (now - this.lastVisibilityRefreshMs < ResourcesModule.VISIBILITY_REFRESH_INTERVAL_MS) {
      return false;
    }
    this.lastVisibilityRefreshMs = now;
    this.unlocks.clearCache();
    const visible = RESOURCE_IDS.filter((id) => this.isResourceUnlocked(id));
    if (areResourceListsEqual(this.visibleResourceIds, visible)) {
      return false;
    }
    this.visibleResourceIds = visible;
    return true;
  }

  private forceRefreshVisibleResourceIds(): void {
    this.lastVisibilityRefreshMs = 0;
    this.refreshVisibleResourceIds();
  }

  private isResourceUnlocked(id: ResourceId): boolean {
    const config = getResourceConfig(id);
    return this.unlocks.areConditionsMet(config.unlockedBy);
  }

  private parseSaveData(
    data: unknown
  ): { totals: ResourceStockpile; bricksDestroyed: number } | null {
    if (
      typeof data !== "object" ||
      data === null ||
      !("totals" in data)
    ) {
      return null;
    }

    const { totals, bricksDestroyed } = data as ResourcesSaveData;
    return {
      totals: normalizeResourceAmount(totals),
      bricksDestroyed: sanitizeBrickCount(bricksDestroyed),
    };
  }
}

const sanitizeBrickCount = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
};

const areResourceListsEqual = (
  a: readonly ResourceId[],
  b: readonly ResourceId[]
): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
};
