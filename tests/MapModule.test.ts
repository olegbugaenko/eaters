import assert from "assert";
import { describe, test } from "./testRunner";
import { SceneObjectManager } from "../src/logic/services/SceneObjectManager";
import { DataBridge } from "../src/logic/core/DataBridge";
import { BricksModule } from "../src/logic/modules/BricksModule";
import { PlayerUnitsModule } from "../src/logic/modules/PlayerUnitsModule";
import { MovementService } from "../src/logic/services/MovementService";
import {
  MapModule,
  PLAYER_UNIT_SPAWN_SAFE_RADIUS,
  MAP_LIST_BRIDGE_KEY,
  DEFAULT_MAP_AUTO_RESTART_STATE,
  MAP_AUTO_RESTART_BRIDGE_KEY,
} from "../src/logic/modules/MapModule";
import type {
  MapListEntry,
  MapStats,
  MapAutoRestartState,
} from "../src/logic/modules/MapModule";
import { ExplosionModule } from "../src/logic/modules/ExplosionModule";
import { NecromancerModule } from "../src/logic/modules/NecromancerModule";
import { BonusesModule } from "../src/logic/modules/BonusesModule";
import { UnlockService } from "../src/logic/services/UnlockService";

const distanceSq = (a: { x: number; y: number }, b: { x: number; y: number }): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

describe("MapModule", () => {
  test("bricks spawn outside of the player unit safe radius", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const explosions = new ExplosionModule({ scene });
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const resources = {
      startRun: () => {
        // no-op for tests
      },
      grantResources: () => {
        // no-op for tests
      },
      notifyBrickDestroyed: () => {
        // no-op for tests
      },
    };
    const bricks = new BricksModule({ scene, bridge, explosions, resources, bonuses });
    const movement = new MovementService();
    const playerUnits = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
    });
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
    });
    let mapModuleRef: MapModule | null = null;
    const unlocks = new UnlockService({
      getMapStats: () => mapModuleRef?.getMapStats() ?? {},
      getSkillLevel: () => 0,
    });

    const maps = new MapModule({
      scene,
      bridge,
      bricks,
      playerUnits,
      necromancer,
      resources,
      unlocks,
      getSkillLevel: () => 0,
    });
    mapModuleRef = maps;

    necromancer.initialize();
    maps.initialize();
    maps.recordRunResult({ mapId: "foundations", success: true });
    maps.selectMap("initial");

    const unitsSave = playerUnits.save() as { units?: { position?: { x: number; y: number } }[] };
    assert(unitsSave.units && unitsSave.units[0]?.position, "unit should be spawned");
    const unitPosition = unitsSave.units[0]!.position!;

    const safetyRadiusSq = PLAYER_UNIT_SPAWN_SAFE_RADIUS * PLAYER_UNIT_SPAWN_SAFE_RADIUS;
    bricks.getBrickStates().forEach((brick) => {
      assert(
        distanceSq(brick.position, unitPosition) >= safetyRadiusSq,
        "brick should be spawned outside of the safety radius"
      );
    });
  });
});

