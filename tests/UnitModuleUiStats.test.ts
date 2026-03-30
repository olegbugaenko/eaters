import assert from "assert";
import { describe, test } from "./testRunner";
import { UnitDesignModule } from "../src/logic/modules/camp/unit-design/unit-design.module";
import { buildUnitStatEntries } from "../src/ui/shared/unitStats";
import { createTargetTooltip } from "../src/ui/screens/Scene/components/tooltip/createTargetTooltip";

const t = (_key: string, fallback?: string) => fallback ?? _key;

const createUnitDesignModule = (
  moduleLevels?: Partial<Record<string, number>>,
  onState?: (state: any) => void,
): UnitDesignModule =>
  new UnitDesignModule({
    bridge: {
      setState: (_key: string, value: unknown) => {
        onState?.(value);
      },
    } as any,
    bonuses: {
      subscribe: () => () => {},
      getValues: () => ({}),
    } as any,
    workshop: {
      subscribe: () => () => {},
      getModuleLevel: (id: string) => moduleLevels?.[id] ?? 1,
    } as any,
    localization: {
      tUi: (_key: string, fallback: string) => fallback,
    } as any,
  });

describe("Unit module UI stat presentation", () => {
  test("biolab stat payload includes module-driven armor penetration and knockback reduction", () => {
    const module = createUnitDesignModule();
    const baseBlueprint = (module as any).createBlueprint("bluePentagon", {}, []);
    const boostedBlueprint = (module as any).createBlueprint("bluePentagon", {}, [
      {
        id: "tailNeedles",
        name: "Tail Needles",
        description: "",
        level: 1,
        bonusLabel: "unused",
        bonusType: "multiplier",
        bonusValue: 1,
        manaCostMultiplier: 1,
        sanityCost: 0,
      },
      {
        id: "silverArmor",
        name: "Silver Armor",
        description: "",
        level: 1,
        bonusLabel: "unused",
        bonusType: "multiplier",
        bonusValue: 1,
        manaCostMultiplier: 1,
        sanityCost: 0,
      },
      {
        id: "uraniumWhiskers",
        name: "Uranium Whiskers",
        description: "",
        level: 1,
        bonusLabel: "unused",
        bonusType: "multiplier",
        bonusValue: 1,
        manaCostMultiplier: 1,
        sanityCost: 0,
      },
    ]);

    assert(boostedBlueprint.armorPenetration > baseBlueprint.armorPenetration);
    assert(boostedBlueprint.knockbackReduction > baseBlueprint.knockbackReduction);

    const statEntries = buildUnitStatEntries(boostedBlueprint, t);
    const armorPenEntry = statEntries.find((entry) => entry.label === "Armor Penetration");
    assert(armorPenEntry, "armor penetration should be present in biolab stat payload");

    const bonusLines = boostedBlueprint.bonuses ?? [];
    const labels = bonusLines.map((entry: { label: string }) => entry.label);
    assert(labels.includes("Acceleration multiplier"), "uranium acceleration bonus should be exposed");
    assert(labels.includes("Attack multiplier"), "uranium attack bonus should be exposed");
  });

  test("biolab bridge state reflects uranium whiskers attack and acceleration bonuses", () => {
    let latestState: any = null;
    const module = createUnitDesignModule(
      {
        uraniumWhiskers: 1,
      },
      (state) => {
        latestState = state;
      },
    );
    module.initialize();
    const designId = module.createDesign("bluePentagon");
    module.updateDesign(designId, {
      modules: ["uraniumWhiskers"],
    });

    const unit = latestState?.units?.find((entry: any) => entry.id === designId);
    assert(unit, "expected biolab bridge state to include updated design");

    const bonusLabels = (unit.blueprint.bonuses ?? []).map((entry: { label: string }) => entry.label);
    assert(
      bonusLabels.includes("Acceleration multiplier"),
      "bridge state should include uranium acceleration bonus line",
    );
    assert(
      bonusLabels.includes("Attack multiplier"),
      "bridge state should include uranium attack bonus line",
    );
    assert(unit.blueprint.organAttackMultiplier > 1, "uranium should increase organ attack multiplier");
    assert(unit.blueprint.moveSpeed > 0, "uranium should keep positive movement speed");
  });

  test("map right-click tooltip shows declarative module status effects and abilities", () => {
    const tooltip = createTargetTooltip(
      {
        id: "unit-1",
        type: "playerUnit",
        effectiveDamage: 10,
        rewardMultiplier: 1,
        data: {
          id: "unit-1",
          type: "bluePentagon",
          level: 1,
          hp: 100,
          maxHp: 100,
          attackDamage: 10,
          armor: 1,
          baseAttackInterval: 1,
          baseAttackDistance: 20,
          moveSpeed: 10,
          soulDropChanceBonus: 0,
          moduleLevels: {
            mendingGland: 2,
            burningTail: 3,
          },
        },
      } as any,
      t,
      "Test Unit",
    );

    const labels = tooltip.stats.map((entry: { label: string }) => entry.label);
    assert(labels.includes("Healing Pulse"), "module ability should be displayed in map tooltip");
    assert(labels.includes("Melting Tail Effect"), "module status effect should be displayed in map tooltip");
  });
});
