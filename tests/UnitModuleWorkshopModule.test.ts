import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/logic/core/DataBridge";
import {
  UnitModuleWorkshopModule,
  UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY,
} from "../src/logic/modules/unit-module-workshop/unit-module-workshop.module";
import type { UnitModuleWorkshopBridgeState } from "../src/logic/modules/unit-module-workshop/unit-module-workshop.module";
import type { MapStats } from "../src/logic/modules/map/map.module";
import { UnlockService } from "../src/logic/services/UnlockService";
import type { ResourcesModule } from "../src/logic/modules/resources/resources.module";

describe("UnitModuleWorkshopModule", () => {
  test("hides locked modules until unlock conditions are met", () => {
    const bridge = new DataBridge();
    let mapStats: MapStats = {};
    let workshopLevel = 1;
    const unlocks = new UnlockService({
      getMapStats: () => mapStats,
      getSkillLevel: () => 0,
    });
    const resources = {
      spendResources: () => true,
    } as unknown as ResourcesModule;

    const module = new UnitModuleWorkshopModule({
      bridge,
      resources,
      getSkillLevel: () => workshopLevel,
      unlocks,
    });

    module.initialize();

    const initialState =
      bridge.getValue<UnitModuleWorkshopBridgeState>(
        UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY
      );
    assert(initialState, "initial state should be available");
    assert(initialState.unlocked, "workshop should be unlocked");
    assert.deepStrictEqual(
      initialState.modules.map((item) => item.id),
      ["magnet", "perforator"]
    );

    mapStats = {
      trainingGrounds: {
        0: { success: 1, failure: 0, bestTimeMs: null },
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
      foundations: {
        0: { success: 1, failure: 0, bestTimeMs: null },
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
      initial: {
        0: { success: 1, failure: 0, bestTimeMs: null },
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
    };

    unlocks.clearCache();

    module.tick(0);

    const unlockedState =
      bridge.getValue<UnitModuleWorkshopBridgeState>(
        UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY
      );
    assert(unlockedState, "state should be pushed after unlocking");
    assert.deepStrictEqual(
      unlockedState.modules.map((item) => item.id),
      ["magnet", "perforator", "vitalHull", "ironForge"]
    );
  });
});
