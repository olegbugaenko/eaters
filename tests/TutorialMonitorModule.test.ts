import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/core/logic/ui/DataBridge";
import { MapRunState } from "../src/logic/modules/active-map/map/MapRunState";
import { TutorialMonitorModule } from "../src/logic/modules/active-map/tutorial-monitor/tutorial-monitor.module";
import {
  TUTORIAL_MONITOR_INPUT_BRIDGE_KEY,
  TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY,
} from "../src/logic/modules/active-map/tutorial-monitor/tutorial-monitor.const";
import {
  DEFAULT_CAMP_STATISTICS,
  STATISTICS_BRIDGE_KEY,
} from "../src/logic/modules/shared/statistics/statistics.module";
import type { NecromancerModule } from "../src/logic/modules/active-map/necromancer/necromancer.module";
import type { ResourcesModule } from "../src/logic/modules/shared/resources/resources.module";

const createNecromancerStub = (sanity: number): NecromancerModule =>
  ({
    getResources: () => ({
      mana: { current: 0, max: 0, regenPerSecond: 0 },
      sanity: { current: sanity, max: sanity },
    }),
    getAffordableSpawnCount: () => 10,
  } as unknown as NecromancerModule);

const createResourcesStub = (): ResourcesModule =>
  ({
    getRunBricksDestroyed: () => 0,
  } as unknown as ResourcesModule);

describe("TutorialMonitorModule", () => {
  test("advances when required attacks are met even if spawns are affordable", () => {
    const bridge = new DataBridge();
    const runState = new MapRunState();
    runState.start();

    const module = new TutorialMonitorModule({
      bridge,
      necromancer: createNecromancerStub(2),
      resources: createResourcesStub(),
      runState,
    });

    module.initialize();

    bridge.setValue(STATISTICS_BRIDGE_KEY, {
      ...DEFAULT_CAMP_STATISTICS,
      attacksDealt: 1,
    });
    bridge.setValue(TUTORIAL_MONITOR_INPUT_BRIDGE_KEY, {
      active: true,
      stepId: "summon-blue-vanguard",
      actionCompleted: true,
      attacksRequired: 2,
    });

    module.tick(16);
    const notReady = bridge.getValue(TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY);
    assert(notReady);
    assert.strictEqual(notReady.ready, false);

    bridge.setValue(STATISTICS_BRIDGE_KEY, {
      ...DEFAULT_CAMP_STATISTICS,
      attacksDealt: 2,
    });
    module.tick(16);

    const ready = bridge.getValue(TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY);
    assert(ready);
    assert.strictEqual(ready.ready, true);
    assert.strictEqual(ready.reason, "attacks");
  });
});
