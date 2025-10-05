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
}

export interface ResourceRunSummaryPayload {
  completed: boolean;
  resources: ResourceRunSummaryItem[];
}

export const DEFAULT_RESOURCE_RUN_SUMMARY: ResourceRunSummaryPayload = Object.freeze({
  completed: false,
  resources: [],
});

interface ResourcesModuleOptions {
  bridge: DataBridge;
}

interface ResourcesSaveData {
  totals: ResourceAmount;
}

export class ResourcesModule implements GameModule {
  public readonly id = "resources";

  private readonly bridge: DataBridge;
  private totals: ResourceStockpile = createEmptyResourceStockpile();
  private runGains: ResourceStockpile = createEmptyResourceStockpile();
  private runActive = false;
  private summaryCompleted = false;

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
    this.pushTotals();
    this.pushRunSummary();
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    if (parsed) {
      this.totals = parsed;
    }
    this.pushTotals();
    this.pushRunSummary();
  }

  public save(): unknown {
    return {
      totals: { ...this.totals },
    } satisfies ResourcesSaveData;
  }

  public tick(_deltaMs: number): void {
    // No periodic work required for resource bookkeeping.
  }

  public startRun(): void {
    this.runGains = createEmptyResourceStockpile();
    this.runActive = true;
    this.summaryCompleted = false;
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
      if (this.summaryCompleted || !this.runActive) {
        this.pushRunSummary();
      }
    }
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
    return RESOURCE_IDS.map((id) => {
      const config = getResourceConfig(id);
      return {
        id,
        name: config.name,
        amount: this.totals[id] ?? 0,
        gained: this.runGains[id] ?? 0,
      };
    });
  }

  private parseSaveData(data: unknown): ResourceStockpile | null {
    if (
      typeof data !== "object" ||
      data === null ||
      !("totals" in data)
    ) {
      return null;
    }

    const totals = (data as ResourcesSaveData).totals;
    return normalizeResourceAmount(totals);
  }
}
