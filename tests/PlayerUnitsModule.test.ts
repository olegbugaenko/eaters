import assert from "assert";
import { describe, test } from "./testRunner";
import { SceneObjectManager } from "../src/logic/services/SceneObjectManager";
import { BricksModule } from "../src/logic/modules/active-map/BricksModule";
import type { BrickData } from "../src/logic/modules/active-map/BricksModule";
import { DataBridge } from "../src/logic/core/DataBridge";
import {
  PlayerUnitsModule,
  PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY,
} from "../src/logic/modules/active-map/PlayerUnitsModule";
import { MovementService } from "../src/logic/services/MovementService";
import { ExplosionModule } from "../src/logic/modules/scene/ExplosionModule";
import { BonusesModule } from "../src/logic/modules/shared/BonusesModule";
import { PlayerUnitEmitterConfig, getPlayerUnitConfig } from "../src/db/player-units-db";

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
      getModuleLevel: () => 0,
      hasSkill: () => false,
      getDesignTargetingMode: () => "nearest",
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
    const unitConfig = getPlayerUnitConfig("bluePentagon");
    assert(unitConfig.emitter, "expected emitter configuration for bluePentagon");
    const expectedEmitter = unitConfig.emitter!;
    assert.strictEqual(emitter.particlesPerSecond, expectedEmitter.particlesPerSecond);
    assert.strictEqual(emitter.particleLifetimeMs, expectedEmitter.particleLifetimeMs);
    assert.strictEqual(emitter.fadeStartMs, expectedEmitter.fadeStartMs);
    assert.strictEqual(emitter.baseSpeed, expectedEmitter.baseSpeed);
    assert.strictEqual(emitter.speedVariation, expectedEmitter.speedVariation);
    assert.deepStrictEqual(emitter.sizeRange, expectedEmitter.sizeRange);
    assert.strictEqual(emitter.spread, expectedEmitter.spread);
    assert.deepStrictEqual(emitter.offset, expectedEmitter.offset);
    assert.deepStrictEqual(emitter.color, expectedEmitter.color);
    assert.strictEqual(emitter.shape, expectedEmitter.shape);
    assert.strictEqual(emitter.maxParticles, expectedEmitter.maxParticles);
    const fill = emitter.fill;
    const expectedFill = expectedEmitter.fill;
    if (fill && expectedFill && "stops" in fill && "stops" in expectedFill) {
      assert.strictEqual(fill.fillType, expectedFill.fillType);
      assert.strictEqual(fill.stops.length, expectedFill.stops.length);
      fill.stops.forEach((stop: typeof expectedFill.stops[number], index: number) => {
        const expectedStop = expectedFill.stops[index];
        assert(expectedStop, "expected emitter gradient stop");
        assert.strictEqual(stop.offset, expectedStop.offset);
        assert.deepStrictEqual(stop.color, expectedStop.color);
      });
    } else {
      assert.deepStrictEqual(fill, expectedFill);
    }
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
      getModuleLevel: () => 0,
      hasSkill: () => false,
      getDesignTargetingMode: () => "nearest",
    });

    bricks.setBricks([
      {
        position: { x: 100, y: 0 },
        rotation: 0,
        level: 0,
        type: "blueRadial",
      } as unknown as BrickData,
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
    let maxX = -Infinity;
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
        maxX = Math.max(maxX, x);
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
    assert(maxX > 0, "unit should advance along the x axis");
    assert(minX < maxX, "unit should be pushed out of attack range during knockback");
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
    assert(
      Math.abs(brick.hp - brick.maxHp) < 0.5,
      "brick should retain near-full health after countering"
    );
  });
});
