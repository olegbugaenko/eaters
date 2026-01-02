import { SceneObjectManager, SceneSize, SceneVector2 } from "../../../services/SceneObjectManager";
import { MapRunState } from "./MapRunState";
import { MapVisualEffects } from "./map.visual-effects";
import { BricksModule, BrickData } from "../bricks/bricks.module";
import { PlayerUnitsModule, PlayerUnitSpawnData } from "../player-units/player-units.module";
import { NecromancerModule } from "../necromancer/necromancer.module";
import { ResourceRunController } from "./map.types";
import { UnitAutomationModule } from "../unit-automation/unit-automation.module";
import { ArcModule } from "../../scene/arc/arc.module";

interface MapRunLifecycleOptions {
  runState: MapRunState;
  resources: ResourceRunController;
  playerUnits: PlayerUnitsModule;
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
  generateBricks: boolean;
  generateUnits: boolean;
}

export class MapRunLifecycle {
  private activeMapLevel = 0;
  private runActive = false;

  constructor(private readonly options: MapRunLifecycleOptions) {}

  public reset(): void {
    this.options.runState.reset();
    this.runActive = false;
    this.activeMapLevel = 0;
    this.options.visuals.reset();
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
    if (this.options.runState.isIdle() && !this.runActive) {
      return;
    }
    if (!this.options.runState.isIdle() && !this.options.runState.isCompleted()) {
      this.options.resources.cancelRun();
    }
    this.runActive = false;
    this.options.visuals.reset();
    this.options.playerUnits.setUnits([]);
    this.options.bricks.setBricks([]);
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

  public tick(): void {
    this.options.visuals.tick();
  }
}

