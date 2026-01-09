import { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { MapRunState } from "./MapRunState";
import { MapVisualEffects } from "./map.visual-effects";
import { BricksModule } from "../bricks/bricks.module";
import type { BrickData } from "../bricks/bricks.types";
import { PlayerUnitsModule } from "../player-units/player-units.module";
import type { PlayerUnitSpawnData } from "../player-units/player-units.types";
import { EnemiesModule } from "../enemies/enemies.module";
import { EnemySpawnController } from "../enemies/enemies.spawn-controller";
import type { MapEnemySpawnPointConfig } from "../../../../db/maps-db";
import type { EnemySpawnData } from "../enemies/enemies.types";
import { NecromancerModule } from "../necromancer/necromancer.module";
import { ResourceRunController } from "./map.types";
import { UnitAutomationModule } from "../unit-automation/unit-automation.module";
import { ArcModule } from "../../scene/arc/arc.module";

interface MapRunLifecycleOptions {
  runState: MapRunState;
  resources: ResourceRunController;
  playerUnits: PlayerUnitsModule;
  enemies: EnemiesModule;
  bricks: BricksModule;
  unitsAutomation: UnitAutomationModule;
  arcs: ArcModule;
  necromancer: NecromancerModule;
  visuals: MapVisualEffects;
  scene: SceneObjectManager;
}

interface StartRunPayload {
  level: number;
  sceneSize: SceneSize;
  bricks: BrickData[];
  spawnUnits: PlayerUnitSpawnData[];
  spawnPoints: SceneVector2[];
  enemySpawnPoints: readonly MapEnemySpawnPointConfig[];
  staticEnemies: EnemySpawnData[];
  generateBricks: boolean;
  generateUnits: boolean;
  generateEnemies: boolean;
}

export class MapRunLifecycle {
  private activeMapLevel = 0;
  private runActive = false;
  private readonly enemySpawnController: EnemySpawnController;
  private enemySpawnPoints: readonly MapEnemySpawnPointConfig[] = [];

  constructor(private readonly options: MapRunLifecycleOptions) {
    this.enemySpawnController = new EnemySpawnController();
  }

  public reset(): void {
    this.options.runState.reset();
    this.runActive = false;
    this.activeMapLevel = 0;
    this.options.visuals.reset();
    this.enemySpawnController.reset();
    this.enemySpawnPoints = [];
  }

  public isRunActive(): boolean {
    return this.options.runState.isRunning();
  }

  public getActiveMapLevel(): number {
    return this.activeMapLevel;
  }

  public pause(): void {
    this.options.runState.pause();
    this.options.necromancer.pauseMap();
  }

  public resume(): void {
    this.options.runState.resume();
    this.options.necromancer.resumeMap();
  }

  public startRun(payload: StartRunPayload): void {
    this.activeMapLevel = payload.level;
    this.runActive = true;
    this.options.runState.start();
    this.options.unitsAutomation.onMapStart();
    this.options.scene.setMapSize(payload.sceneSize);
    this.options.visuals.reset();
    this.options.visuals.clearPendingFocus();
    this.options.playerUnits.prepareForMap();
    this.options.bricks.setBricks(payload.generateBricks ? payload.bricks : []);
    this.options.playerUnits.setUnits(payload.generateUnits ? payload.spawnUnits : []);
    this.options.enemies.setEnemies(payload.generateEnemies ? payload.staticEnemies : []); // Set static enemies
    this.enemySpawnPoints = payload.enemySpawnPoints;
    this.enemySpawnController.reset();
    this.options.necromancer.configureForMap({
      spawnPoints: payload.spawnPoints,
    });
    if (payload.spawnPoints.length > 0) {
      this.options.visuals.setCameraFocus(payload.spawnPoints[0]!);
    }
    this.options.visuals.spawnPortals(payload.spawnPoints);
    this.options.resources.startRun();
  }

  public cleanupActiveMap(): void {
    // Always cleanup units and bricks, even if runState is idle
    // This ensures clean state when starting a new map
    if (!this.options.runState.isIdle() && !this.options.runState.isCompleted()) {
      this.options.resources.cancelRun();
    }
    this.runActive = false;
    this.options.visuals.reset();
    this.options.playerUnits.setUnits([]);
    this.options.bricks.setBricks([]);
    this.options.enemies.setEnemies([]);
    this.enemySpawnController.reset();
    this.enemySpawnPoints = [];
    this.options.unitsAutomation.onMapEnd();
    this.options.arcs.clearArcs();
    this.options.necromancer.endCurrentMap();
    this.activeMapLevel = 0;
  }

  public completeRun(): void {
    this.runActive = false;
    this.options.unitsAutomation.onMapEnd();
    this.options.visuals.clearPendingFocus();
    this.options.necromancer.pauseMap();
  }

  public tick(deltaMs: number): void {
    this.options.visuals.tick();
    if (this.runActive && this.enemySpawnPoints.length > 0) {
      this.enemySpawnController.tick(
        deltaMs,
        this.enemySpawnPoints,
        this.options.enemies,
        this.activeMapLevel
      );
    }
  }
}

