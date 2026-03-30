import assert from "assert";
import { describe, test } from "./testRunner";
import { UnitDesignModule } from "../src/logic/modules/camp/unit-design/unit-design.module";
import { UNIT_DESIGNER_STATE_BRIDGE_KEY } from "../src/logic/modules/camp/unit-design/unit-design.const";
import type { UnitModuleId } from "../src/db/unit-modules-db";

type DesignerState = {
  units: Array<{
    id: string;
    blueprint: {
      effective: { maxHp: number; attackDamage: number };
      armor: number;
      moveSpeed: number;
      armorPenetration: number;
      knockbackReduction: number;
      bonuses?: Array<{ label: string }>;
      organAttackMultiplier?: number;
    };
  }>;
};

const createHarness = (levels: Partial<Record<UnitModuleId, number>>) => {
  let latestState: DesignerState | null = null;
  const module = new UnitDesignModule({
    bridge: {
      setState: (key: string, value: unknown) => {
        if (key === UNIT_DESIGNER_STATE_BRIDGE_KEY) {
          latestState = value as DesignerState;
        }
      },
    } as any,
    bonuses: {
      subscribe: () => () => {},
      getValues: () => ({}),
    } as any,
    workshop: {
      subscribe: () => () => {},
      getModuleLevel: (id: UnitModuleId) => levels[id] ?? 0,
    } as any,
    localization: {
      tUi: (_key: string, fallback: string) => fallback,
      getUnitModuleText: (_id: string, fallback: any) => fallback,
    } as any,
  });

  module.initialize();
  const designId = module.createDesign("bluePentagon");
  const getUnit = () => {
    const unit = latestState?.units.find((entry) => entry.id === designId);
    assert(unit, "expected design in unit designer bridge state");
    return unit!;
  };

  return { module, designId, getUnit };
};

describe("Unit module effects are applied in biolab bridge payload", () => {
  test("iron forge increases attack damage when equipped", () => {
    const { module, designId, getUnit } = createHarness({ ironForge: 1 });
    const baseline = getUnit().blueprint;

    module.updateDesign(designId, { modules: ["ironForge"] });
    const boosted = getUnit().blueprint;

    assert(
      boosted.effective.attackDamage > baseline.effective.attackDamage,
      "iron forge should increase attack damage",
    );
  });

  test("uranium whiskers increases both attack and move speed", () => {
    const { module, designId, getUnit } = createHarness({ uraniumWhiskers: 1 });
    const baseline = getUnit().blueprint;

    module.updateDesign(designId, { modules: ["uraniumWhiskers"] });
    const boosted = getUnit().blueprint;

    assert(boosted.effective.attackDamage > baseline.effective.attackDamage);
    assert(boosted.moveSpeed > baseline.moveSpeed);
    assert((boosted.organAttackMultiplier ?? 1) > 1);
    const labels = (boosted.bonuses ?? []).map((line) => line.label);
    assert(labels.includes("Move speed multiplier"));
    assert(labels.includes("Attack multiplier"));
  });

  test("vital hull, silver armor and tail needles modify their target stats", () => {
    const { module, designId, getUnit } = createHarness({
      vitalHull: 1,
      silverArmor: 1,
      tailNeedles: 1,
    });
    const baseline = getUnit().blueprint;

    module.updateDesign(designId, { modules: ["vitalHull", "silverArmor", "tailNeedles"] });
    const boosted = getUnit().blueprint;

    assert(boosted.effective.maxHp > baseline.effective.maxHp, "vital hull should raise HP");
    assert(boosted.armor > baseline.armor, "silver armor should raise armor");
    assert(
      boosted.knockbackReduction > baseline.knockbackReduction,
      "silver armor knockback reduction effect should apply",
    );
    assert(
      boosted.armorPenetration > baseline.armorPenetration,
      "tail needles armor penetration effect should apply",
    );
  });
});
