import { DataBridge } from "./DataBridge";
import { ServiceContainer } from "./ServiceContainer";
import { GameModule, SaveSlotId } from "./types";
import { SaveManager } from "../services/SaveManager";
import { GameLoop } from "../services/GameLoop";
import { TestTimeModule } from "../modules/TestTimeModule";
import { SceneObjectManager } from "../services/SceneObjectManager";
import { BricksModule } from "../modules/BricksModule";
import { MapModule } from "../modules/MapModule";
import { BulletModule } from "../modules/BulletModule";
import { ExplosionModule } from "../modules/ExplosionModule";
import { MapId } from "../../db/maps-db";
import { PlayerUnitsModule } from "../modules/PlayerUnitsModule";
import { MovementService } from "../services/MovementService";
import { NecromancerModule } from "../modules/NecromancerModule";
import { ResourcesModule } from "../modules/ResourcesModule";

export class Application {
  private serviceContainer = new ServiceContainer();
  private dataBridge = new DataBridge();
  private modules: GameModule[] = [];
  private mapModule: MapModule;
  private necromancerModule: NecromancerModule;
  private resourcesModule: ResourcesModule;

  constructor() {
    const saveManager = new SaveManager();
    const gameLoop = new GameLoop();
    const sceneObjects = new SceneObjectManager();
    const movementService = new MovementService();

    this.serviceContainer.register("bridge", this.dataBridge);
    this.serviceContainer.register("saveManager", saveManager);
    this.serviceContainer.register("gameLoop", gameLoop);
    this.serviceContainer.register("sceneObjects", sceneObjects);
    this.serviceContainer.register("movement", movementService);

    const resourcesModule = new ResourcesModule({
      bridge: this.dataBridge,
    });
    this.resourcesModule = resourcesModule;

    const timeModule = new TestTimeModule({
      bridge: this.dataBridge,
    });

    const explosionModule = new ExplosionModule({
      scene: sceneObjects,
    });

    const bricksModule = new BricksModule({
      scene: sceneObjects,
      bridge: this.dataBridge,
      explosions: explosionModule,
      resources: resourcesModule,
    });
    const playerUnitsModule = new PlayerUnitsModule({
      scene: sceneObjects,
      bricks: bricksModule,
      bridge: this.dataBridge,
      movement: movementService,
      onAllUnitsDefeated: () => {
        this.handleAllUnitsDefeated();
      },
    });
    this.necromancerModule = new NecromancerModule({
      bridge: this.dataBridge,
      playerUnits: playerUnitsModule,
      scene: sceneObjects,
    });
    this.mapModule = new MapModule({
      scene: sceneObjects,
      bridge: this.dataBridge,
      bricks: bricksModule,
      playerUnits: playerUnitsModule,
      necromancer: this.necromancerModule,
      resources: resourcesModule,
    });

    const bulletModule = new BulletModule({
      scene: sceneObjects,
      explosions: explosionModule,
    });

    this.registerModule(resourcesModule);
    this.registerModule(timeModule);
    this.registerModule(bricksModule);
    this.registerModule(playerUnitsModule);
    this.registerModule(this.necromancerModule);
    this.registerModule(this.mapModule);
    this.registerModule(explosionModule);
    this.registerModule(bulletModule);
  }

  public initialize(): void {
    this.modules.forEach((module) => module.initialize());
  }

  public reset(): void {
    const scene = this.getSceneObjects();
    scene.clear();
    this.modules.forEach((module) => module.reset());
  }

  public selectSlot(slot: SaveSlotId): void {
    const saveManager = this.getSaveManager();
    const gameLoop = this.getGameLoop();
    gameLoop.stop();
    saveManager.setActiveSlot(slot);
    this.reset();
    saveManager.loadActiveSlot();
    saveManager.startAutoSave(10_000);
    gameLoop.start();
  }

  public returnToMainMenu(): void {
    const saveManager = this.getSaveManager();
    const gameLoop = this.getGameLoop();
    gameLoop.stop();
    saveManager.saveActiveSlot();
    saveManager.clearActiveSlot();
  }

  public getBridge(): DataBridge {
    return this.dataBridge;
  }

  public getSceneObjects(): SceneObjectManager {
    return this.serviceContainer.get<SceneObjectManager>("sceneObjects");
  }

  public getGameLoop(): GameLoop {
    return this.serviceContainer.get<GameLoop>("gameLoop");
  }

  public getSaveManager(): SaveManager {
    return this.serviceContainer.get<SaveManager>("saveManager");
  }

  public getNecromancer(): NecromancerModule {
    return this.necromancerModule;
  }

  public restartCurrentMap(): void {
    this.mapModule.restartSelectedMap();
  }

  public selectMap(mapId: MapId): void {
    this.mapModule.selectMap(mapId);
  }

  private registerModule(module: GameModule): void {
    const saveManager = this.getSaveManager();
    const gameLoop = this.getGameLoop();
    this.modules.push(module);
    saveManager.registerModule(module);
    gameLoop.registerModule(module);
  }

  private handleAllUnitsDefeated(): void {
    if (this.necromancerModule.hasSanityForAnySpawn()) {
      return;
    }
    this.resourcesModule.finishRun();
  }
}
