import assert from "assert";
import { describe, test } from "./testRunner";
import { SceneObjectManager } from "../src/logic/services/SceneObjectManager";
import { BricksModule } from "../src/logic/modules/BricksModule";
import { DataBridge } from "../src/logic/core/DataBridge";
import { PlayerUnitsModule } from "../src/logic/modules/PlayerUnitsModule";

const tickSeconds = (module: PlayerUnitsModule, seconds: number) => {
  module.tick(seconds * 1000);
};

describe("PlayerUnitsModule", () => {
  test("unit destroys weak brick when in range", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const bricks = new BricksModule({ scene, bridge });
    const units = new PlayerUnitsModule({ scene, bricks });

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

    tickSeconds(units, 1);

    assert.strictEqual(bricks.getBrickStates().length, 0, "brick should be destroyed");
    const save = units.save() as { units?: { hp?: number }[] };
    assert(save.units && save.units[0], "unit should be saved");
    assert.strictEqual(save.units[0]?.hp, 40);
  });

  test("unit moves towards brick and gets knocked back on counter damage", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const bricks = new BricksModule({ scene, bridge });
    const units = new PlayerUnitsModule({ scene, bricks });

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

    tickSeconds(units, 1);
    tickSeconds(units, 1);
    tickSeconds(units, 1);

    const save = units.save() as {
      units?: { position?: { x: number; y: number }; hp?: number }[];
    };
    assert(save.units && save.units[0], "unit should be saved");
    const savedUnit = save.units[0]!;
    assert(savedUnit.position, "position should be saved");
    assert(Math.abs(savedUnit.position!.x - 75) < 0.0001, "unit should be knocked back to x≈75");
    assert.strictEqual(savedUnit.position!.y, 0);
    assert.strictEqual(savedUnit.hp, 33, "unit should take counter damage");

    const [brick] = bricks.getBrickStates();
    assert(brick, "brick should survive");
    assert.strictEqual(brick.hp, brick.maxHp);
  });
});
