import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/core/logic/ui/DataBridge";
import {
  ResourcesModule,
  RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
  RESOURCE_TOTALS_BRIDGE_KEY,
} from "../src/logic/modules/shared/resources/resources.module";
import { MapRunState } from "../src/logic/modules/active-map/map/MapRunState";
import type {
  ResourceRunSummaryPayload,
  ResourcesSaveData,
} from "../src/logic/modules/shared/resources/resources.types";
import { UnlockService } from "../src/logic/services/unlock/UnlockService";
import type { MapStats } from "../src/logic/modules/active-map/map/map.types";
import { BonusesModule } from "../src/logic/modules/shared/bonuses/bonuses.module";
import { BonusesValueAdapter } from "../src/logic/modules/shared/bonuses/bonuses.adapter";
import { MapRunContextAdapter } from "../src/logic/modules/active-map/map/map-run-context.adapter";
import { UnlockProgressionAdapter } from "../src/logic/services/unlock/unlock-progression.adapter";

describe("ResourcesModule", () => {
  test("calculates per-second gain rates for run summary", () => {
    const bridge = new DataBridge();
    const unlocks = new UnlockService({
      getMapStats: () => ({}),
      getSkillLevel: () => 0,
    });
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const runState = new MapRunState();
    runState.start();
    const module = new ResourcesModule({
      bridge,
      progression: new UnlockProgressionAdapter(unlocks),
      bonusValues: new BonusesValueAdapter(bonuses),
      runtimeContext: new MapRunContextAdapter(runState),
    });

    module.initialize();
    module.startRun();
    module.tick(2000);
    module.grantResources({ stone: 100 });
    module.finishRun(true);

    const payload = bridge.getValue(RESOURCE_RUN_SUMMARY_BRIDGE_KEY);
    assert(payload, "run summary should be available");

    const stone = payload.resources.find((resource) => resource.id === "stone");
    assert(stone, "stone resource should be present");
    assert.strictEqual(stone.gained, 100);
    assert(Math.abs(stone.ratePerSecond - 50) < 1e-6, "stone rate should equal gain per second");
  });

  test("passive income is excluded from run gains", () => {
    const bridge = new DataBridge();
    const unlocks = new UnlockService({
      getMapStats: () => ({}),
      getSkillLevel: () => 0,
    });
    const bonuses = new BonusesModule();
    bonuses.initialize();
    bonuses.registerSource(
      "test",
      {
        stone_income: {
          income: () => 2,
        },
      },
      "misc"
    );
    bonuses.setSourceLevel("test", 1);
    const runState = new MapRunState();
    runState.start();
    const module = new ResourcesModule({
      bridge,
      progression: new UnlockProgressionAdapter(unlocks),
      bonusValues: new BonusesValueAdapter(bonuses),
      runtimeContext: new MapRunContextAdapter(runState),
    });

    module.initialize();
    module.startRun();
    module.tick(1000);
    module.grantResources({ stone: 5 });
    module.finishRun(true);

    const payload = bridge.getValue(RESOURCE_RUN_SUMMARY_BRIDGE_KEY);
    assert(payload, "run summary should be available");

    const stone = payload.resources.find((resource) => resource.id === "stone");
    assert(stone, "stone resource should be present");
    assert.strictEqual(stone.amount, 7);
    assert.strictEqual(stone.gained, 5);
  });

  test("resources unlock after completing required map", () => {
    const bridge = new DataBridge();
    let mapStats: MapStats = {};
    const unlocks = new UnlockService({
      getMapStats: () => mapStats,
      getSkillLevel: () => 0,
    });
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const runState = new MapRunState();
    runState.start();
    const module = new ResourcesModule({
      bridge,
      progression: new UnlockProgressionAdapter(unlocks),
      bonusValues: new BonusesValueAdapter(bonuses),
      runtimeContext: new MapRunContextAdapter(runState),
    });

    module.initialize();

    const totalsBefore = bridge.getValue(RESOURCE_TOTALS_BRIDGE_KEY) ?? [];
    assert(
      totalsBefore.every((resource) => resource.id !== "iron"),
      "iron should be hidden before unlocking"
    );

    module.startRun();
    mapStats = {
      trainingGrounds: {
        1: { success: 1, failure: 0, bestTimeMs: null, totalTimeMs: 0 },
      },
      foundations: {
        1: { success: 1, failure: 0, bestTimeMs: null, totalTimeMs: 0 },
      },
      initial: {
        1: { success: 1, failure: 0, bestTimeMs: null, totalTimeMs: 0 },
      },
    };
    module.finishRun(true);

    const totalsAfter = bridge.getValue(RESOURCE_TOTALS_BRIDGE_KEY) ?? [];
    assert(
      totalsAfter.some((resource) => resource.id === "iron"),
      "iron should be visible after unlocking"
    );
  });

  test("resource stays visible after spending if ever obtained (farmed once)", async () => {
    const bridge = new DataBridge();
    const unlocks = new UnlockService({
      getMapStats: () => ({}),
      getSkillLevel: () => 0,
    });
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const runState = new MapRunState();
    runState.start();
    const module = new ResourcesModule({
      bridge,
      progression: new UnlockProgressionAdapter(unlocks),
      bonusValues: new BonusesValueAdapter(bonuses),
      runtimeContext: new MapRunContextAdapter(runState),
    });

    module.initialize();
    module.startRun();
    module.grantResources({ copper: 50 });
    await new Promise((r) => setTimeout(r, 320));
    module.tick(0);

    let totals = bridge.getValue(RESOURCE_TOTALS_BRIDGE_KEY) ?? [];
    assert(
      totals.some((r) => r.id === "copper"),
      "copper should appear after grant without map-based unlock"
    );

    module.spendResources({ copper: 50 });
    await new Promise((r) => setTimeout(r, 320));
    module.tick(0);

    totals = bridge.getValue(RESOURCE_TOTALS_BRIDGE_KEY) ?? [];
    assert(
      totals.some((r) => r.id === "copper" && r.amount === 0),
      "copper should remain visible at 0 after spending"
    );
  });

  test("grantResources with no positive amounts is a no-op (totals, run gains, bridge)", () => {
    const bridge = new DataBridge();
    const unlocks = new UnlockService({
      getMapStats: () => ({}),
      getSkillLevel: () => 0,
    });
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const runState = new MapRunState();
    runState.start();
    const module = new ResourcesModule({
      bridge,
      progression: new UnlockProgressionAdapter(unlocks),
      bonusValues: new BonusesValueAdapter(bonuses),
      runtimeContext: new MapRunContextAdapter(runState),
    });

    module.initialize();
    module.startRun();
    module.grantResources({ stone: 42 });

    const totalsBefore = JSON.stringify(module.getTotals());
    const gainsBefore = JSON.stringify(module.getRunGains());
    const bridgeBefore = JSON.stringify(bridge.getValue(RESOURCE_TOTALS_BRIDGE_KEY));
    const runSummaryBefore = JSON.stringify(bridge.getValue(RESOURCE_RUN_SUMMARY_BRIDGE_KEY));

    module.grantResources({});
    module.grantResources({ stone: 0, iron: 0 });
    module.grantResources({ stone: -10 });

    assert.strictEqual(JSON.stringify(module.getTotals()), totalsBefore);
    assert.strictEqual(JSON.stringify(module.getRunGains()), gainsBefore);
    assert.strictEqual(JSON.stringify(bridge.getValue(RESOURCE_TOTALS_BRIDGE_KEY)), bridgeBefore);
    assert.strictEqual(JSON.stringify(bridge.getValue(RESOURCE_RUN_SUMMARY_BRIDGE_KEY)), runSummaryBefore);
  });

  test("grantResources no-op does not run when includeInRunSummary is false", () => {
    const bridge = new DataBridge();
    const unlocks = new UnlockService({
      getMapStats: () => ({}),
      getSkillLevel: () => 0,
    });
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const runState = new MapRunState();
    runState.start();
    const module = new ResourcesModule({
      bridge,
      progression: new UnlockProgressionAdapter(unlocks),
      bonusValues: new BonusesValueAdapter(bonuses),
      runtimeContext: new MapRunContextAdapter(runState),
    });

    module.initialize();
    module.startRun();
    module.grantResources({ stone: 5 });
    const bridgeBefore = JSON.stringify(bridge.getValue(RESOURCE_TOTALS_BRIDGE_KEY));
    module.grantResources({ stone: 0 }, { includeInRunSummary: false });
    assert.strictEqual(JSON.stringify(bridge.getValue(RESOURCE_TOTALS_BRIDGE_KEY)), bridgeBefore);
  });

  test("load without everObtained but with positive totals backfills everObtained in save", () => {
    const bridge = new DataBridge();
    const unlocks = new UnlockService({
      getMapStats: () => ({}),
      getSkillLevel: () => 0,
    });
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const runState = new MapRunState();
    runState.start();
    const module = new ResourcesModule({
      bridge,
      progression: new UnlockProgressionAdapter(unlocks),
      bonusValues: new BonusesValueAdapter(bonuses),
      runtimeContext: new MapRunContextAdapter(runState),
    });

    module.initialize();
    module.load({ totals: { copper: 7 } } satisfies ResourcesSaveData);

    const saved = module.save() as ResourcesSaveData;
    assert.strictEqual(saved.everObtained?.copper, true);

    module.spendResources({ copper: 7 });
    const savedAfterSpend = module.save() as ResourcesSaveData;
    assert.strictEqual(savedAfterSpend.everObtained?.copper, true);
    assert.strictEqual(savedAfterSpend.totals.copper, 0);
  });
});
