import assert from "assert";
import { describe, test } from "./testRunner";
import { BonusesModule } from "../src/logic/modules/shared/bonuses/bonuses.module";

describe("BonusesModule", () => {
  test("registerSource requires category and getBreakdown returns it", () => {
    const bonuses = new BonusesModule();
    bonuses.initialize();

    bonuses.registerSource(
      "skill_test",
      {
        all_units_attack_multiplier: { multiplier: (level) => 1 + 0.1 * level },
      },
      "skill"
    );
    bonuses.setSourceLevel("skill_test", 5);

    const breakdown = bonuses.getBreakdown("all_units_attack_multiplier");
    assert.strictEqual(breakdown.length, 1);
    const entry = breakdown[0]!;
    assert.strictEqual(entry.sourceId, "skill_test");
    assert.strictEqual(entry.category, "skill");
    assert.strictEqual(entry.level, 5);
    assert.strictEqual(entry.effectType, "multiplier");
    assert.ok(Math.abs(entry.value - 1.5) < 1e-6);
  });

  test("getBreakdown returns entries from multiple sources with different categories", () => {
    const bonuses = new BonusesModule();
    bonuses.initialize();

    bonuses.registerSource(
      "skill_a",
      { all_units_armor: { income: (level) => 2 * level } },
      "skill"
    );
    bonuses.registerSource(
      "building_b",
      { all_units_armor: { income: (level) => 5 * level } },
      "building"
    );
    bonuses.setSourceLevel("skill_a", 3);
    bonuses.setSourceLevel("building_b", 1);

    const breakdown = bonuses.getBreakdown("all_units_armor");
    assert.strictEqual(breakdown.length, 2);

    const bySource = new Map(breakdown.map((e) => [e.sourceId, e]));
    assert.strictEqual(bySource.get("skill_a")?.category, "skill");
    assert.strictEqual(bySource.get("skill_a")?.value, 6);
    assert.strictEqual(bySource.get("building_b")?.category, "building");
    assert.strictEqual(bySource.get("building_b")?.value, 5);
  });

  test("getBreakdown returns empty for bonus with no contributing sources", () => {
    const bonuses = new BonusesModule();
    bonuses.initialize();

    bonuses.registerSource(
      "skill_only",
      { all_units_attack_multiplier: { multiplier: () => 1.2 } },
      "skill"
    );

    const breakdown = bonuses.getBreakdown("all_units_armor");
    assert.strictEqual(breakdown.length, 0);
  });

  test("registerSource throws when sourceId already registered", () => {
    const bonuses = new BonusesModule();
    bonuses.initialize();

    bonuses.registerSource("dup", { mana_cap: { income: () => 1 } }, "misc");
    assert.throws(
      () => bonuses.registerSource("dup", { mana_cap: { income: () => 2 } }, "misc"),
      /already registered/
    );
  });

  test("applies Iron Canopy effectiveness to Iron Forest HP multiplier", () => {
    const bonuses = new BonusesModule();
    bonuses.initialize();

    bonuses.registerSource(
      "iron_forest",
      {
        all_units_hp_multiplier: {
          multiplier: (level, _context, deps) =>
            1 + 0.1 * level * (deps?.getBonusValue("iron_forest_hp_effectiveness") ?? 1),
        },
      },
      "building"
    );
    bonuses.registerSource(
      "iron_canopy",
      {
        iron_forest_hp_effectiveness: {
          multiplier: (level) => 1 + 0.05 * level,
        },
      },
      "building"
    );

    bonuses.setSourceLevel("iron_forest", 3);
    bonuses.setSourceLevel("iron_canopy", 2);

    const values = bonuses.getAllValues();
    assert(Math.abs(values.iron_forest_hp_effectiveness - 1.1) < 1e-6);
    assert(Math.abs(values.all_units_hp_multiplier - 1.33) < 1e-6);
  });
});
