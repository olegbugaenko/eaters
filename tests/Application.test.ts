import assert from "assert";
import { Application } from "../src/logic/core/Application";
import { MAP_LIST_BRIDGE_KEY, MapListEntry } from "../src/logic/modules/MapModule";
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
    completeRun(false);

    const bridge = app.getBridge();
    const list = bridge.getValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY) ?? [];
    const foundations = list.find((entry) => entry.id === "foundations");
    assert(foundations, "expected foundations map to be listed");
    assert.strictEqual(foundations?.attempts, 1, "should count one failed attempt");

    const internalMaps = (app as unknown as { mapModule: { getMapStats: () => unknown } })
      .mapModule;
    const stats = internalMaps.getMapStats() as {
      foundations?: { [level: number]: { success: number; failure: number } };
    };
    assert.strictEqual(stats.foundations?.[0]?.failure, 1);

    app.restartCurrentMap();
    completeRun(true);

    const updatedList = bridge.getValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY) ?? [];
    const updatedFoundations = updatedList.find((entry) => entry.id === "foundations");
    assert(updatedFoundations, "expected foundations map after success");
    assert.strictEqual(updatedFoundations?.currentLevel, 1);
  });
});
