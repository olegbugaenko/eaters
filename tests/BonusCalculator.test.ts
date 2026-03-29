import assert from "assert";
import { describe, test } from "./testRunner";
import { BonusCalculator } from "../src/logic/modules/shared/bonuses/bonuses.calculator";
import type { BonusRule, BonusSourceState } from "../src/logic/modules/shared/bonuses/bonuses.types";

describe("BonusCalculator", () => {
  test("combines source effects with rule-based modifiers", () => {
    const sources: BonusSourceState[] = [
      {
        id: "source",
        category: "misc",
        level: 1,
        effects: {
          mana_cap: {
            income: () => 5,
            multiplier: () => 2,
          },
        },
      },
    ];

    const rules: BonusRule[] = [
      {
        bonusId: "mana_cap",
        requires: {
          progressionKeys: ["skill:mana"],
        },
        effects: {
          addFlat: 3,
          addMultiplier: 0.1,
        },
      },
    ];

    const withoutRule = BonusCalculator.calculate({
      sources,
      effectContext: {},
      rules,
      ruleContext: {},
    });
    assert.strictEqual(withoutRule.mana_cap, 30);

    const withRule = BonusCalculator.calculate({
      sources,
      effectContext: {},
      rules,
      ruleContext: { progressionKeys: ["skill:mana"] },
    });
    assert(Math.abs(withRule.mana_cap - 39.6) < 1e-6);
  });

  test("supports cross-bonus dependencies in formulas", () => {
    const sources: BonusSourceState[] = [
      {
        id: "canopy",
        category: "building",
        level: 2,
        effects: {
          iron_forest_hp_effectiveness: {
            multiplier: (level) => 1 + 0.05 * level,
          },
        },
      },
      {
        id: "forest",
        category: "building",
        level: 3,
        effects: {
          all_units_hp_multiplier: {
            multiplier: (level, _context, deps) =>
              1 + 0.1 * level * (deps?.getBonusValue("iron_forest_hp_effectiveness") ?? 1),
          },
        },
      },
    ];

    const values = BonusCalculator.calculate({
      sources,
      effectContext: {},
      rules: [],
      ruleContext: {},
    });

    assert(Math.abs(values.iron_forest_hp_effectiveness - 1.1) < 1e-6);
    assert(Math.abs(values.all_units_hp_multiplier - 1.33) < 1e-6);
  });

  test("throws on cyclic bonus dependencies", () => {
    const sources: BonusSourceState[] = [
      {
        id: "cycle",
        category: "misc",
        level: 1,
        effects: {
          mana_cap: {
            base: (_level, _context, deps) => deps?.getBonusValue("sanity_cap") ?? 0,
          },
          sanity_cap: {
            base: (_level, _context, deps) => deps?.getBonusValue("mana_cap") ?? 0,
          },
        },
      },
    ];

    assert.throws(
      () =>
        BonusCalculator.calculate({
          sources,
          effectContext: {},
          rules: [],
          ruleContext: {},
        }),
      /Cyclic bonus dependency detected/
    );
  });
});