describe("Map unlocking", () => {
  test("initial map unlocks after completing foundations", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const explosions = new ExplosionModule({ scene });
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const resources = {
      startRun: () => {},
      grantResources: () => {},
      notifyBrickDestroyed: () => {},
    };
    const bricks = new BricksModule({ scene, bridge, explosions, resources, bonuses });
    const movement = new MovementService();
    const playerUnits = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
    });
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
    });

    let mapModuleRef: MapModule | null = null;
    const unlocks = new UnlockService({
      getMapStats: () => mapModuleRef?.getMapStats() ?? {},
      getSkillLevel: () => 0,
    });

    const maps = new MapModule({
      scene,
      bridge,
      bricks,
      playerUnits,
      necromancer,
      resources,
      unlocks,
      getSkillLevel: () => 0,
    });
    mapModuleRef = maps;

    necromancer.initialize();
    maps.initialize();

    const initialList = bridge.getValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY) ?? [];
    assert.strictEqual(initialList.length, 1);
    assert.strictEqual(initialList[0]!.id, "foundations");
    assert.strictEqual(initialList[0]!.currentLevel, 0);
    assert.strictEqual(initialList[0]!.attempts, 0);

    maps.recordRunResult({ mapId: "foundations", success: true });

    const updatedList = bridge.getValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY) ?? [];
    const mapIds = updatedList.map((entry) => entry.id);
    assert(mapIds.includes("foundations"));
    assert(mapIds.includes("initial"));

    const foundationsEntry = updatedList.find((entry) => entry.id === "foundations");
    assert.strictEqual(foundationsEntry?.currentLevel, 1);
    assert.strictEqual(foundationsEntry?.attempts, 1);

    const initialEntry = updatedList.find((entry) => entry.id === "initial");
    assert.strictEqual(initialEntry?.currentLevel, 0);
    assert.strictEqual(initialEntry?.attempts, 0);
  });

  test("run results are stored in map stats", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const explosions = new ExplosionModule({ scene });
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const resources = {
      startRun: () => {},
      grantResources: () => {},
      notifyBrickDestroyed: () => {},
    };
    const bricks = new BricksModule({ scene, bridge, explosions, resources, bonuses });
    const movement = new MovementService();
    const playerUnits = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
    });
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
    });

    let mapModuleRef: MapModule | null = null;
    const unlocks = new UnlockService({
      getMapStats: () => mapModuleRef?.getMapStats() ?? {},
      getSkillLevel: () => 0,
    });

    const maps = new MapModule({
      scene,
      bridge,
      bricks,
      playerUnits,
      necromancer,
      resources,
      unlocks,
      getSkillLevel: () => 0,
    });
    mapModuleRef = maps;

    maps.recordRunResult({ mapId: "foundations", level: 0, success: true });
    maps.recordRunResult({ mapId: "foundations", level: 0, success: false });

    const stats = maps.getMapStats();
    assert.strictEqual(stats.foundations?.[0]?.success, 1);
    assert.strictEqual(stats.foundations?.[0]?.failure, 1);

    const saved = maps.save() as { stats?: MapStats };
    assert(saved.stats);
    assert.strictEqual(saved.stats?.foundations?.[0]?.success, 1);
    assert.strictEqual(saved.stats?.foundations?.[0]?.failure, 1);
  });
});

describe("Map auto restart", () => {
  test("auto restart unlocks with the corresponding skill and persists", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const explosions = new ExplosionModule({ scene });
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const resources = {
      startRun: () => {},
      grantResources: () => {},
      notifyBrickDestroyed: () => {},
    };
    const bricks = new BricksModule({ scene, bridge, explosions, resources, bonuses });
    const movement = new MovementService();
    const playerUnits = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
    });
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
    });

    let mapModuleRef: MapModule | null = null;
    let skillLevel = 0;
    const unlocks = new UnlockService({
      getMapStats: () => mapModuleRef?.getMapStats() ?? {},
      getSkillLevel: () => 0,
    });

    const maps = new MapModule({
      scene,
      bridge,
      bricks,
      playerUnits,
      necromancer,
      resources,
      unlocks,
      getSkillLevel: () => skillLevel,
    });
    mapModuleRef = maps;

    necromancer.initialize();
    maps.initialize();

    let state =
      bridge.getValue<MapAutoRestartState>(MAP_AUTO_RESTART_BRIDGE_KEY) ??
      DEFAULT_MAP_AUTO_RESTART_STATE;
    assert.strictEqual(state.unlocked, false);
    assert.strictEqual(state.enabled, false);

    maps.setAutoRestartEnabled(true);
    state =
      bridge.getValue<MapAutoRestartState>(MAP_AUTO_RESTART_BRIDGE_KEY) ??
      DEFAULT_MAP_AUTO_RESTART_STATE;
    assert.strictEqual(state.unlocked, false);
    assert.strictEqual(state.enabled, false);

    skillLevel = 1;
    maps.tick(0);
    state =
      bridge.getValue<MapAutoRestartState>(MAP_AUTO_RESTART_BRIDGE_KEY) ??
      DEFAULT_MAP_AUTO_RESTART_STATE;
    assert.strictEqual(state.unlocked, true);
    assert.strictEqual(state.enabled, false);

    maps.setAutoRestartEnabled(true);
    state =
      bridge.getValue<MapAutoRestartState>(MAP_AUTO_RESTART_BRIDGE_KEY) ??
      DEFAULT_MAP_AUTO_RESTART_STATE;
    assert.strictEqual(state.unlocked, true);
    assert.strictEqual(state.enabled, true);

    const saved = maps.save() as { autoRestartEnabled?: boolean };
    assert.strictEqual(saved.autoRestartEnabled, true);

    skillLevel = 0;
    maps.tick(0);
    state =
      bridge.getValue<MapAutoRestartState>(MAP_AUTO_RESTART_BRIDGE_KEY) ??
      DEFAULT_MAP_AUTO_RESTART_STATE;
    assert.strictEqual(state.unlocked, false);
    assert.strictEqual(state.enabled, false);
  });
});
