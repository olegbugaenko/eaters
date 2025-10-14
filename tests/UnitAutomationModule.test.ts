import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/logic/core/DataBridge";
import {
  DEFAULT_UNIT_AUTOMATION_STATE,
  UNIT_AUTOMATION_STATE_BRIDGE_KEY,
  UnitAutomationBridgeState,
  UnitAutomationModule,
} from "../src/logic/modules/UnitAutomationModule";
import { PLAYER_UNIT_TYPES } from "../src/db/player-units-db";
import { UnitDesignId, UnitDesignerUnitState } from "../src/logic/modules/UnitDesignModule";
import { createEmptyResourceAmount } from "../src/types/resources";
import { PlayerUnitBlueprintStats } from "../src/types/player-units";

describe("UnitAutomationModule", () => {
  test("automatically summons enabled units once the skill is unlocked", () => {
    const bridge = new DataBridge();
    const attempts: UnitDesignId[] = [];
    const necromancer = {
      trySpawnDesign: (id: UnitDesignId) => {
        attempts.push(id);
        return true;
      },
    };
    let skillLevel = 0;
    const unitType = PLAYER_UNIT_TYPES[0];
    assert(unitType, "expected at least one unit type for automation tests");
    const blueprint: PlayerUnitBlueprintStats = {
      type: unitType,
      name: "Test",
      base: { maxHp: 10, attackDamage: 5 },
      effective: { maxHp: 10, attackDamage: 5 },
      multipliers: { maxHp: 1, attackDamage: 1 },
      critChance: { base: 0, bonus: 0, effective: 0 },
      critMultiplier: { base: 2, multiplier: 0, effective: 2 },
      armor: 0,
      hpRegenPerSecond: 0,
      hpRegenPercentage: 0,
      armorPenetration: 0,
      baseAttackInterval: 1,
      baseAttackDistance: 100,
      moveSpeed: 1,
      moveAcceleration: 1,
      mass: 1,
      physicalSize: 1,
    };
    const design: UnitDesignerUnitState = {
      id: "design-1",
      type: unitType,
      name: "Test",
      modules: [],
      moduleDetails: [],
      cost: createEmptyResourceAmount(),
      blueprint,
      runtime: {
        rewardMultiplier: 1,
        damageTransferPercent: 0,
        damageTransferRadius: 0,
        attackStackBonusPerHit: 0,
        attackStackBonusCap: 0,
      },
    };
    const unitDesigns = {
      subscribe: (listener: (designs: readonly UnitDesignerUnitState[]) => void) => {
        listener([design]);
        return () => undefined;
      },
      getDefaultDesignForType: () => design,
      getActiveRosterDesigns: () => [design],
    };
    const module = new UnitAutomationModule({
      bridge,
      necromancer,
      unitDesigns,
      getSkillLevel: () => skillLevel,
    });

    module.initialize();
    const initialState =
      bridge.getValue<UnitAutomationBridgeState>(
        UNIT_AUTOMATION_STATE_BRIDGE_KEY
      ) ?? DEFAULT_UNIT_AUTOMATION_STATE;
    assert.strictEqual(initialState.unlocked, false);

    module.setAutomationEnabled(design.id, true);
    module.tick(16);
    assert.strictEqual(attempts.length, 0, "should not spawn before unlock");

    skillLevel = 1;
    module.tick(16);
    assert.strictEqual(attempts.length, 1, "should attempt to spawn after unlock");
    assert.strictEqual(attempts[0], design.id);

    const unlockedState =
      bridge.getValue<UnitAutomationBridgeState>(
        UNIT_AUTOMATION_STATE_BRIDGE_KEY
      ) ?? DEFAULT_UNIT_AUTOMATION_STATE;
    const unitState = unlockedState.units.find((entry) => entry.designId === design.id);
    assert.strictEqual(unlockedState.unlocked, true);
    assert.strictEqual(unitState?.enabled, true);
  });
});
