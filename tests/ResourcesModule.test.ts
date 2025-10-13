import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/logic/core/DataBridge";
import {
  ResourcesModule,
  RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
  RESOURCE_TOTALS_BRIDGE_KEY,
} from "../src/logic/modules/ResourcesModule";
import type { ResourceRunSummaryPayload } from "../src/logic/modules/ResourcesModule";
import { UnlockService } from "../src/logic/services/UnlockService";
import type { MapStats } from "../src/logic/modules/MapModule";

describe("ResourcesModule", () => {
  test("calculates per-second gain rates for run summary", () => {
    const bridge = new DataBridge();
    const unlocks = new UnlockService({
      getMapStats: () => ({}),
      getSkillLevel: () => 0,
    });
    const module = new ResourcesModule({ bridge, unlocks });

    module.initialize();
    module.startRun();
    module.tick(2000);
    module.grantResources({ stone: 100 });
    module.finishRun();

    const payload = bridge.getValue<ResourceRunSummaryPayload>(
      RESOURCE_RUN_SUMMARY_BRIDGE_KEY
    );
    assert(payload, "run summary should be available");

    const stone = payload.resources.find((resource) => resource.id === "stone");
    assert(stone, "stone resource should be present");
    assert.strictEqual(stone.gained, 100);
    assert(Math.abs(stone.ratePerSecond - 50) < 1e-6, "stone rate should equal gain per second");
  });

  test("resources unlock after completing required map", () => {
    const bridge = new DataBridge();
    let mapStats: MapStats = {};
    const unlocks = new UnlockService({
      getMapStats: () => mapStats,
      getSkillLevel: () => 0,
    });
    const module = new ResourcesModule({ bridge, unlocks });

    module.initialize();

    const totalsBefore = bridge.getValue<{ id: string }[]>(RESOURCE_TOTALS_BRIDGE_KEY) ?? [];
    assert(
      totalsBefore.every((resource) => resource.id !== "iron"),
      "iron should be hidden before unlocking"
    );

    module.startRun();
    mapStats = {
      foundations: {
        0: { success: 1, failure: 0, bestTimeMs: null },
      },
      initial: {
        0: { success: 1, failure: 0, bestTimeMs: null },
      },
    };
    module.finishRun();

    const totalsAfter = bridge.getValue<{ id: string }[]>(RESOURCE_TOTALS_BRIDGE_KEY) ?? [];
    assert(
      totalsAfter.some((resource) => resource.id === "iron"),
      "iron should be visible after unlocking"
    );
  });
});
