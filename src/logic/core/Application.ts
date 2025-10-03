import { DataBridge } from "./DataBridge";
import { ServiceContainer } from "./ServiceContainer";
import { GameModule, SaveSlotId } from "./types";
import { SaveManager } from "../services/SaveManager";
import { GameLoop } from "../services/GameLoop";
import { TestTimeModule } from "../modules/TestTimeModule";
import { SceneObjectManager } from "../services/SceneObjectManager";
import { BricksModule } from "../modules/BricksModule";
import { BulletModule } from "../modules/BulletModule";
import { ExplosionModule } from "../modules/ExplosionModule";

export class Application {
  private serviceContainer = new ServiceContainer();
  private dataBridge = new DataBridge();
  private modules: GameModule[] = [];

  constructor() {
    const saveManager = new SaveManager();
    const gameLoop = new GameLoop();
    const sceneObjects = new SceneObjectManager();

    this.serviceContainer.register("bridge", this.dataBridge);
    this.serviceContainer.register("saveManager", saveManager);
    this.serviceContainer.register("gameLoop", gameLoop);
    this.serviceContainer.register("sceneObjects", sceneObjects);

    const timeModule = new TestTimeModule({
      bridge: this.dataBridge,
    });

    const bricksModule = new BricksModule({
      scene: sceneObjects,
      bridge: this.dataBridge,
    });

    const explosionModule = new ExplosionModule({
      scene: sceneObjects,
    });

    const bulletModule = new BulletModule({
      scene: sceneObjects,
      explosions: explosionModule,
    });

    this.registerModule(timeModule);
    this.registerModule(bricksModule);
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

  private registerModule(module: GameModule): void {
    const saveManager = this.getSaveManager();
    const gameLoop = this.getGameLoop();
    this.modules.push(module);
    saveManager.registerModule(module);
    gameLoop.registerModule(module);
  }
}
