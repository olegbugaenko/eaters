import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/core/logic/ui/DataBridge";
import { BonusesModule } from "../src/logic/modules/shared/bonuses/bonuses.module";
import { NewUnlockNotificationService } from "../src/logic/services/new-unlock-notification/NewUnlockNotification";
import { DarkResearchModule } from "../src/logic/modules/camp/dark-research/dark-research.module";
import { DARK_RESEARCH_STATE_BRIDGE_KEY } from "../src/logic/modules/camp/dark-research/dark-research.const";
import type { DarkResearchBridgeState } from "../src/logic/modules/camp/dark-research/dark-research.types";
import { getSkillConfig } from "../src/db/skills-db";

const getState = (bridge: DataBridge): DarkResearchBridgeState =>
  (bridge.getValue(DARK_RESEARCH_STATE_BRIDGE_KEY) as DarkResearchBridgeState) ?? {
    unlocked: false,
    totalSouls: 0,
    freeSouls: 0,
    researches: [],
  };

const createModule = (getSkillLevel: () => number) => {
  const bridge = new DataBridge();
  const bonuses = new BonusesModule();
  bonuses.initialize();
  const newUnlocks = new NewUnlockNotificationService({ bridge });
  newUnlocks.initialize();

  const module = new DarkResearchModule({
    bridge,
    bonuses,
    newUnlocks,
    getSkillLevel,
  });

  return { module, bridge, bonuses };
};

describe("DarkResearchModule", () => {
  test("Souls Harvest skill is configured as Dark Research unlock", () => {
    const config = getSkillConfig("souls_harvest");
    assert.deepStrictEqual(config.nodesRequired, { refinement2: 5 });
    assert.strictEqual(config.cost(1).silver, 5000);
    assert.deepStrictEqual(config.nodePosition, { x: 0, y: 6 });
  });

  test("stays locked until Souls Harvest is purchased", () => {
    let soulsHarvestLevel = 0;
    const { module, bridge } = createModule(() => soulsHarvestLevel);

    module.initialize();
    assert.strictEqual(getState(bridge).unlocked, false);

    soulsHarvestLevel = 1;
    module.tick(0);

    const unlocked = getState(bridge);
    assert.strictEqual(unlocked.unlocked, true);
    assert.strictEqual(unlocked.researches.length, 4);
  });

  test("does not gain XP without assigned souls", () => {
    const { module, bridge } = createModule(() => 1);

    module.initialize();
    const before = getState(bridge).researches.map((entry) => ({ id: entry.id, xp: entry.xp }));

    module.tick(120_000);

    const after = getState(bridge).researches;
    after.forEach((entry) => {
      const prev = before.find((item) => item.id === entry.id);
      assert.ok(prev);
      assert.strictEqual(entry.xp, prev.xp);
      assert.strictEqual(entry.xpPerSecond, 0);
    });
  });

  test("assigned souls provide XP gain and level ups", () => {
    const { module, bridge } = createModule(() => 1);

    module.initialize();
    module.addSoulsFromEnemyKill(10, 1);
    module.setAssignedSouls("darkest_endurance", 5);
    module.tick(25_000);

    const state = getState(bridge);
    const darkest = state.researches.find((entry) => entry.id === "darkest_endurance");
    assert.ok(darkest);
    assert.strictEqual(darkest!.xpPerSecond, 5);
    assert.ok(darkest!.xp > 0, "research should gain xp from assigned souls");
    assert.ok(darkest!.level >= 1, "research should level up after enough XP");
  });

  test("assigned souls are clamped by free souls", () => {
    const { module, bridge } = createModule(() => 1);

    module.initialize();
    module.addSoulsFromEnemyKill(2, 1); // 2 souls
    module.setAssignedSouls("dark_armor", 10);
    module.setAssignedSouls("bite_of_void", 10);

    const state = getState(bridge);
    const darkArmor = state.researches.find((entry) => entry.id === "dark_armor");
    const biteOfVoid = state.researches.find((entry) => entry.id === "bite_of_void");
    assert.ok(darkArmor && biteOfVoid);
    assert.strictEqual(darkArmor!.assignedSouls, 2);
    assert.strictEqual(biteOfVoid!.assignedSouls, 0);
    assert.strictEqual(state.freeSouls, 0);
    assert.strictEqual(state.totalSouls, 2);
  });

  test("auto-assign percent allocates new free souls on tick", () => {
    const { module, bridge } = createModule(() => 1);

    module.initialize();
    module.setAutoAssignPercent("dark_armor", 10);

    module.addSoulsFromEnemyKill(90, 1);
    module.tick(1000);

    let state = getState(bridge);
    let darkArmor = state.researches.find((entry) => entry.id === "dark_armor");
    assert.ok(darkArmor);
    assert.strictEqual(darkArmor!.assignedSouls, 9);

    module.addSoulsFromEnemyKill(20, 1);
    module.tick(1000);

    state = getState(bridge);
    darkArmor = state.researches.find((entry) => entry.id === "dark_armor");
    assert.ok(darkArmor);
    assert.strictEqual(darkArmor!.assignedSouls, 11);
    assert.strictEqual(darkArmor!.autoAssignPercent, 10);
  });

  test("auto-assign total percent cannot exceed 100", () => {
    const { module, bridge } = createModule(() => 1);

    module.initialize();
    module.setAutoAssignPercent("dark_armor", 70);
    module.setAutoAssignPercent("darkest_endurance", 50);

    const state = getState(bridge);
    const darkArmor = state.researches.find((entry) => entry.id === "dark_armor");
    const darkest = state.researches.find((entry) => entry.id === "darkest_endurance");
    assert.ok(darkArmor && darkest);
    assert.strictEqual(darkArmor!.autoAssignPercent, 70);
    assert.strictEqual(darkest!.autoAssignPercent, 30);
    assert.ok(
      state.researches.reduce((sum, entry) => sum + entry.autoAssignPercent, 0) <= 100,
      "sum of auto-assign percents should never exceed 100"
    );
  });

  test("returns zero soul drop chance while dark research is locked", () => {
    let soulsHarvestLevel = 0;
    const { module } = createModule(() => soulsHarvestLevel);

    module.initialize();
    assert.strictEqual(module.getSoulDropChance(), 0);

    soulsHarvestLevel = 1;
    module.tick(0);
    assert.strictEqual(module.getSoulDropChance(), 0.1);
  });

  test("applies soul drop chance bonus as multiplier", () => {
    const { module, bonuses } = createModule(() => 1);
    bonuses.registerSource("test_soul_bonus", {
      soul_drop_chance_add: { income: () => 0.1 },
    });
    bonuses.setBonusCurrentLevel("test_soul_bonus", 1);

    module.initialize();

    assert.ok(Math.abs(module.getSoulDropChance() - 0.11) < 1e-9);
  });

  test("updates bonus values from research levels", () => {
    const { module, bonuses } = createModule(() => 1);

    module.initialize();
    module.addSoulsFromEnemyKill(100, 1);
    module.setAssignedSouls("bite_of_void", 100);

    const before = bonuses.getBonusValue("all_units_attack_multiplier");
    module.tick(5_000);
    const after = bonuses.getBonusValue("all_units_attack_multiplier");

    assert.ok(after > before, "Bite of Void should increase attack multiplier as it levels");
  });
});
