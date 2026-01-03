import assert from "assert";
import { describe, test } from "./testRunner";
import { SceneObjectManager } from "../src/logic/services/scene-object-manager/SceneObjectManager";
import { DataBridge } from "../src/logic/core/DataBridge";
import { BricksModule } from "../src/logic/modules/active-map/bricks/bricks.module";
import { PlayerUnitsModule } from "../src/logic/modules/active-map/player-units/player-units.module";
import { UnitProjectileController } from "../src/logic/modules/active-map/projectiles/ProjectileController";
import { normalizeVector } from "../src/logic/helpers/vector.helper";
import { MovementService } from "../src/logic/services/movement/MovementService";
import { MapModule } from "../src/logic/modules/active-map/map/map.module";
import {
  PLAYER_UNIT_SPAWN_SAFE_RADIUS,
  MAP_LIST_BRIDGE_KEY,
  DEFAULT_MAP_AUTO_RESTART_STATE,
  MAP_AUTO_RESTART_BRIDGE_KEY,
  MAP_LAST_PLAYED_BRIDGE_KEY,
} from "../src/logic/modules/active-map/map/map.const";
import type {
  MapListEntry,
  MapStats,
  MapAutoRestartState,
  ResourceRunController,
} from "../src/logic/modules/active-map/map/map.types";
import type { MapSceneCleanupContract } from "../src/logic/modules/active-map/map/map.scene-cleanup";
import { ExplosionModule } from "../src/logic/modules/scene/explosion/explosion.module";
import type { ArcModule } from "../src/logic/modules/scene/arc/arc.module";
import type { UnitAutomationModule } from "../src/logic/modules/active-map/unit-automation/unit-automation.module";
import { NecromancerModule } from "../src/logic/modules/active-map/necromancer/necromancer.module";
import { BonusesModule } from "../src/logic/modules/shared/bonuses/bonuses.module";
import { UnlockService } from "../src/logic/services/unlock/UnlockService";
import type { UnitDesignModule } from "../src/logic/modules/camp/unit-design/unit-design.module";
import { getMapConfig } from "../src/db/maps-db";
import { MapId } from "../src/db/maps-db";
import { MapRunState } from "../src/logic/modules/active-map/map/MapRunState";

