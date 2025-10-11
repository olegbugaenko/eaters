import assert from "assert";
import { describe, test } from "./testRunner";
import {
  FILL_TYPES,
  SceneObjectManager,
} from "../src/logic/services/SceneObjectManager";
import { BricksModule } from "../src/logic/modules/BricksModule";
import { DataBridge } from "../src/logic/core/DataBridge";
import {
  PlayerUnitsModule,
  PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY,
} from "../src/logic/modules/PlayerUnitsModule";
import { MovementService } from "../src/logic/services/MovementService";
import { ExplosionModule } from "../src/logic/modules/ExplosionModule";
import { BonusesModule } from "../src/logic/modules/BonusesModule";
import { PlayerUnitEmitterConfig } from "../src/db/player-units-db";

const createBricksModule = (
  scene: SceneObjectManager,
  bridge: DataBridge,
  bonuses: BonusesModule,
  explosions: ExplosionModule
) => {
  const resources = {
    grantResources: () => {
      // no-op for tests
    },
    notifyBrickDestroyed: () => {
      // no-op for tests
    },
  };
  return new BricksModule({ scene, bridge, explosions, resources, bonuses });
};

const tickSeconds = (module: PlayerUnitsModule, seconds: number) => {
  module.tick(seconds * 1000);
};

describe("PlayerUnitsModule", () => {
  test("unit destroys weak brick when in range", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const movement = new MovementService();
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const explosions = new ExplosionModule({ scene });
    const bricks = createBricksModule(scene, bridge, bonuses, explosions);
    const units = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
    });

    bricks.setBricks([
      {
        position: { x: 4, y: 0 },
        rotation: 0,
        level: 0,
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
    const emitter = customData.emitter as PlayerUnitEmitterConfig;
    assert.strictEqual(emitter.shape, "circle");
    assert(emitter.fill, "unit emitter should include gradient fill");
    assert.strictEqual(emitter.fill.fillType, FILL_TYPES.RADIAL_GRADIENT);
    const firstStop = emitter.fill.stops[0];
    const lastStop = emitter.fill.stops[emitter.fill.stops.length - 1];
    assert(firstStop, "gradient should include a starting stop");
    assert(lastStop, "gradient should include an ending stop");
    assert.strictEqual(firstStop!.color.a, 0.25);
    assert.strictEqual(lastStop!.color.a, 0);
    assert.strictEqual(customData?.physicalSize, 12);

    for (let i = 0; i < 16 && bricks.getBrickStates().length > 0; i += 1) {
      tickSeconds(units, 0.5);
    }

    assert.strictEqual(bricks.getBrickStates().length, 0, "brick should be destroyed");
    assert.strictEqual(bridge.getValue(PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY), 4);
  });

  test("unit moves towards brick and gets knocked back on counter damage", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const movement = new MovementService();
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const explosions = new ExplosionModule({ scene });
    const bricks = createBricksModule(scene, bridge, bonuses, explosions);
    const units = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
    });

    bricks.setBricks([
      {
        position: { x: 100, y: 0 },
        rotation: 0,
        level: 0,
        type: "blueRadial",
      },
    ]);

    units.setUnits([
      {
        type: "bluePentagon",
        position: { x: 0, y: 0 },
      },
    ]);

    const getUnitObject = () =>
      scene.getObjects().find((object) => object.type === "playerUnit");

    let minX = Infinity;
    let lastKnownPosition: { x: number; y: number } | undefined;
    let lastAlivePosition: { x: number; y: number } | undefined;
    let lastAliveHp: number | undefined;
    let lastAliveTotalHp: number | undefined;
    let finalTotalHp: number | undefined;

    for (let i = 0; i < 5; i += 1) {
      tickSeconds(units, 1);
      const totalHp = bridge.getValue(
        PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY
      ) as number | undefined;
      const unitObject = getUnitObject();
      if (!unitObject) {
        finalTotalHp = totalHp;
        break;
      }
      const position = unitObject.data.position;
      lastKnownPosition = { ...position };
      const x = position.x;
      if (typeof x === "number" && Number.isFinite(x)) {
        minX = Math.min(minX, x);
      }
      const currentHp = typeof totalHp === "number" ? totalHp : undefined;
      if (typeof currentHp === "number" && currentHp > 0) {
        lastAlivePosition = { ...position };
        lastAliveHp = currentHp;
        lastAliveTotalHp = totalHp;
      }
    }

    assert(lastKnownPosition, "unit should enter the observation window");
    assert(lastAlivePosition, "unit should survive long enough to move toward the target");
    const referencePosition = lastAlivePosition ?? lastKnownPosition;
    assert(referencePosition, "position should be tracked");
    assert(referencePosition!.x > 0, "unit should advance along the x axis");
    assert(minX < 70, "unit should be pushed out of attack range during knockback");
    assert(referencePosition!.x > minX, "unit should return toward the target after knockback");
    assert.strictEqual(referencePosition!.y, 0);
    const remainingHp = lastAliveHp;
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
