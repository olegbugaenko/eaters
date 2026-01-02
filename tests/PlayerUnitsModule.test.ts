import assert from "assert";
import { describe, test } from "./testRunner";
import { SceneObjectManager } from "../src/logic/services/SceneObjectManager";
import { BricksModule } from "../src/logic/modules/active-map/bricks/bricks.module";
import type { BrickData } from "../src/logic/modules/active-map/bricks/bricks.module";
import { DataBridge } from "../src/logic/core/DataBridge";
import {
  PlayerUnitsModule,
  PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY,
} from "../src/logic/modules/active-map/player-units/player-units.module";
import { MovementService } from "../src/logic/services/MovementService";
import { ExplosionModule } from "../src/logic/modules/scene/explosion/explosion.module";
import type { EffectsModule } from "../src/logic/modules/scene/effects/effects.module";
import { BonusesModule } from "../src/logic/modules/shared/bonuses/bonuses.module";
import { PlayerUnitEmitterConfig, getPlayerUnitConfig } from "../src/db/player-units-db";
import { MapRunState } from "../src/logic/modules/active-map/map/MapRunState";

const createResourceControllerStub = () => ({
  startRun: () => {},
  cancelRun: () => {},
  finishRun: () => {},
  isRunSummaryAvailable: () => false,
  getRunDurationMs: () => 0,
  grantResources: () => {},
  notifyBrickDestroyed: () => {},
});

const createBricksModule = (
  scene: SceneObjectManager,
  bridge: DataBridge,
  bonuses: BonusesModule,
  explosions: ExplosionModule,
  runState: MapRunState
) => {
  const resources = createResourceControllerStub();
  return new BricksModule({ scene, bridge, explosions, resources, bonuses, runState });
};

const tickSeconds = (module: PlayerUnitsModule, seconds: number) => {
  module.tick(seconds * 1000);
};

describe("PlayerUnitsModule", () => {
  test("unit destroys weak brick when in range", () => {
    const scene = new SceneObjectManager();
    scene.setMapSize({ width: 1000, height: 1000 });
    const bridge = new DataBridge();
    const movement = new MovementService();
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const explosions = new ExplosionModule({ scene });
    const runState = new MapRunState();
    runState.start();
    const bricks = createBricksModule(scene, bridge, bonuses, explosions, runState);
    const units = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
      runState,
      getModuleLevel: () => 0,
      hasSkill: () => false,
      getDesignTargetingMode: () => "nearest",
    });
    units.prepareForMap();

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

    for (let i = 0; i < 32 && bricks.getBrickStates().length > 0; i += 1) {
      tickSeconds(units, 0.5);
    }

    assert.strictEqual(bricks.getBrickStates().length, 0, "brick should be destroyed");
    const totalHp = bridge.getValue<number>(PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY) ?? 0;
    assert(totalHp >= 0);
  });

  test("unit moves towards brick and gets knocked back on counter damage", () => {
    const scene = new SceneObjectManager();
    scene.setMapSize({ width: 1000, height: 1000 });
    const bridge = new DataBridge();
    const movement = new MovementService();
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const explosions = new ExplosionModule({ scene });
    const runState = new MapRunState();
    runState.start();
    const bricks = createBricksModule(scene, bridge, bonuses, explosions, runState);
    const units = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
      runState,
      getModuleLevel: () => 0,
      hasSkill: () => false,
      getDesignTargetingMode: () => "nearest",
    });
    units.prepareForMap();

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

  test("clearing units removes lingering status effects", () => {
    const scene = new SceneObjectManager();
    scene.setMapSize({ width: 1000, height: 1000 });
    const bridge = new DataBridge();
    const movement = new MovementService();
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const explosions = new ExplosionModule({ scene });
    const runState = new MapRunState();
    runState.start();
    const bricks = createBricksModule(scene, bridge, bonuses, explosions, runState);
    let clearCalls = 0;
    const effectsStub = {
      applyEffect: () => {
        // no-op for tests
      },
      removeEffect: () => {
        // no-op for tests
      },
      hasEffect: () => false,
      clearAllEffects: () => {
        clearCalls += 1;
      },
    } as unknown as EffectsModule;

    const units = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
      runState,
      effects: effectsStub,
      getModuleLevel: () => 0,
      hasSkill: () => false,
      getDesignTargetingMode: () => "nearest",
    });

    units.setUnits([
      {
        type: "bluePentagon",
        position: { x: 0, y: 0 },
      },
    ]);

    const baselineCalls = clearCalls;

    units.setUnits([]);

    assert.strictEqual(
      clearCalls,
      baselineCalls + 1,
      "effects should be cleared when units are removed"
    );
  });

  test("tail needles fire sideways volleys instead of homing to nearby bricks", () => {
    const scene = new SceneObjectManager();
    scene.setMapSize({ width: 2000, height: 2000 });
    const bridge = new DataBridge();
    const movement = new MovementService();
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const explosions = new ExplosionModule({ scene });
    const runState = new MapRunState();
    runState.start();
    const bricks = createBricksModule(scene, bridge, bonuses, explosions, runState);

    bricks.setBricks([
      {
        position: { x: 20, y: 0 },
        rotation: 0,
        level: 0,
        type: "smallSquareGray",
      },
      {
        position: { x: 0, y: 80 },
        rotation: 0,
        level: 0,
        type: "smallSquareGray",
      },
      {
        position: { x: 800, y: 0 },
        rotation: 0,
        level: 0,
        type: "smallSquareGray",
      },
    ]);

    const bricksBefore = bricks.getBrickStates();
    const forwardId = bricksBefore[0]?.id;
    const sideTargetId = bricksBefore[1]?.id;
    const distantId = bricksBefore[2]?.id;
    assert(forwardId && sideTargetId && distantId, "expected all bricks to be created");

    const units = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
      runState,
      getModuleLevel: (id) => (id === "tailNeedles" ? 1 : 0),
      hasSkill: () => false,
      getDesignTargetingMode: () => "nearest",
    });
    units.prepareForMap();

    units.setUnits([
      {
        type: "bluePentagon",
        position: { x: 0, y: 0 },
        equippedModules: ["tailNeedles"],
      },
    ]);

    const distantBefore = bricks.getBrickState(distantId);
    assert(distantBefore, "distant brick should exist before attacks");

    for (let i = 0; i < 30; i += 1) {
      tickSeconds(units, 0.2);
      if (!bricks.getBrickState(forwardId)) {
        break;
      }
    }

    assert(!bricks.getBrickState(forwardId), "front brick should be destroyed by the attack");

    const sideState = bricks.getBrickState(sideTargetId);
    const distantState = bricks.getBrickState(distantId);

    assert(sideState === null || sideState.hp < (bricksBefore[1]?.hp ?? Infinity));
    assert(distantState, "distant brick should remain after sideways volley");
    assert.strictEqual(
      distantState!.hp,
      distantBefore.hp,
      "sideways projectiles should not home to far bricks",
    );
    assert.strictEqual(distantState!.maxHp, distantBefore.maxHp);
  });
});
