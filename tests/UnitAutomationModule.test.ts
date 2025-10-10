import assert from "assert";
import { describe, test } from "./testRunner";
import { DataBridge } from "../src/logic/core/DataBridge";
import {
  DEFAULT_UNIT_AUTOMATION_STATE,
  UNIT_AUTOMATION_STATE_BRIDGE_KEY,
  UnitAutomationBridgeState,
  UnitAutomationModule,
} from "../src/logic/modules/UnitAutomationModule";
import { PLAYER_UNIT_TYPES, PlayerUnitType } from "../src/db/player-units-db";

describe("UnitAutomationModule", () => {
  test("automatically summons enabled units once the skill is unlocked", () => {
    const bridge = new DataBridge();
    const attempts: PlayerUnitType[] = [];
    const necromancer = {
      trySpawnUnit: (type: PlayerUnitType) => {
        attempts.push(type);
        return true;
      },
    };
    let skillLevel = 0;
    const module = new UnitAutomationModule({
      bridge,
      necromancer,
      getSkillLevel: () => skillLevel,
    });

    module.initialize();
    const initialState =
      bridge.getValue<UnitAutomationBridgeState>(
        UNIT_AUTOMATION_STATE_BRIDGE_KEY
      ) ?? DEFAULT_UNIT_AUTOMATION_STATE;
    assert.strictEqual(initialState.unlocked, false);

    const unitType = PLAYER_UNIT_TYPES[0];
    assert(unitType, "expected at least one unit type for automation tests");
    module.setAutomationEnabled(unitType, true);
    module.tick(16);
    assert.strictEqual(attempts.length, 0, "should not spawn before unlock");

    skillLevel = 1;
    module.tick(16);
    assert.strictEqual(attempts.length, 1, "should attempt to spawn after unlock");
    assert.strictEqual(attempts[0], unitType);

    const unlockedState =
      bridge.getValue<UnitAutomationBridgeState>(
        UNIT_AUTOMATION_STATE_BRIDGE_KEY
      ) ?? DEFAULT_UNIT_AUTOMATION_STATE;
    const unitState = unlockedState.units.find((entry) => entry.type === unitType);
    assert.strictEqual(unlockedState.unlocked, true);
    assert.strictEqual(unitState?.enabled, true);
  });
});
