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
import { SkillTreeModule } from "../modules/SkillTreeModule";
import { BonusesModule } from "../modules/BonusesModule";
import { UnlockService } from "../services/UnlockService";
import { UnitAutomationModule } from "../modules/UnitAutomationModule";

export class Application {
  private serviceContainer = new ServiceContainer();
  private dataBridge = new DataBridge();
  private modules: GameModule[] = [];
  private mapModule: MapModule;
  private necromancerModule: NecromancerModule;
  private resourcesModule: ResourcesModule;
  private skillTreeModule: SkillTreeModule;
  private bonusesModule: BonusesModule;
  private unitAutomationModule: UnitAutomationModule;

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

    const bonusesModule = new BonusesModule();
    this.bonusesModule = bonusesModule;

    const resourcesModule = new ResourcesModule({
      bridge: this.dataBridge,
    });
    this.resourcesModule = resourcesModule;

    const skillTreeModule = new SkillTreeModule({
      bridge: this.dataBridge,
      resources: resourcesModule,
      bonuses: bonusesModule,
    });
    this.skillTreeModule = skillTreeModule;

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
      bonuses: bonusesModule,
    });
    const playerUnitsModule = new PlayerUnitsModule({
      scene: sceneObjects,
      bricks: bricksModule,
      bridge: this.dataBridge,
      movement: movementService,
      bonuses: bonusesModule,
      onAllUnitsDefeated: () => {
        this.handleAllUnitsDefeated();
      },
    });
    this.necromancerModule = new NecromancerModule({
      bridge: this.dataBridge,
      playerUnits: playerUnitsModule,
      scene: sceneObjects,
      bonuses: bonusesModule,
    });
    const unitAutomationModule = new UnitAutomationModule({
      bridge: this.dataBridge,
      necromancer: this.necromancerModule,
      getSkillLevel: (id) => this.skillTreeModule.getLevel(id),
    });
    this.unitAutomationModule = unitAutomationModule;
    let mapModuleReference: MapModule | null = null;
    const unlockService = new UnlockService({
      getMapStats: () => mapModuleReference?.getMapStats() ?? {},
      getSkillLevel: (id) => this.skillTreeModule.getLevel(id),
    });
    this.serviceContainer.register("unlocks", unlockService);

    mapModuleReference = new MapModule({
      scene: sceneObjects,
      bridge: this.dataBridge,
      bricks: bricksModule,
      playerUnits: playerUnitsModule,
      necromancer: this.necromancerModule,
      resources: resourcesModule,
      unlocks: unlockService,
    });
    this.mapModule = mapModuleReference;

    const bulletModule = new BulletModule({
      scene: sceneObjects,
      explosions: explosionModule,
    });

    this.registerModule(bonusesModule);
    this.registerModule(resourcesModule);
    this.registerModule(skillTreeModule);
    this.registerModule(timeModule);
    this.registerModule(bricksModule);
    this.registerModule(playerUnitsModule);
    this.registerModule(this.necromancerModule);
    this.registerModule(this.unitAutomationModule);
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

  public getBonuses(): BonusesModule {
    return this.bonusesModule;
  }

  public getSkillTree(): SkillTreeModule {
    return this.skillTreeModule;
  }

  public getUnitAutomation(): UnitAutomationModule {
    return this.unitAutomationModule;
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
