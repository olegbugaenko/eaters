import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/core/logic/ui/DataBridge";
import { ArtifactsModule } from "../src/logic/modules/camp/artifacts/artifacts.module";
import { ARTIFACTS_STATE_BRIDGE_KEY } from "../src/logic/modules/camp/artifacts/artifacts.const";
import { NewUnlockNotificationService } from "../src/logic/services/new-unlock-notification/NewUnlockNotification";
import { UnlockService } from "../src/logic/services/unlock/UnlockService";

describe("ArtifactsModule", () => {
  test("grants and equips artifact in active slot", () => {
    const bridge = new DataBridge();
    const unlocks = new UnlockService({
      getMapStats: () => ({ greatOctopus: { 1: { success: 1, failure: 0, bestTimeMs: null } } }),
      getSkillLevel: () => 0,
    });
    const newUnlocks = new NewUnlockNotificationService({ bridge });
    newUnlocks.initialize();

    const artifacts = new ArtifactsModule({ bridge, unlocks, newUnlocks });
    artifacts.initialize();
    artifacts.grantArtifact("great_octopus_tentacle");
    artifacts.equipArtifact(0, "great_octopus_tentacle");

    const state = bridge.getValue(ARTIFACTS_STATE_BRIDGE_KEY);
    assert(state);
    assert.strictEqual(state.unlocked, true);
    assert.strictEqual(state.activeSlots[0], "great_octopus_tentacle");
    assert.strictEqual(state.artifacts[0]?.owned, true);
  });
});
