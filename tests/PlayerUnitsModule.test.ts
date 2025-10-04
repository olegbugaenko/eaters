import assert from "assert";
import { describe, test } from "./testRunner";
import { SceneObjectManager } from "../src/logic/services/SceneObjectManager";
import { BricksModule } from "../src/logic/modules/BricksModule";
import { DataBridge } from "../src/logic/core/DataBridge";
import {
  PlayerUnitsModule,
  PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY,
} from "../src/logic/modules/PlayerUnitsModule";
import { MovementService } from "../src/logic/services/MovementService";

const tickSeconds = (module: PlayerUnitsModule, seconds: number) => {
  module.tick(seconds * 1000);
};

describe("PlayerUnitsModule", () => {
  test("unit destroys weak brick when in range", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const movement = new MovementService();
    const bricks = new BricksModule({ scene, bridge });
    const units = new PlayerUnitsModule({ scene, bricks, bridge, movement });

    bricks.setBricks([
      {
        position: { x: 4, y: 0 },
        rotation: 0,
        type: "smallSquareGray",
      },
    ]);

    units.setUnits([
      {
        type: "bluePentagon",
        position: { x: 0, y: 0 },
      },
    ]);

    for (let i = 0; i < 16 && bricks.getBrickStates().length > 0; i += 1) {
      tickSeconds(units, 0.5);
    }

    assert.strictEqual(bricks.getBrickStates().length, 0, "brick should be destroyed");
    const save = units.save() as { units?: { hp?: number }[] };
    assert(save.units && save.units[0], "unit should be saved");
    assert.strictEqual(save.units[0]?.hp, 38);
    assert.strictEqual(bridge.getValue(PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY), 38);
  });

  test("unit moves towards brick and gets knocked back on counter damage", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const movement = new MovementService();
    const bricks = new BricksModule({ scene, bridge });
    const units = new PlayerUnitsModule({ scene, bricks, bridge, movement });

    bricks.setBricks([
      {
        position: { x: 100, y: 0 },
        rotation: 0,
        type: "blueRadial",
      },
    ]);

    units.setUnits([
      {
        type: "bluePentagon",
        position: { x: 0, y: 0 },
      },
    ]);

    let minX = Infinity;
    for (let i = 0; i < 10; i += 1) {
      tickSeconds(units, 1);
      const snapshot = units.save() as {
        units?: { position?: { x: number; y: number } }[];
      };
      const x = snapshot.units?.[0]?.position?.x;
      if (typeof x === "number" && Number.isFinite(x)) {
        minX = Math.min(minX, x);
      }
    }

    const save = units.save() as {
      units?: { position?: { x: number; y: number }; hp?: number }[];
    };
    assert(save.units && save.units[0], "unit should be saved");
    const savedUnit = save.units[0]!;
    assert(savedUnit.position, "position should be saved");
    assert(savedUnit.position!.x > 0, "unit should advance along the x axis");
    assert(minX < 95, "unit should be pushed out of attack range during knockback");
    assert(savedUnit.position!.x > minX, "unit should return toward the target after knockback");
    assert.strictEqual(savedUnit.position!.y, 0);
    assert.strictEqual(savedUnit.hp, 31, "unit should take counter damage");
    assert.strictEqual(bridge.getValue(PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY), 31);

    const [brick] = bricks.getBrickStates();
    assert(brick, "brick should survive");
    assert.strictEqual(brick.hp, brick.maxHp);
  });
});
