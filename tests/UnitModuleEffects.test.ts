import assert from "assert";
import { describe, test } from "./testRunner";
import {
  getUnitModuleBonusEffects,
  getUnitModuleConfig,
  getUnitModuleEffects,
  UNIT_MODULE_IDS,
} from "../src/db/unit-modules-db";
import { UnitDesignModule } from "../src/logic/modules/camp/unit-design/unit-design.module";

const createUnitDesignModule = (): UnitDesignModule =>
  new UnitDesignModule({
    bridge: { setState: () => {} } as any,
    bonuses: {
      subscribe: () => () => {},
      getValues: () => ({}),
    } as any,
    workshop: {
      subscribe: () => () => {},
      getModuleLevel: () => 1,
    } as any,
    localization: {
      tUi: (_key: string, fallback: string) => fallback,
    } as any,
  });

describe("Unit module effects contract", () => {
  test("all modules expose at least one declarative effect", () => {
    UNIT_MODULE_IDS.forEach((moduleId) => {
      const effects = getUnitModuleEffects(moduleId);
      assert(effects.length > 0, `${moduleId} should define effects[]`);
    });
  });

  test("uranium whiskers applies both move speed and attack multipliers", () => {
    const module = createUnitDesignModule();
    const baseBlueprint = (module as any).createBlueprint("bluePentagon", {}, []);
    const blueprint = (module as any).createBlueprint("bluePentagon", {}, [
      {
        id: "uraniumWhiskers",
        name: "Uranium Whiskers",
        description: "",
        level: 1,
        bonusLabel: "unused",
        bonusType: "multiplier",
        bonusValue: 1.4,
        manaCostMultiplier: 1,
        sanityCost: 0,
      },
    ]);

    const uraniumEffects = getUnitModuleBonusEffects("uraniumWhiskers");
    assert.strictEqual(uraniumEffects.length, 2);
    assert(blueprint.effective.attackDamage > baseBlueprint.effective.attackDamage, "attack multiplier should apply");
    assert(blueprint.moveSpeed > baseBlueprint.moveSpeed, "move speed multiplier should apply");
  });

  test("module effects expose extended combat stats for armor penetration and knockback reduction", () => {
    const tailNeedles = getUnitModuleBonusEffects("tailNeedles");
    const silverArmor = getUnitModuleBonusEffects("silverArmor");

    assert(
      tailNeedles.some((effect) => effect.stat === "armorPenetration"),
      "tailNeedles should expose armor penetration effect",
    );
    assert(
      silverArmor.some((effect) => effect.stat === "knockbackReduction"),
      "silverArmor should expose knockback reduction effect",
    );
  });
});
