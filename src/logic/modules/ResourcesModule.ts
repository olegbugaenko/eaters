import { DataBridge } from "../core/DataBridge";
import { GameModule } from "../core/types";
import {
  RESOURCE_IDS,
  ResourceAmount,
  ResourceId,
  ResourceStockpile,
  createEmptyResourceStockpile,
  getResourceConfig,
  normalizeResourceAmount,
  cloneResourceStockpile,
} from "../../db/resources-db";

export const RESOURCE_TOTALS_BRIDGE_KEY = "resources/totals";
export const RESOURCE_RUN_SUMMARY_BRIDGE_KEY = "resources/runSummary";

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
}

interface ResourcesSaveData {
  totals: ResourceAmount;
  bricksDestroyed?: number;
}

export class ResourcesModule implements GameModule {
  public readonly id = "resources";

  private readonly bridge: DataBridge;
  private totals: ResourceStockpile = createEmptyResourceStockpile();
  private runGains: ResourceStockpile = createEmptyResourceStockpile();
  private runActive = false;
  private summaryCompleted = false;
  private totalBricksDestroyed = 0;
  private runBricksDestroyed = 0;
  private runDurationMs = 0;

  constructor(options: ResourcesModuleOptions) {
    this.bridge = options.bridge;
  }

  public initialize(): void {
    this.pushTotals();
    this.pushRunSummary();
  }

  public reset(): void {
    this.totals = createEmptyResourceStockpile();
    this.runGains = createEmptyResourceStockpile();
    this.runActive = false;
    this.summaryCompleted = false;
    this.totalBricksDestroyed = 0;
    this.runBricksDestroyed = 0;
    this.runDurationMs = 0;
    this.pushTotals();
    this.pushRunSummary();
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    if (parsed) {
      this.totals = parsed.totals;
      this.totalBricksDestroyed = parsed.bricksDestroyed;
      this.runBricksDestroyed = 0;
    }
    this.runDurationMs = 0;
    this.pushTotals();
    this.pushRunSummary();
  }

  public save(): unknown {
    return {
      totals: { ...this.totals },
      bricksDestroyed: this.totalBricksDestroyed,
    } satisfies ResourcesSaveData;
  }

  public tick(_deltaMs: number): void {
    const deltaMs = Math.max(_deltaMs, 0);
    if (!this.runActive || deltaMs <= 0) {
      return;
    }
    this.runDurationMs += deltaMs;
    this.pushRunSummary();
  }

  public startRun(): void {
    this.runGains = createEmptyResourceStockpile();
    this.runActive = true;
    this.summaryCompleted = false;
    this.runBricksDestroyed = 0;
    this.runDurationMs = 0;
    this.pushRunSummary();
  }

  public finishRun(): void {
    if (!this.runActive) {
      return;
    }
    this.runActive = false;
    this.summaryCompleted = true;
    this.pushRunSummary();
  }

  public grantResources(amount: ResourceAmount | ResourceStockpile): void {
    const normalized = normalizeResourceAmount(amount);
    let changed = false;
    RESOURCE_IDS.forEach((id) => {
      const value = normalized[id];
      if (value > 0) {
        this.totals[id] += value;
        this.runGains[id] += value;
        changed = true;
      }
    });

    if (changed) {
      this.pushTotals();
      this.pushRunSummary();
    }
  }

  public notifyBrickDestroyed(): void {
    this.totalBricksDestroyed += 1;
    if (this.runActive) {
      this.runBricksDestroyed += 1;
    }

    this.pushRunSummary();
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

  private createTotalsPayload(): ResourceAmountPayload[] {
    return RESOURCE_IDS.map((id) => {
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
    return RESOURCE_IDS.map((id) => {
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
