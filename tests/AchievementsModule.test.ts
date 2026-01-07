import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/logic/core/DataBridge";
import { BonusesModule } from "../src/logic/modules/shared/bonuses/bonuses.module";
import { AchievementsModule } from "../src/logic/modules/shared/achievements/achievements.module";
import type { MapStats } from "../src/logic/modules/active-map/map/map.types";

const createBonuses = (): BonusesModule => {
  const bonuses = new BonusesModule();
  bonuses.initialize();
  return bonuses;
};

const createAchievements = (bridge: DataBridge, bonuses: BonusesModule): AchievementsModule =>
  new AchievementsModule({ bridge, bonuses });

const createMegaBrickStats = (levels: number): MapStats => {
  const stats: Record<number, { success: number; failure: number; bestTimeMs: number | null }> = {};
  for (let level = 1; level <= levels; level += 1) {
    stats[level] = { success: 1, failure: 0, bestTimeMs: null };
  }
  return { megaBrick: stats };
};

const expectBrickRewards = (bonuses: BonusesModule, expected: number) => {
  const value = bonuses.getBonusValue("brick_rewards");
  assert.ok(Math.abs(value - expected) < 1e-6, `brick_rewards should be ${expected}`);
};

describe("AchievementsModule", () => {
  test("applies achievement bonus levels from map progress", () => {
    const bridge = new DataBridge();
    const bonuses = createBonuses();
    const achievements = createAchievements(bridge, bonuses);

    achievements.syncFromMapStats(createMegaBrickStats(2));

    expectBrickRewards(bonuses, 1.2);
    const payload = bridge.getValue("achievements/list");
    const megaBrickEntry = payload?.achievements?.find((entry) => entry.id === "megaBrick");
    assert.strictEqual(megaBrickEntry?.level, 2);
  });

  test("applies achievement bonus from saved levels", () => {
    const bridge = new DataBridge();
    const bonuses = createBonuses();
    const achievements = createAchievements(bridge, bonuses);

    achievements.load({ levels: { megaBrick: 2 } });

    expectBrickRewards(bonuses, 1.2);
  });
});
