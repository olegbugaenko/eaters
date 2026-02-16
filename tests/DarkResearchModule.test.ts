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
    researches: [],
  };

describe("DarkResearchModule", () => {
  test("Souls Harvest skill is configured as Dark Research unlock", () => {
    const config = getSkillConfig("souls_harvest");
    assert.deepStrictEqual(config.nodesRequired, { refinement2: 5 });
    assert.strictEqual(config.cost(1).silver, 5000);
    assert.deepStrictEqual(config.nodePosition, { x: 0, y: 6 });
  });

  test("stays locked until Souls Harvest is purchased", () => {
    const bridge = new DataBridge();
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const newUnlocks = new NewUnlockNotificationService({ bridge });
    newUnlocks.initialize();

    let soulsHarvestLevel = 0;
    const module = new DarkResearchModule({
      bridge,
      bonuses,
      newUnlocks,
      getSkillLevel: () => soulsHarvestLevel,
    });

    module.initialize();
    assert.strictEqual(getState(bridge).unlocked, false);

    soulsHarvestLevel = 1;
    module.tick(0);

    const unlocked = getState(bridge);
    assert.strictEqual(unlocked.unlocked, true);
    assert.strictEqual(unlocked.researches.length, 4);
  });

  test("grants 1 XP/sec and levels up by formula", () => {
    const bridge = new DataBridge();
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const newUnlocks = new NewUnlockNotificationService({ bridge });
    newUnlocks.initialize();

    const module = new DarkResearchModule({
      bridge,
      bonuses,
      newUnlocks,
      getSkillLevel: () => 1,
    });

    module.initialize();
    module.tick(120_000);

    const state = getState(bridge);
    const darkest = state.researches.find((entry) => entry.id === "darkest_endurance");
    assert.ok(darkest);
    assert.ok(darkest.level >= 1, "research should level up after enough XP");
  });

  test("updates bonus values from research levels", () => {
    const bridge = new DataBridge();
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const newUnlocks = new NewUnlockNotificationService({ bridge });
    newUnlocks.initialize();

    const module = new DarkResearchModule({
      bridge,
      bonuses,
      newUnlocks,
      getSkillLevel: () => 1,
    });

    module.initialize();
    const before = bonuses.getBonusValue("all_units_attack_multiplier");
    module.tick(600_000);
    const after = bonuses.getBonusValue("all_units_attack_multiplier");

    assert.ok(after > before, "Bite of Void should increase attack multiplier as it levels");
  });
});