const createProjectilesStub = (scene: SceneObjectManager, bricks: BricksModule): UnitProjectileController => {
  interface ProjectileState {
    id: string;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    damage: number;
    hitRadius: number;
    rewardMultiplier: number;
    armorPenetration: number;
    skipKnockback: boolean;
    elapsedMs: number;
    lifetimeMs: number;
  }

  const projectiles: ProjectileState[] = [];

  return {
    fireProjectile: () => {},
    clear: () => {
      projectiles.length = 0;
    },
    spawn: (projectile: any) => {
      const origin = projectile.origin ?? { x: 0, y: 0 };
      const rawDirection = projectile.direction ?? { x: 1, y: 0 };
      const direction = normalizeVector(rawDirection) || { x: 1, y: 0 };
      const speed = projectile.visual?.speed ?? 300;
      const radius = projectile.visual?.radius ?? 10;
      const hitRadius = projectile.visual?.hitRadius ?? radius;
      const lifetimeMs = projectile.visual?.lifetimeMs ?? 3000;

      const objectId = scene.addObject("unitProjectile", {
        position: { ...origin },
        size: { width: radius * 2, height: radius * 2 },
        fill: projectile.visual?.fill,
        customData: projectile.visual?.rendererCustomData ?? {},
      });

      projectiles.push({
        id: objectId,
        position: { ...origin },
        velocity: { x: direction.x * speed, y: direction.y * speed },
        damage: projectile.damage ?? 0,
        hitRadius,
        rewardMultiplier: projectile.rewardMultiplier ?? 1,
        armorPenetration: projectile.armorPenetration ?? 0,
        skipKnockback: projectile.skipKnockback === true,
        elapsedMs: 0,
        lifetimeMs,
      });

      return objectId;
    },
    tick: (deltaMs: number) => {
      if (deltaMs <= 0 || projectiles.length === 0) {
        return;
      }
      const deltaSeconds = deltaMs / 1000;
      const mapSize = scene.getMapSize();

      let writeIndex = 0;
      for (let i = 0; i < projectiles.length; i++) {
        const p = projectiles[i]!;
        let hit = false;

        // Move projectile
        p.position.x += p.velocity.x * deltaSeconds;
        p.position.y += p.velocity.y * deltaSeconds;

        // Check collision with bricks
        const nearbyBricks = bricks.findBricksNear(p.position, p.hitRadius + 50);
        for (const brick of nearbyBricks) {
          const dx = brick.position.x - p.position.x;
          const dy = brick.position.y - p.position.y;
          const distance = Math.hypot(dx, dy);
          if (distance <= p.hitRadius + (brick.physicalSize ?? 0)) {
            // Hit!
            if (p.damage > 0) {
              const dir = { x: p.velocity.x, y: p.velocity.y };
              const len = Math.hypot(dir.x, dir.y);
              if (len > 0) {
                dir.x /= len;
                dir.y /= len;
              }
              bricks.applyDamage(brick.id, p.damage, dir, {
                rewardMultiplier: p.rewardMultiplier,
                armorPenetration: p.armorPenetration,
                skipKnockback: p.skipKnockback,
              });
            }
            scene.removeObject(p.id);
            hit = true;
            break;
          }
        }

        if (hit) {
          continue;
        }

        // Check lifetime
        p.elapsedMs += deltaMs;
        if (p.elapsedMs >= p.lifetimeMs) {
          scene.removeObject(p.id);
          continue;
        }

        // Check bounds
        if (p.position.x < -100 || p.position.x > mapSize.width + 100 ||
            p.position.y < -100 || p.position.y > mapSize.height + 100) {
          scene.removeObject(p.id);
          continue;
        }

        // Update scene object position
        scene.updateObject(p.id, { position: { ...p.position } });

        projectiles[writeIndex++] = p;
      }
      projectiles.length = writeIndex;
    },
  } as unknown as UnitProjectileController;
};

const createUnitDesignerStub = (): UnitDesignModule => {
  const stub = {
    subscribe: (listener: (designs: never[]) => void) => {
      listener([]);
      return () => {};
    },
    getDefaultDesignForType: () => null,
    getDesign: () => null,
    getAllDesigns: () => [],
    getActiveRosterDesigns: () => [],
  };
  return stub as unknown as UnitDesignModule;
};

const distanceSq = (a: { x: number; y: number }, b: { x: number; y: number }): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

const createArcModuleStub = (): ArcModule => ({
  clearArcs: () => {
    // no-op for tests
  },
} as unknown as ArcModule);

const createUnitAutomationStub = (): UnitAutomationModule => ({
  onMapStart: () => {
    // no-op for tests
  },
  onMapEnd: () => {
    // no-op for tests
  },
} as unknown as UnitAutomationModule);

const createBonuses = (): BonusesModule => {
  const bonuses = new BonusesModule();
  bonuses.initialize();
  return bonuses;
};

const createResourceControllerStub = (): ResourceRunController & {
  grantResources: () => void;
  notifyBrickDestroyed: () => void;
} => ({
  startRun: () => {},
  cancelRun: () => {},
  finishRun: () => {},
  isRunSummaryAvailable: () => false,
  getRunDurationMs: () => 0,
  grantResources: () => {},
  notifyBrickDestroyed: () => {},
});

const createSceneCleanupStub = (): MapSceneCleanupContract => ({
  resetAfterRun: () => {},
});

