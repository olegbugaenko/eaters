import assert from "assert";
import { Application } from "../src/logic/core/Application";
import { MAP_LIST_BRIDGE_KEY } from "../src/logic/modules/active-map/map/map.const";
import { MapListEntry } from "../src/logic/modules/active-map/map/map.types";
import { describe, test } from "./testRunner";

describe("Application", () => {
  test("records attempts when a run finishes", () => {
    const app = new Application();
    app.initialize();
    app.restartCurrentMap();

    app.services.mapRunState.complete(false);

    const bridge = app.services.bridge;
    const list: MapListEntry[] = bridge.getValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY) ?? [];
    const training = list.find((entry: MapListEntry) => entry.id === "trainingGrounds");
    assert(training, "expected trainingGrounds map to be listed");
    assert.strictEqual(training?.attempts, 1, "should count one failed attempt");

    const stats = app.services.map.getMapStats() as {
      trainingGrounds?: {
        [level: number]: { success: number; failure: number; bestTimeMs: number | null };
      };
    };
    assert.strictEqual(stats.trainingGrounds?.[1]?.failure, 1);

    app.restartCurrentMap();
    app.services.mapRunState.complete(true);

    const updatedList: MapListEntry[] = bridge.getValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY) ?? [];
    const updatedTraining = updatedList.find(
      (entry: MapListEntry) => entry.id === "trainingGrounds"
    );
    assert(updatedTraining, "expected trainingGrounds map after success");
    assert.strictEqual(updatedTraining?.currentLevel, 1);
    assert.strictEqual(updatedTraining?.bestTimeMs, 0);
  });
});
