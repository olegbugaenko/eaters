import assert from "assert";
import { describe, test } from "./testRunner";
import { UnlockService } from "../src/logic/services/unlock/UnlockService";
import type { MapStats } from "../src/logic/modules/active-map/map/map.types";
import { SkillTreeModule } from "../src/logic/modules/camp/skill-tree/skill-tree.module";
import { DataBridge } from "../src/core/logic/ui/DataBridge";
import { createEmptyResourceStockpile, RESOURCE_IDS } from "../src/db/resources-db";
import type { ResourcesModule } from "../src/logic/modules/shared/resources/resources.module";
import type { BonusesModule } from "../src/logic/modules/shared/bonuses/bonuses.module";
import type { EventLogModule } from "../src/logic/modules/shared/event-log/event-log.module";

const createResourcesStub = (): ResourcesModule => {
  const totals = createEmptyResourceStockpile();
  RESOURCE_IDS.forEach((id) => {
    totals[id] = 100000;
  });
  return {
    getTotals: () => totals,
    canAfford: () => true,
    spendResources: () => true,
  } as unknown as ResourcesModule;
};

const createBonusesStub = (): BonusesModule =>
  ({
    registerSource: () => {},
    setBonusCurrentLevel: () => {},
    subscribe: () => () => {},
    getBonusEffects: () => [],
  } as unknown as BonusesModule);

const createEventLogStub = (): EventLogModule =>
  ({
    registerEvent: () => {},
  } as unknown as EventLogModule);

describe("demo locks", () => {
  test("locks demo maps and skills", () => {
    const env = process.env as Record<string, string | undefined>;
    const previousDemo = env.IS_DEMO;
    env.IS_DEMO = "1";

    const mapStats: MapStats = {
      trainingGrounds: {
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
      foundations: {
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
      initial: {
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
      oldForge: {
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
      wire: {
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
      silverRing: {
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
    };
    const unlocks = new UnlockService({
      getMapStats: () => mapStats,
      getSkillLevel: () => 1,
    });

    assert.strictEqual(unlocks.canAccessMapLevel("frozenForest", 1), false);

    const skillTree = new SkillTreeModule({
      bridge: new DataBridge(),
      resources: createResourcesStub(),
      bonuses: createBonusesStub(),
      eventLog: createEventLogStub(),
    });
    skillTree.initialize();
    skillTree.load({ levels: { pheromones: 1 } });

    assert.strictEqual(skillTree.tryPurchaseSkill("ice_mastery"), false);

    if (previousDemo === undefined) {
      delete env.IS_DEMO;
    } else {
      env.IS_DEMO = previousDemo;
    }
  });

  test("allows maps and skills when demo flag is off", () => {
    const env = process.env as Record<string, string | undefined>;
    const previousDemo = env.IS_DEMO;
    delete env.IS_DEMO;

    const mapStats: MapStats = {
      trainingGrounds: {
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
      foundations: {
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
      initial: {
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
      oldForge: {
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
      wire: {
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
      silverRing: {
        1: { success: 1, failure: 0, bestTimeMs: null },
      },
    };
    const unlocks = new UnlockService({
      getMapStats: () => mapStats,
      getSkillLevel: () => 1,
    });

    assert.strictEqual(unlocks.canAccessMapLevel("frozenForest", 1), true);

    const skillTree = new SkillTreeModule({
      bridge: new DataBridge(),
      resources: createResourcesStub(),
      bonuses: createBonusesStub(),
      eventLog: createEventLogStub(),
    });
    skillTree.initialize();
    skillTree.load({ levels: { pheromones: 1 } });

    assert.strictEqual(skillTree.tryPurchaseSkill("ice_mastery"), true);

    if (previousDemo === undefined) {
      delete env.IS_DEMO;
    } else {
      env.IS_DEMO = previousDemo;
    }
  });
});