describe("MapModule", () => {
  test("bricks spawn outside of the player unit safe radius", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const runState = new MapRunState();
    const explosions = new ExplosionModule({ scene });
    const bonuses = createBonuses();
    const resources = createResourceControllerStub();
    const bricks = new BricksModule({ scene, bridge, explosions, resources, bonuses, runState });
    const movement = new MovementService();
    const playerUnits = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
      runState,
      projectiles: createProjectilesStub(scene, bricks),
      getModuleLevel: () => 0,
      hasSkill: () => false,
      getDesignTargetingMode: () => "nearest",
    });
    const unitDesigns = createUnitDesignerStub();
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
      unitDesigns,
      runState,
    });
    let mapModuleRef: MapModule | null = null;
    const unlocks = new UnlockService({
      getMapStats: () => mapModuleRef?.getMapStats() ?? {},
      getSkillLevel: () => 0,
    });

    const maps = new MapModule({
      scene,
      bridge,
      runState,
      bonuses,
      bricks,
      playerUnits,
      necromancer,
      resources,
      unlocks,
      unitsAutomation: createUnitAutomationStub(),
      arcs: createArcModuleStub(),
      sceneCleanup: createSceneCleanupStub(),
      getSkillLevel: () => 0,
    });
    mapModuleRef = maps;

    necromancer.initialize();
    maps.initialize();
    maps.recordRunResult({ mapId: "foundations", success: true });
    maps.recordRunResult({ mapId: "foundations", level: 1, success: true });
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
    const runState = new MapRunState();
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
    pauseMap: () => {
      // no-op for tests
    },
    resumeMap: () => {
      // no-op for tests
    },
  } as unknown as NecromancerModule;

    let startRunCalls = 0;
    const resources = {
      ...createResourceControllerStub(),
      startRun: () => {
        startRunCalls += 1;
      },
    };

    let mapModuleRef: MapModule | null = null;
    const unlocks = new UnlockService({
      getMapStats: () => mapModuleRef?.getMapStats() ?? {},
      getSkillLevel: () => 0,
    });
    const bonuses = createBonuses();

    const maps = new MapModule({
      scene,
      bridge,
      runState,
      bonuses,
      bricks,
      playerUnits,
      necromancer,
      resources,
      unlocks,
      unitsAutomation: createUnitAutomationStub(),
      arcs: createArcModuleStub(),
      sceneCleanup: createSceneCleanupStub(),
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
    const runState = new MapRunState();
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
      pauseMap: () => {
        // no-op for tests
      },
      resumeMap: () => {
        // no-op for tests
      },
    } as unknown as NecromancerModule;
    let startRunCalls = 0;
    let cancelRunCalls = 0;
    const resources = {
      ...createResourceControllerStub(),
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
    const bonuses = createBonuses();

    const maps = new MapModule({
      scene,
      bridge,
      runState,
      bonuses,
      bricks,
      playerUnits,
      necromancer,
      resources,
      unlocks,
      unitsAutomation: createUnitAutomationStub(),
      arcs: createArcModuleStub(),
      sceneCleanup: createSceneCleanupStub(),
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

  test("centers camera on the primary portal when starting a map", () => {
    const scene = new SceneObjectManager();
    scene.setViewportScreenSize(800, 600);
    const bridge = new DataBridge();
    const runState = new MapRunState();
    const explosions = new ExplosionModule({ scene });
    const bonuses = createBonuses();
    const resources = createResourceControllerStub();
    const bricks = new BricksModule({ scene, bridge, explosions, resources, bonuses, runState });
    const movement = new MovementService();
    const playerUnits = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
      runState,
      projectiles: createProjectilesStub(scene, bricks),
      getModuleLevel: () => 0,
      hasSkill: () => false,
      getDesignTargetingMode: () => "nearest",
    });
    const unitDesigns = createUnitDesignerStub();
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
      unitDesigns,
      runState,
    });
    let mapModuleRef: MapModule | null = null;
    const unlocks = new UnlockService({
      getMapStats: () => mapModuleRef?.getMapStats() ?? {},
      getSkillLevel: () => 0,
    });

    const maps = new MapModule({
      scene,
      bridge,
      runState,
      bonuses,
      bricks,
      playerUnits,
      necromancer,
      resources,
      unlocks,
      unitsAutomation: createUnitAutomationStub(),
      arcs: createArcModuleStub(),
      sceneCleanup: createSceneCleanupStub(),
      getSkillLevel: () => 0,
    });
    mapModuleRef = maps;

    necromancer.initialize();
    maps.initialize();

    maps.selectMap("trainingGrounds");
    maps.restartSelectedMap();

    const config = getMapConfig("trainingGrounds");
    const spawnPoint =
      (config.spawnPoints && config.spawnPoints.length > 0
        ? config.spawnPoints[0]
        : config.playerUnits?.[0]?.position) ?? { x: 0, y: 0 };

    const camera = scene.getCamera();
    const cameraCenterX = camera.position.x + camera.viewportSize.width / 2;
    const cameraCenterY = camera.position.y + camera.viewportSize.height / 2;

    assert.strictEqual(cameraCenterX, spawnPoint.x);
    assert.strictEqual(cameraCenterY, spawnPoint.y);
  });

  test("re-applies camera focus after viewport resizes during map start", () => {
    const scene = new SceneObjectManager();
    scene.setViewportScreenSize(600, 400);
    const bridge = new DataBridge();
    const runState = new MapRunState();
    const explosions = new ExplosionModule({ scene });
    const bonuses = createBonuses();
    const resources = createResourceControllerStub();
    const bricks = new BricksModule({ scene, bridge, explosions, resources, bonuses, runState });
    const movement = new MovementService();
    const playerUnits = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
      runState,
      projectiles: createProjectilesStub(scene, bricks),
      getModuleLevel: () => 0,
      hasSkill: () => false,
      getDesignTargetingMode: () => "nearest",
    });
    const unitDesigns = createUnitDesignerStub();
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
      unitDesigns,
      runState,
    });
    let mapModuleRef: MapModule | null = null;
    const unlocks = new UnlockService({
      getMapStats: () => mapModuleRef?.getMapStats() ?? {},
      getSkillLevel: () => 0,
    });

    const maps = new MapModule({
      scene,
      bridge,
      runState,
      bonuses,
      bricks,
      playerUnits,
      necromancer,
      resources,
      unlocks,
      unitsAutomation: createUnitAutomationStub(),
      arcs: createArcModuleStub(),
      sceneCleanup: createSceneCleanupStub(),
      getSkillLevel: () => 0,
    });
    mapModuleRef = maps;

    necromancer.initialize();
    maps.initialize();

    maps.selectMap("trainingGrounds");
    maps.restartSelectedMap();

    const config = getMapConfig("trainingGrounds");
    const spawnPoint =
      (config.spawnPoints && config.spawnPoints.length > 0
        ? config.spawnPoints[0]
        : config.playerUnits?.[0]?.position) ?? { x: 0, y: 0 };

    scene.setViewportScreenSize(900, 700);

    for (let i = 0; i < 10; i += 1) {
      maps.tick(16);
    }

    const camera = scene.getCamera();
    const cameraCenterX = camera.position.x + camera.viewportSize.width / 2;
    const cameraCenterY = camera.position.y + camera.viewportSize.height / 2;

    assert.strictEqual(cameraCenterX, spawnPoint.x);
    assert.strictEqual(cameraCenterY, spawnPoint.y);
  });
});

