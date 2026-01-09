import assert from "assert";
import { describe, test } from "./testRunner";
import { BonusCalculator } from "../src/logic/modules/shared/bonuses/bonuses.calculator";
import type { BonusRule, BonusSourceState } from "../src/logic/modules/shared/bonuses/bonuses.types";

describe("BonusCalculator", () => {
  test("combines source effects with rule-based modifiers", () => {
    const sources: BonusSourceState[] = [
      {
        id: "source",
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
});
