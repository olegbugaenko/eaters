import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/core/logic/ui/DataBridge";
import { NewUnlockNotificationService } from "../src/logic/services/new-unlock-notification/NewUnlockNotification";
import {
  DEFAULT_NEW_UNLOCKS_STATE,
  NEW_UNLOCKS_BRIDGE_KEY,
} from "../src/logic/services/new-unlock-notification/new-unlock-notification.const";

const getState = (bridge: DataBridge) =>
  bridge.getValue(NEW_UNLOCKS_BRIDGE_KEY) ?? DEFAULT_NEW_UNLOCKS_STATE;

describe("NewUnlockNotificationService", () => {
  test("tracks unseen unlocks by prefix and top-level", () => {
    const bridge = new DataBridge();
    const service = new NewUnlockNotificationService({ bridge });
    service.initialize();

    const flags = new Map<string, boolean>([
      ["buildings.farm", false],
      ["buildings.mine", false],
      ["maps.initial", false],
    ]);

    Array.from(flags.keys()).forEach((path) => {
      service.registerUnlock(path, () => flags.get(path) ?? false);
    });

    service.invalidate();
    assert.deepStrictEqual(getState(bridge), DEFAULT_NEW_UNLOCKS_STATE);

    flags.set("buildings.farm", true);
    service.invalidate("buildings");

    const buildingsState = getState(bridge);
    assert.deepStrictEqual(buildingsState.unseenPaths, ["buildings.farm"]);
    assert.deepStrictEqual(buildingsState.unseenByPrefix.buildings, ["buildings.farm"]);
    assert.deepStrictEqual(buildingsState.unseenByPrefix["buildings.farm"], ["buildings.farm"]);
    assert.deepStrictEqual(buildingsState.topLevelUnseen, ["buildings"]);

    flags.set("maps.initial", true);
    service.invalidate();

    const combinedState = getState(bridge);
    assert.deepStrictEqual(combinedState.unseenPaths, ["buildings.farm", "maps.initial"]);
    assert.deepStrictEqual(combinedState.unseenByPrefix.maps, ["maps.initial"]);
    assert.deepStrictEqual(combinedState.topLevelUnseen, ["buildings", "maps"]);
  });

  test("clears top-level when all leaf nodes are viewed", () => {
    const bridge = new DataBridge();
    const service = new NewUnlockNotificationService({ bridge });
    service.initialize();

    const flags = new Map<string, boolean>([
      ["buildings.farm", true],
      ["buildings.mine", true],
    ]);

    Array.from(flags.keys()).forEach((path) => {
      service.registerUnlock(path, () => flags.get(path) ?? false);
    });

    service.invalidate("buildings");
    const initialState = getState(bridge);
    assert.deepStrictEqual(initialState.unseenPaths, ["buildings.farm", "buildings.mine"]);
    assert.deepStrictEqual(initialState.topLevelUnseen, ["buildings"]);

    service.markViewed("buildings.farm");
    const afterFirst = getState(bridge);
    assert.deepStrictEqual(afterFirst.unseenPaths, ["buildings.mine"]);
    assert.deepStrictEqual(afterFirst.topLevelUnseen, ["buildings"]);

    service.markViewed("buildings.mine");
    const afterSecond = getState(bridge);
    assert.deepStrictEqual(afterSecond.unseenPaths, []);
    assert.deepStrictEqual(afterSecond.topLevelUnseen, []);
  });

  test("keeps nested prefixes in unseenByPrefix", () => {
    const bridge = new DataBridge();
    const service = new NewUnlockNotificationService({ bridge });
    service.initialize();

    let unlocked = false;
    service.registerUnlock("biolab.organs.heart", () => unlocked);

    service.invalidate();
    assert.deepStrictEqual(getState(bridge), DEFAULT_NEW_UNLOCKS_STATE);

    unlocked = true;
    service.invalidate("biolab");

    const state = getState(bridge);
    assert.deepStrictEqual(state.unseenPaths, ["biolab.organs.heart"]);
    assert.deepStrictEqual(state.unseenByPrefix.biolab, ["biolab.organs.heart"]);
    assert.deepStrictEqual(state.unseenByPrefix["biolab.organs"], ["biolab.organs.heart"]);

    service.markViewed("biolab");
    const unchanged = getState(bridge);
    assert.deepStrictEqual(unchanged.unseenPaths, ["biolab.organs.heart"]);
  });
});
