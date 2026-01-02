import assert from "assert";
import { Application } from "../src/logic/core/Application";
import { MAP_LIST_BRIDGE_KEY, MapListEntry } from "../src/logic/modules/map/map.module";
import { describe, test } from "./testRunner";

const getInternalRunHandler = (
  app: Application
): ((success: boolean) => void) =>
  (app as unknown as { handleMapRunCompleted: (success: boolean) => void })
    .handleMapRunCompleted.bind(app);

describe("Application", () => {
  test("records attempts when a run finishes", () => {
    const app = new Application();
    app.initialize();

    const completeRun = getInternalRunHandler(app);

    app.restartCurrentMap();

    completeRun(false);

    const bridge = app.getBridge();
    const list = bridge.getValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY) ?? [];
    const training = list.find((entry) => entry.id === "trainingGrounds");
    assert(training, "expected trainingGrounds map to be listed");
    assert.strictEqual(training?.attempts, 1, "should count one failed attempt");

    const internalMaps = (app as unknown as { mapModule: { getMapStats: () => unknown } })
      .mapModule;
    const stats = internalMaps.getMapStats() as {
      trainingGrounds?: {
        [level: number]: { success: number; failure: number; bestTimeMs: number | null };
      };
    };
    assert.strictEqual(stats.trainingGrounds?.[1]?.failure, 1);

    app.restartCurrentMap();
    completeRun(true);

    const updatedList = bridge.getValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY) ?? [];
    const updatedTraining = updatedList.find((entry) => entry.id === "trainingGrounds");
    assert(updatedTraining, "expected trainingGrounds map after success");
    assert.strictEqual(updatedTraining?.currentLevel, 1);
    assert.strictEqual(updatedTraining?.bestTimeMs, 0);
  });
});
