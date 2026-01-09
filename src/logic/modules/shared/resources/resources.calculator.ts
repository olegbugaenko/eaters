import { ResourceAmountPayload, ResourceRunSummaryItem } from "./resources.types";
import { ResourceId, ResourceStockpile, getResourceConfig } from "../../../../db/resources-db";

export interface ResourcePassiveIncomeInput {
  deltaSeconds: number;
  totals: ResourceStockpile;
  remainder: ResourceStockpile;
  passiveBonusValues: Partial<Record<ResourceId, number>>;
}

export interface ResourcePassiveIncomeResult {
  totals: ResourceStockpile;
  remainder: ResourceStockpile;
  changed: boolean;
}

export class ResourceCalculator {
  public static applyPassiveIncome({
    deltaSeconds,
    totals,
    remainder,
    passiveBonusValues,
  }: ResourcePassiveIncomeInput): ResourcePassiveIncomeResult {
    if (deltaSeconds <= 0) {
      return { totals, remainder, changed: false };
    }
    let changed = false;
    const nextTotals = { ...totals };
    const nextRemainder = { ...remainder };

    Object.entries(passiveBonusValues).forEach(([resourceId, rate]) => {
      const value = typeof rate === "number" && Number.isFinite(rate) ? rate : 0;
      if (value <= 0) {
        nextRemainder[resourceId as ResourceId] = 0;
        return;
      }
      const pending = value * deltaSeconds + (nextRemainder[resourceId as ResourceId] ?? 0);
      const granted = Math.floor(pending * 100) / 100;
      nextRemainder[resourceId as ResourceId] = pending - granted;
      if (granted > 0) {
        nextTotals[resourceId as ResourceId] += granted;
        changed = true;
      }
    });

    return { totals: nextTotals, remainder: nextRemainder, changed };
  }

  public static buildTotalsPayload(
    visibleResourceIds: ResourceId[],
    totals: ResourceStockpile,
  ): ResourceAmountPayload[] {
    return visibleResourceIds.map((id) => {
      const config = getResourceConfig(id);
      return {
        id,
        name: config.name,
        amount: totals[id] ?? 0,
      };
    });
  }

  public static buildRunSummaryItems(
    visibleResourceIds: ResourceId[],
    totals: ResourceStockpile,
    runGains: ResourceStockpile,
    runDurationMs: number,
  ): ResourceRunSummaryItem[] {
    const durationSeconds = runDurationMs / 1000;
    return visibleResourceIds.map((id) => {
      const config = getResourceConfig(id);
      const gained = runGains[id] ?? 0;
      const ratePerSecond = durationSeconds > 0 ? gained / durationSeconds : 0;
      return {
        id,
        name: config.name,
        amount: totals[id] ?? 0,
        gained,
        ratePerSecond,
      };
    });
  }
}
