import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/logic/core/DataBridge";
import {
  ResourcesModule,
  RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
} from "../src/logic/modules/ResourcesModule";
import type { ResourceRunSummaryPayload } from "../src/logic/modules/ResourcesModule";

describe("ResourcesModule", () => {
  test("calculates per-second gain rates for run summary", () => {
    const bridge = new DataBridge();
    const module = new ResourcesModule({ bridge });

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
});
