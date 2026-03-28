import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/core/logic/ui/DataBridge";
import { ArtifactsModule } from "../src/logic/modules/camp/artifacts/artifacts.module";
import { ARTIFACTS_STATE_BRIDGE_KEY } from "../src/logic/modules/camp/artifacts/artifacts.const";
import { NewUnlockNotificationService } from "../src/logic/services/new-unlock-notification/NewUnlockNotification";
import { UnlockService } from "../src/logic/services/unlock/UnlockService";

const CLEARED = { success: 1, failure: 0, bestTimeMs: null };

function createModule() {
  const bridge = new DataBridge();
  const unlocks = new UnlockService({
    getMapStats: () => ({
      trainingGrounds: { 1: CLEARED },
      megaBrick: { 1: CLEARED },
      ancientPyramids: { 1: CLEARED },
      deathfulGuns: { 1: CLEARED },
      encagedBeast: { 1: CLEARED },
      greatOctopus: { 1: CLEARED },
    }),
    getSkillLevel: () => 0,
  });
  const newUnlocks = new NewUnlockNotificationService({ bridge });
  newUnlocks.initialize();

  const artifacts = new ArtifactsModule({ bridge, unlocks, newUnlocks });
  artifacts.initialize();
  return { bridge, artifacts };
}

function getState(bridge: DataBridge) {
  const state = bridge.getValue(ARTIFACTS_STATE_BRIDGE_KEY);
  assert(state, "bridge state is missing");
  return state;
}

function findArtifact(bridge: DataBridge, id: string) {
  const state = getState(bridge);
  const a = state.artifacts.find((x: { id: string }) => x.id === id);
  assert(a, `artifact ${id} not found`);
  return a;
}

describe("ArtifactsModule", () => {
  test("grants and equips artifact in active slot", () => {
    const { bridge, artifacts } = createModule();
    artifacts.grantArtifact("great_octopus_tentacle");
    artifacts.equipArtifact(0, "great_octopus_tentacle");

    const state = getState(bridge);
    assert.strictEqual(state.unlocked, true);
    assert.strictEqual(state.activeSlots[0], "great_octopus_tentacle");

    const a = findArtifact(bridge, "great_octopus_tentacle");
    assert.strictEqual(a.ownedCount, 1);
    assert.strictEqual(a.equippedCount, 1);
  });

  test("grant same artifact twice increments count to 2", () => {
    const { bridge, artifacts } = createModule();
    artifacts.grantArtifact("great_octopus_tentacle");
    artifacts.grantArtifact("great_octopus_tentacle");

    const a = findArtifact(bridge, "great_octopus_tentacle");
    assert.strictEqual(a.ownedCount, 2);
    assert.strictEqual(a.equippedCount, 0);
  });

  test("equip same artifact in both slots when owned 2", () => {
    const { bridge, artifacts } = createModule();
    artifacts.grantArtifact("great_octopus_tentacle");
    artifacts.grantArtifact("great_octopus_tentacle");

    artifacts.equipArtifact(0, "great_octopus_tentacle");
    artifacts.equipArtifact(1, "great_octopus_tentacle");

    const state = getState(bridge);
    assert.strictEqual(state.activeSlots[0], "great_octopus_tentacle");
    assert.strictEqual(state.activeSlots[1], "great_octopus_tentacle");

    const a = findArtifact(bridge, "great_octopus_tentacle");
    assert.strictEqual(a.equippedCount, 2);
    assert.strictEqual(a.ownedCount - a.equippedCount, 0);
  });

  test("cannot equip more copies than owned", () => {
    const { bridge, artifacts } = createModule();
    artifacts.grantArtifact("great_octopus_tentacle");

    artifacts.equipArtifact(0, "great_octopus_tentacle");
    artifacts.equipArtifact(1, "great_octopus_tentacle");

    const state = getState(bridge);
    assert.strictEqual(state.activeSlots[0], "great_octopus_tentacle");
    assert.strictEqual(state.activeSlots[1], null);

    const a = findArtifact(bridge, "great_octopus_tentacle");
    assert.strictEqual(a.equippedCount, 1);
  });

  test("unequip one slot restores unequippedCount", () => {
    const { bridge, artifacts } = createModule();
    artifacts.grantArtifact("great_octopus_tentacle");
    artifacts.grantArtifact("great_octopus_tentacle");

    artifacts.equipArtifact(0, "great_octopus_tentacle");
    artifacts.equipArtifact(1, "great_octopus_tentacle");
    artifacts.unequipSlot(0);

    const state = getState(bridge);
    assert.strictEqual(state.activeSlots[0], null);
    assert.strictEqual(state.activeSlots[1], "great_octopus_tentacle");

    const a = findArtifact(bridge, "great_octopus_tentacle");
    assert.strictEqual(a.equippedCount, 1);
    assert.strictEqual(a.ownedCount - a.equippedCount, 1);
  });

  test("modifiers stack across multiple equipped slots", () => {
    const { artifacts } = createModule();
    artifacts.grantArtifact("great_octopus_tentacle");
    artifacts.grantArtifact("great_octopus_tentacle");

    artifacts.equipArtifact(0, "great_octopus_tentacle");
    artifacts.equipArtifact(1, "great_octopus_tentacle");

    const mods = artifacts.getModifiers();
    assert.strictEqual(mods.maxUnitsFlat, 10);
  });

  test("save and load round-trip preserves stackable format", () => {
    const { bridge, artifacts } = createModule();
    artifacts.grantArtifact("great_octopus_tentacle");
    artifacts.grantArtifact("great_octopus_tentacle");
    artifacts.grantArtifact("great_octopus_tentacle");
    artifacts.equipArtifact(0, "great_octopus_tentacle");

    const saved = artifacts.save();

    const { bridge: bridge2, artifacts: artifacts2 } = createModule();
    artifacts2.load(saved);

    const a = findArtifact(bridge2, "great_octopus_tentacle");
    assert.strictEqual(a.ownedCount, 3);
    assert.strictEqual(a.equippedCount, 1);

    const state = getState(bridge2);
    assert.strictEqual(state.activeSlots[0], "great_octopus_tentacle");
  });

  test("load legacy format (ArtifactId[]) converts to stackable", () => {
    const { bridge, artifacts } = createModule();
    artifacts.load({
      owned: ["great_octopus_tentacle"],
      activeSlots: ["great_octopus_tentacle", null],
    });

    const a = findArtifact(bridge, "great_octopus_tentacle");
    assert.strictEqual(a.ownedCount, 1);
    assert.strictEqual(a.equippedCount, 1);

    const state = getState(bridge);
    assert.strictEqual(state.activeSlots[0], "great_octopus_tentacle");
  });
});
