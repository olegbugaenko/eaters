import assert from "assert";
import { Application } from "../src/logic/core/Application";
import { MAP_LIST_BRIDGE_KEY } from "../src/logic/modules/active-map/map/map.const";
import { MapListEntry } from "../src/logic/modules/active-map/map/map.types";
import { describe, test } from "./testRunner";
import { MapModule } from "../src/logic/modules/active-map/map/map.module";

describe("Application", () => {
  test("records attempts when a run finishes", () => {
    const app = new Application();
    app.initialize();
    app.restartCurrentMap();

    app.services.mapRunState.complete(false);

    const bridge = app.services.bridge;
    const list = bridge.getValue(MAP_LIST_BRIDGE_KEY) ?? [];
    const tutorial = list.find((entry: MapListEntry) => entry.id === "tutorialZone");
    assert(tutorial, "expected tutorialZone map to be listed");
    assert.strictEqual(tutorial?.attempts, 1, "should count one failed attempt");

    const stats = (app.services.map as MapModule).getMapStats() as {
      tutorialZone?: {
        [level: number]: { success: number; failure: number; bestTimeMs: number | null };
      };
    };
    assert.strictEqual(stats.tutorialZone?.[1]?.failure, 1);

    app.restartCurrentMap();
    app.services.mapRunState.complete(true);

    const updatedList = bridge.getValue(MAP_LIST_BRIDGE_KEY) ?? [];
    const updatedTutorial = updatedList.find((entry: MapListEntry) => entry.id === "tutorialZone");
    assert(updatedTutorial, "expected tutorialZone map after success");
    assert.strictEqual(updatedTutorial?.currentLevel, 1);
    assert.strictEqual(updatedTutorial?.bestTimeMs, 0);
  });
});
