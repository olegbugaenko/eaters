import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/core/logic/ui/DataBridge";
import {
  ResourcesModule,
  RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
  RESOURCE_TOTALS_BRIDGE_KEY,
} from "../src/logic/modules/shared/resources/resources.module";
import { MapRunState } from "../src/logic/modules/active-map/map/MapRunState";
import type { ResourceRunSummaryPayload } from "../src/logic/modules/shared/resources/resources.types";
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
    bonuses.registerSource("test", {
      stone_income: {
        income: () => 2,
      },
    });
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
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
      foundations: {
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
      initial: {
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
    };
    module.finishRun(true);

    const totalsAfter = bridge.getValue(RESOURCE_TOTALS_BRIDGE_KEY) ?? [];
    assert(
      totalsAfter.some((resource) => resource.id === "iron"),
      "iron should be visible after unlocking"
    );
  });
});
