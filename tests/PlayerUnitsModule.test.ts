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
import { ExplosionModule } from "../src/logic/modules/ExplosionModule";

const createBricksModule = (scene: SceneObjectManager, bridge: DataBridge) => {
  const explosions = new ExplosionModule({ scene });
  const resources = {
    grantResources: () => {
      // no-op for tests
    },
  };
  return new BricksModule({ scene, bridge, explosions, resources });
};

const tickSeconds = (module: PlayerUnitsModule, seconds: number) => {
  module.tick(seconds * 1000);
};

describe("PlayerUnitsModule", () => {
  test("unit destroys weak brick when in range", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const movement = new MovementService();
    const bricks = createBricksModule(scene, bridge);
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

    const unitObject = scene.getObjects().find((object) => object.type === "playerUnit");
    assert(unitObject, "unit scene object should be created");
    const customData = unitObject!.data.customData as {
      emitter?: unknown;
      physicalSize?: number;
    };
    assert(customData && customData.emitter, "unit should include emitter config");
    assert.strictEqual(customData?.physicalSize, 12);

    for (let i = 0; i < 16 && bricks.getBrickStates().length > 0; i += 1) {
      tickSeconds(units, 0.5);
    }

    assert.strictEqual(bricks.getBrickStates().length, 0, "brick should be destroyed");
    const save = units.save() as { units?: { hp?: number }[] };
    assert(save.units && save.units[0], "unit should be saved");
    assert.strictEqual(save.units[0]?.hp, 8);
    assert.strictEqual(bridge.getValue(PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY), 8);
  });

  test("unit moves towards brick and gets knocked back on counter damage", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const movement = new MovementService();
    const bricks = createBricksModule(scene, bridge);
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
    let savedUnit: { position?: { x: number; y: number }; hp?: number } | undefined;
    let lastAliveUnit:
      | {
          position?: { x: number; y: number };
          hp?: number;
        }
      | undefined;
    let lastAliveTotalHp: number | undefined;
    let finalTotalHp: number | undefined;

    for (let i = 0; i < 5; i += 1) {
      tickSeconds(units, 1);
      const snapshot = units.save() as {
        units?: { position?: { x: number; y: number }; hp?: number }[];
      };
      const totalHp = bridge.getValue(
        PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY
      ) as number | undefined;
      if (!snapshot.units || snapshot.units.length === 0) {
        finalTotalHp = totalHp;
        break;
      }
      savedUnit = snapshot.units[0];
      const x = savedUnit?.position?.x;
      if (typeof x === "number" && Number.isFinite(x)) {
        minX = Math.min(minX, x);
      }
      if (typeof savedUnit?.hp === "number" && savedUnit.hp > 0) {
        lastAliveUnit = savedUnit;
        lastAliveTotalHp = totalHp;
      }
    }

    assert(savedUnit, "unit should enter the observation window");
    assert(lastAliveUnit, "unit should survive long enough to move toward the target");
    const referenceUnit = lastAliveUnit ?? savedUnit;
    assert(referenceUnit.position, "position should be saved");
    assert(referenceUnit.position!.x > 0, "unit should advance along the x axis");
    assert(minX < 70, "unit should be pushed out of attack range during knockback");
    assert(referenceUnit.position!.x > minX, "unit should return toward the target after knockback");
    assert.strictEqual(referenceUnit.position!.y, 0);
    const remainingHp = referenceUnit.hp;
    assert(typeof remainingHp === "number", "unit hp should be tracked");
    assert(remainingHp > 0, "unit should survive counter damage long enough to retaliate");
    assert(remainingHp < 10, "unit should take counter damage");
    assert.strictEqual(lastAliveTotalHp, remainingHp);

    const totalHpAfter = bridge.getValue(PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY);
    if (typeof finalTotalHp === "number") {
      assert.strictEqual(totalHpAfter, finalTotalHp);
      assert.strictEqual(finalTotalHp, 0);
    } else {
      assert.strictEqual(totalHpAfter, remainingHp);
    }

    const [brick] = bricks.getBrickStates();
    assert(brick, "brick should survive");
    assert.strictEqual(brick.hp, brick.maxHp);
  });
});
