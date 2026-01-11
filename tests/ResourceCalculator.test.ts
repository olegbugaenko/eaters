import assert from "assert";
import { describe, test } from "./testRunner";
import { createEmptyResourceStockpile } from "../src/db/resources-db";
import { ResourceCalculator } from "../src/logic/modules/shared/resources/resources.calculator";

describe("ResourceCalculator", () => {
  test("accumulates passive income with remainder tracking", () => {
    const totals = createEmptyResourceStockpile();
    const remainder = createEmptyResourceStockpile();

    const result = ResourceCalculator.applyPassiveIncome({
      deltaSeconds: 1,
      totals,
      remainder,
      passiveBonusValues: {
        stone: 1,
        sand: 0.333,
      },
    });

    assert.strictEqual(result.totals.stone, 1);
    assert.strictEqual(result.totals.sand, 0.33);
    assert(Math.abs(result.remainder.sand - 0.003) < 1e-6);
  });

  test("builds run summary items with per-second rates", () => {
    const totals = createEmptyResourceStockpile();
    const runGains = createEmptyResourceStockpile();
    totals.stone = 10;
    runGains.stone = 4;

    const items = ResourceCalculator.buildRunSummaryItems(["stone"], totals, runGains, 2000);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0]?.amount, 10);
    assert.strictEqual(items[0]?.gained, 4);
    assert.strictEqual(items[0]?.ratePerSecond, 2);
  });
});
