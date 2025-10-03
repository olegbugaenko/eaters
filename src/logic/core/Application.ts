import { DataBridge } from "./DataBridge";
import { ServiceContainer } from "./ServiceContainer";
import { GameModule, SaveSlotId } from "./types";
import { SaveManager } from "../services/SaveManager";
import { GameLoop } from "../services/GameLoop";
import { TestTimeModule } from "../modules/TestTimeModule";

export class Application {
  private serviceContainer = new ServiceContainer();
  private dataBridge = new DataBridge();
  private modules: GameModule[] = [];

  constructor() {
    const saveManager = new SaveManager();
    const gameLoop = new GameLoop();

    this.serviceContainer.register("bridge", this.dataBridge);
    this.serviceContainer.register("saveManager", saveManager);
    this.serviceContainer.register("gameLoop", gameLoop);

    const timeModule = new TestTimeModule({
      bridge: this.dataBridge,
      onStateChanged: () => {
        saveManager.saveActiveSlot();
      },
    });

    this.registerModule(timeModule);
  }

  public initialize(): void {
    this.modules.forEach((module) => module.initialize());
  }

  public selectSlot(slot: SaveSlotId): void {
    const saveManager = this.getSaveManager();
    const gameLoop = this.getGameLoop();
    saveManager.setActiveSlot(slot);
    saveManager.loadActiveSlot();
    gameLoop.start();
  }

  public getBridge(): DataBridge {
    return this.dataBridge;
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