describe("Map unlocking", () => {
  test("initial map unlocks after completing foundations", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const runState = new MapRunState();
    const explosions = new ExplosionModule({ scene });
    const bonuses = createBonuses();
    const resources = createResourceControllerStub();
    const bricks = new BricksModule({ scene, bridge, explosions, resources, bonuses, runState });
    const movement = new MovementService();
    const playerUnits = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
      runState,
      projectiles: createProjectilesStub(scene, bricks),
      getModuleLevel: () => 0,
      hasSkill: () => false,
      getDesignTargetingMode: () => "nearest",
    });
    const unitDesigns = createUnitDesignerStub();
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
      unitDesigns,
      runState,
    });

    let mapModuleRef: MapModule | null = null;
    const unlocks = new UnlockService({
      getMapStats: () => mapModuleRef?.getMapStats() ?? {},
      getSkillLevel: () => 0,
    });

    const maps = new MapModule({
      scene,
      bridge,
      runState,
      bonuses,
      bricks,
      playerUnits,
      necromancer,
      resources,
      unlocks,
      unitsAutomation: createUnitAutomationStub(),
      arcs: createArcModuleStub(),
      sceneCleanup: createSceneCleanupStub(),
      getSkillLevel: () => 0,
    });
    mapModuleRef = maps;

    necromancer.initialize();
    maps.initialize();

    const initialList = bridge.getValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY) ?? [];
    const trainingEntry = initialList.find((entry) => entry.id === "trainingGrounds");
    const foundationEntry = initialList.find((entry) => entry.id === "foundations");
    assert(trainingEntry, "trainingGrounds should always be visible");
    assert(foundationEntry, "foundations should be visible as a locked prerequisite");
    assert.strictEqual(trainingEntry?.currentLevel, 1);
    assert.strictEqual(trainingEntry?.attempts, 0);
    assert.strictEqual(trainingEntry?.bestTimeMs, null);
    assert.strictEqual(trainingEntry?.selectable, true);
    assert.strictEqual(foundationEntry?.selectable, false);
    assert.strictEqual(foundationEntry?.currentLevel, 0);
    assert.strictEqual(foundationEntry?.selectedLevel, 0);

    maps.recordRunResult({ mapId: "trainingGrounds", success: true });

    const afterTraining = bridge.getValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY) ?? [];
    const afterTrainingIds = afterTraining.map((entry) => entry.id);
    assert(afterTrainingIds.includes("trainingGrounds"));
    assert(afterTrainingIds.includes("foundations"));

    const foundationsEntry = afterTraining.find((entry) => entry.id === "foundations");
    assert.strictEqual(foundationsEntry?.currentLevel, 1);
    assert.strictEqual(foundationsEntry?.attempts, 0);
    assert.strictEqual(foundationsEntry?.bestTimeMs, null);

    maps.recordRunResult({ mapId: "foundations", success: true });

    const updatedList = bridge.getValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY) ?? [];
    const mapIds = updatedList.map((entry) => entry.id);
    assert(mapIds.includes("foundations"));
    assert(mapIds.includes("initial"));

    const updatedFoundations = updatedList.find((entry) => entry.id === "foundations");
    assert(updatedFoundations, "foundations should be present after a successful run");

      const initialEntry = updatedList.find((entry) => entry.id === "initial");
      assert.strictEqual(initialEntry?.currentLevel, 1);
      assert.strictEqual(initialEntry?.attempts, 0);
      assert.strictEqual(initialEntry?.bestTimeMs, null);
  });

  test("run results are stored in map stats", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const runState = new MapRunState();
    const explosions = new ExplosionModule({ scene });
    const bonuses = createBonuses();
    const resources = createResourceControllerStub();
    const bricks = new BricksModule({ scene, bridge, explosions, resources, bonuses, runState });
    const movement = new MovementService();
    const playerUnits = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
      runState,
      projectiles: createProjectilesStub(scene, bricks),
      getModuleLevel: () => 0,
      hasSkill: () => false,
      getDesignTargetingMode: () => "nearest",
    });
    const unitDesigns = createUnitDesignerStub();
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
      unitDesigns,
      runState,
    });

    let mapModuleRef: MapModule | null = null;
    const unlocks = new UnlockService({
      getMapStats: () => mapModuleRef?.getMapStats() ?? {},
      getSkillLevel: () => 0,
    });

    const maps = new MapModule({
      scene,
      bridge,
      runState,
      bonuses,
      bricks,
      playerUnits,
      necromancer,
      resources,
      unlocks,
      unitsAutomation: createUnitAutomationStub(),
      arcs: createArcModuleStub(),
      sceneCleanup: createSceneCleanupStub(),
      getSkillLevel: () => 0,
    });
    mapModuleRef = maps;

    maps.recordRunResult({ mapId: "foundations", level: 1, success: true });
    maps.recordRunResult({ mapId: "foundations", level: 1, success: false });

    const stats = maps.getMapStats();
    assert.strictEqual(stats.foundations?.[1]?.success, 1);
    assert.strictEqual(stats.foundations?.[1]?.failure, 1);
    assert.strictEqual(stats.foundations?.[1]?.bestTimeMs, null);

    const saved = maps.save() as { stats?: MapStats };
    assert(saved.stats);
    assert.strictEqual(saved.stats?.foundations?.[0]?.success, 1);
    assert.strictEqual(saved.stats?.foundations?.[0]?.failure, 1);
    assert.strictEqual(saved.stats?.foundations?.[0]?.bestTimeMs, null);
  });
});

