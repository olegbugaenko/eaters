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
import type { UnitDesignModule } from "../src/logic/modules/UnitDesignModule";

const createUnitDesignerStub = (): UnitDesignModule => {
  const stub = {
    subscribe: (listener: (designs: never[]) => void) => {
      listener([]);
      return () => {};
    },
    getDefaultDesignForType: () => null,
    getDesign: () => null,
    getAllDesigns: () => [],
  };
  return stub as unknown as UnitDesignModule;
};

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
      cancelRun: () => {
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
    const unitDesigns = createUnitDesignerStub();
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
      unitDesigns,
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
    maps.restartSelectedMap();

    const unitObject = scene
      .getObjects()
      .find((object) => object.type === "playerUnit");
    assert(unitObject, "unit scene object should be spawned");
    const unitPosition = unitObject!.data.position;

    const safetyRadiusSq = PLAYER_UNIT_SPAWN_SAFE_RADIUS * PLAYER_UNIT_SPAWN_SAFE_RADIUS;
    bricks.getBrickStates().forEach((brick) => {
      assert(
        distanceSq(brick.position, unitPosition) >= safetyRadiusSq,
        "brick should be spawned outside of the safety radius"
      );
    });
  });
});

describe("Map run control", () => {
  test("selecting map does not start run until restart", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    let setBricksCalls = 0;
    const bricks = {
      setBricks: () => {
        setBricksCalls += 1;
      },
    } as unknown as BricksModule;
    let prepareForMapCalls = 0;
    let setUnitsCalls = 0;
    const playerUnits = {
      prepareForMap: () => {
        prepareForMapCalls += 1;
      },
      setUnits: () => {
        setUnitsCalls += 1;
      },
    } as unknown as PlayerUnitsModule;
    let configureForMapCalls = 0;
    const necromancer = {
      configureForMap: () => {
        configureForMapCalls += 1;
      },
      endCurrentMap: () => {
        // no-op for tests
      },
    } as unknown as NecromancerModule;

    let startRunCalls = 0;
    const resources = {
      startRun: () => {
        startRunCalls += 1;
      },
      cancelRun: () => {
        // no-op for tests
      },
    };

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

    maps.initialize();
    assert.strictEqual(startRunCalls, 0, "run should not start on initialize");
    assert.strictEqual(setBricksCalls, 0, "bricks should not spawn on initialize");
    assert.strictEqual(prepareForMapCalls, 0, "units should not prepare on initialize");
    assert.strictEqual(setUnitsCalls, 0, "units should not spawn on initialize");
    assert.strictEqual(
      configureForMapCalls,
      0,
      "necromancer should not configure a map on initialize"
    );

    maps.selectMap("foundations");
    assert.strictEqual(startRunCalls, 0, "run should not start when selecting a map");
    assert.strictEqual(setBricksCalls, 0, "bricks should not spawn when selecting a map");
    assert.strictEqual(
      prepareForMapCalls,
      0,
      "units should not prepare when selecting a map"
    );
    assert.strictEqual(setUnitsCalls, 0, "units should not spawn when selecting a map");
    assert.strictEqual(
      configureForMapCalls,
      0,
      "necromancer should not configure when selecting a map"
    );

    maps.selectMapLevel("foundations", 0);
    assert.strictEqual(startRunCalls, 0, "run should not start when changing map level");
    assert.strictEqual(setBricksCalls, 0, "bricks should not spawn when changing level");
    assert.strictEqual(
      prepareForMapCalls,
      0,
      "units should not prepare when changing level"
    );
    assert.strictEqual(setUnitsCalls, 0, "units should not spawn when changing level");
    assert.strictEqual(
      configureForMapCalls,
      0,
      "necromancer should not configure when changing level"
    );

    maps.restartSelectedMap();
    assert.strictEqual(startRunCalls, 1, "run should start when restarting the selected map");
    assert.strictEqual(setBricksCalls, 1, "bricks should spawn when restarting the map");
    assert.strictEqual(
      prepareForMapCalls,
      1,
      "units should prepare when restarting the map"
    );
    assert.strictEqual(setUnitsCalls, 1, "units should spawn when restarting the map");
    assert.strictEqual(
      configureForMapCalls,
      1,
      "necromancer should configure when restarting the map"
    );
  });

  test("leaving a map clears active run state", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    let lastBricks: unknown = null;
    const bricks = {
      setBricks: (input: unknown) => {
        lastBricks = input;
      },
    } as unknown as BricksModule;
    let lastUnits: unknown = null;
    const playerUnits = {
      prepareForMap: () => {
        // no-op for tests
      },
      setUnits: (units: unknown) => {
        lastUnits = units;
      },
    } as unknown as PlayerUnitsModule;
    let configureForMapCalls = 0;
    let endCurrentMapCalls = 0;
    const necromancer = {
      configureForMap: () => {
        configureForMapCalls += 1;
      },
      endCurrentMap: () => {
        endCurrentMapCalls += 1;
      },
    } as unknown as NecromancerModule;
    let startRunCalls = 0;
    let cancelRunCalls = 0;
    const resources = {
      startRun: () => {
        startRunCalls += 1;
      },
      cancelRun: () => {
        cancelRunCalls += 1;
      },
    };

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

    maps.initialize();
    maps.selectMap("foundations");
    maps.restartSelectedMap();

    assert.strictEqual(startRunCalls, 1, "run should start when restarting the map");
    assert.strictEqual(configureForMapCalls, 1, "necromancer should configure for the map");
    assert(Array.isArray(lastBricks), "bricks should be generated when run starts");
    assert(Array.isArray(lastUnits), "units should be spawned when run starts");

    maps.leaveCurrentMap();

    assert.strictEqual(cancelRunCalls, 1, "leaving should cancel the active run");
    assert(Array.isArray(lastBricks) && (lastBricks as unknown[]).length === 0);
    assert(Array.isArray(lastUnits) && (lastUnits as unknown[]).length === 0);
    assert.strictEqual(endCurrentMapCalls, 1, "necromancer should be notified when leaving");
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
      cancelRun: () => {},
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
    const unitDesigns = createUnitDesignerStub();
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
      unitDesigns,
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
    assert.strictEqual(initialList[0]!.bestTimeMs, null);

    maps.recordRunResult({ mapId: "foundations", success: true });

    const updatedList = bridge.getValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY) ?? [];
    const mapIds = updatedList.map((entry) => entry.id);
    assert(mapIds.includes("foundations"));
    assert(mapIds.includes("initial"));

    const foundationsEntry = updatedList.find((entry) => entry.id === "foundations");
    assert.strictEqual(foundationsEntry?.currentLevel, 1);
    assert.strictEqual(foundationsEntry?.attempts, 1);
    assert.strictEqual(foundationsEntry?.bestTimeMs, null);

    const initialEntry = updatedList.find((entry) => entry.id === "initial");
    assert.strictEqual(initialEntry?.currentLevel, 0);
    assert.strictEqual(initialEntry?.attempts, 0);
    assert.strictEqual(initialEntry?.bestTimeMs, null);
  });

  test("run results are stored in map stats", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const explosions = new ExplosionModule({ scene });
    const bonuses = new BonusesModule();
    bonuses.initialize();
    const resources = {
      startRun: () => {},
      cancelRun: () => {},
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
    const unitDesigns = createUnitDesignerStub();
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
      unitDesigns,
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
    assert.strictEqual(stats.foundations?.[0]?.bestTimeMs, null);

    const saved = maps.save() as { stats?: MapStats };
    assert(saved.stats);
    assert.strictEqual(saved.stats?.foundations?.[0]?.success, 1);
    assert.strictEqual(saved.stats?.foundations?.[0]?.failure, 1);
    assert.strictEqual(saved.stats?.foundations?.[0]?.bestTimeMs, null);
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
      cancelRun: () => {},
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
    const unitDesigns = createUnitDesignerStub();
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
      unitDesigns,
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