describe("Last played map tracking", () => {
  test("records last played map and restores on load", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const runState = new MapRunState();
    const bonuses = createBonuses();
    const bricks = { setBricks: () => {} } as unknown as BricksModule;
    const playerUnits = {
      prepareForMap: () => {},
      setUnits: () => {},
    } as unknown as PlayerUnitsModule;
    const necromancer = {
      configureForMap: () => {},
      endCurrentMap: () => {},
      pauseMap: () => {},
      resumeMap: () => {},
    } as unknown as NecromancerModule;
    const resources = createResourceControllerStub();
    let mapModuleRef: MapModule | null = null;
    const unlocks = new UnlockService({
      getMapStats: () => mapModuleRef?.getMapStats() ?? {},
      getSkillLevel: () => 0,
    });

    const maps = new MapModule({
      scene,
      bridge,
      runState,
      bonuses,
      bricks,
      playerUnits,
      necromancer,
      resources,
      unlocks,
      unitsAutomation: createUnitAutomationStub(),
      arcs: createArcModuleStub(),
      sceneCleanup: createSceneCleanupStub(),
      getSkillLevel: () => 0,
    });
    mapModuleRef = maps;

    maps.initialize();
    // Start with the default training map
    maps.restartSelectedMap();
    maps.recordRunResult({ success: true, durationMs: 5000 });

    // Unlock and play Foundations
    maps.selectMap("foundations");
    maps.restartSelectedMap();
    maps.recordRunResult({ success: true, durationMs: 4200 });

    const lastPlayed = bridge.getValue<{ mapId: MapId; level: number }>(
      MAP_LAST_PLAYED_BRIDGE_KEY
    );
    assert.deepStrictEqual(lastPlayed, { mapId: "foundations", level: 1 });

    const saved = maps.save();

    const nextBridge = new DataBridge();
    const nextRunState = new MapRunState();
    const nextScene = new SceneObjectManager();
    const nextBonuses = createBonuses();
    const nextResources = createResourceControllerStub();
    let restoredModuleRef: MapModule | null = null;
    const nextUnlocks = new UnlockService({
      getMapStats: () => restoredModuleRef?.getMapStats() ?? {},
      getSkillLevel: () => 0,
    });

    const restoredMaps = new MapModule({
      scene: nextScene,
      bridge: nextBridge,
      runState: nextRunState,
      bonuses: nextBonuses,
      bricks,
      playerUnits,
      necromancer,
      resources: nextResources,
      unlocks: nextUnlocks,
      unitsAutomation: createUnitAutomationStub(),
      arcs: createArcModuleStub(),
      sceneCleanup: createSceneCleanupStub(),
      getSkillLevel: () => 0,
    });
    restoredModuleRef = restoredMaps;

    restoredMaps.load(saved);
    restoredMaps.initialize();

    const restoredLastPlayed = nextBridge.getValue<{ mapId: MapId; level: number }>(
      MAP_LAST_PLAYED_BRIDGE_KEY
    );
    assert.deepStrictEqual(restoredLastPlayed, { mapId: "foundations", level: 1 });
  });
});

describe("Map auto restart", () => {
  test("auto restart unlocks with the corresponding skill and persists", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const runState = new MapRunState();
    const explosions = new ExplosionModule({ scene });
    const bonuses = createBonuses();
    const resources = createResourceControllerStub();
    const bricks = new BricksModule({ scene, bridge, explosions, resources, bonuses, runState });
    const movement = new MovementService();
    const playerUnits = new PlayerUnitsModule({
      scene,
      bricks,
      bridge,
      movement,
      bonuses,
      explosions,
      runState,
      projectiles: createProjectilesStub(scene, bricks),
      getModuleLevel: () => 0,
      hasSkill: () => false,
      getDesignTargetingMode: () => "nearest",
    });
    const unitDesigns = createUnitDesignerStub();
    const necromancer = new NecromancerModule({
      bridge,
      playerUnits,
      scene,
      bonuses,
      unitDesigns,
      runState,
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
      runState,
      bonuses,
      bricks,
      playerUnits,
      necromancer,
      resources,
      unlocks,
      unitsAutomation: createUnitAutomationStub(),
      arcs: createArcModuleStub(),
      sceneCleanup: createSceneCleanupStub(),
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
