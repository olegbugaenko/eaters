import { DataBridge } from "./DataBridge";
import { ServiceContainer } from "./ServiceContainer";
import { GameModule, SaveSlotId, StoredSaveData } from "./types";
import { SaveManager } from "../services/SaveManager";
import { GameLoop } from "../services/GameLoop";
import { TestTimeModule } from "../modules/shared/TestTimeModule";
import { SceneObjectManager } from "../services/SceneObjectManager";
import { BricksModule } from "../modules/active-map/BricksModule";
import { MapModule } from "../modules/active-map/MapModule";
import { BulletModule } from "../modules/active-map/BulletModule";
import { ExplosionModule } from "../modules/scene/ExplosionModule";
import { ArcModule } from "../modules/scene/ArcModule";
import { EffectsModule } from "../modules/scene/EffectsModule";
import { FireballModule } from "../modules/scene/FireballModule";
import { MapId } from "../../db/maps-db";
import { PlayerUnitsModule } from "../modules/active-map/PlayerUnitsModule";
import { MovementService } from "../services/MovementService";
import { NecromancerModule } from "../modules/active-map/NecromancerModule";
import { ResourcesModule } from "../modules/shared/ResourcesModule";
import { SkillTreeModule } from "../modules/camp/SkillTreeModule";
import { BonusesModule } from "../modules/shared/BonusesModule";
import { StatisticsModule } from "../modules/shared/StatisticsModule";
import { UnlockService } from "../services/UnlockService";
import { UnitAutomationModule } from "../modules/active-map/UnitAutomationModule";
import { UnitModuleWorkshopModule } from "../modules/camp/UnitModuleWorkshopModule";
import { UnitDesignModule } from "../modules/camp/UnitDesignModule";
import { BuildingsModule } from "../modules/camp/BuildingsModule";
import { CraftingModule } from "../modules/camp/CraftingModule";
import { resetAllWaveBatches } from "../../ui/renderers/primitives/ExplosionWaveGpuRenderer";
import { AudioModule } from "../modules/shared/AudioModule";
import { AudioSettingsPercentages } from "../utils/audioSettings";
import { SpellcastingModule } from "../modules/active-map/SpellcastingModule";

export class Application {
  private serviceContainer = new ServiceContainer();
  private dataBridge = new DataBridge();
  private modules: GameModule[] = [];
  private mapModule: MapModule;
  private necromancerModule: NecromancerModule;
  private resourcesModule: ResourcesModule;
  private skillTreeModule: SkillTreeModule;
  private bonusesModule: BonusesModule;
  private statisticsModule: StatisticsModule;
  private unitAutomationModule: UnitAutomationModule;
  private unitModuleWorkshopModule: UnitModuleWorkshopModule;
  private unitDesignModule: UnitDesignModule;
  private buildingsModule: BuildingsModule;
  private craftingModule: CraftingModule;
  private explosionModule: ExplosionModule;
  private arcModule: ArcModule;
  private effectsModule: EffectsModule;
  private fireballModule: FireballModule;
  private bulletModule: BulletModule;
  private audioModule: AudioModule;
  private spellcastingModule: SpellcastingModule;

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

    let mapModuleReference: MapModule | null = null;
    let skillTreeModuleReference: SkillTreeModule | null = null;
    const unlockService = new UnlockService({
      getMapStats: () => mapModuleReference?.getMapStats() ?? {},
      getSkillLevel: (id) => skillTreeModuleReference?.getLevel(id) ?? 0,
    });
    this.serviceContainer.register("unlocks", unlockService);

    const statisticsModule = new StatisticsModule({
      bridge: this.dataBridge,
    });
    this.statisticsModule = statisticsModule;

    const resourcesModule = new ResourcesModule({
      bridge: this.dataBridge,
      unlocks: unlockService,
      bonuses: bonusesModule,
      statistics: statisticsModule,
    });
    this.resourcesModule = resourcesModule;

    const skillTreeModule = new SkillTreeModule({
      bridge: this.dataBridge,
      resources: resourcesModule,
      bonuses: bonusesModule,
    });
    this.skillTreeModule = skillTreeModule;
    skillTreeModuleReference = skillTreeModule;

    const craftingModule = new CraftingModule({
      bridge: this.dataBridge,
      resources: resourcesModule,
      unlocks: unlockService,
      bonuses: bonusesModule,
    });
    this.craftingModule = craftingModule;

    const buildingsModule = new BuildingsModule({
      bridge: this.dataBridge,
      resources: resourcesModule,
      bonuses: bonusesModule,
      unlocks: unlockService,
      getSkillLevel: (id) => this.skillTreeModule.getLevel(id),
    });
    this.buildingsModule = buildingsModule;

    const unitModuleWorkshopModule = new UnitModuleWorkshopModule({
      bridge: this.dataBridge,
      resources: resourcesModule,
      getSkillLevel: (id) => this.skillTreeModule.getLevel(id),
      unlocks: unlockService,
    });
    this.unitModuleWorkshopModule = unitModuleWorkshopModule;

    const unitDesignModule = new UnitDesignModule({
      bridge: this.dataBridge,
      bonuses: bonusesModule,
      workshop: unitModuleWorkshopModule,
    });
    this.unitDesignModule = unitDesignModule;

    const timeModule = new TestTimeModule({
      bridge: this.dataBridge,
    });

    const explosionModule = new ExplosionModule({
      scene: sceneObjects,
    });
    this.explosionModule = explosionModule;

    const audioModule = new AudioModule();
    this.audioModule = audioModule;

    const bricksModule = new BricksModule({
      scene: sceneObjects,
      bridge: this.dataBridge,
      explosions: explosionModule,
      resources: resourcesModule,
      bonuses: bonusesModule,
      audio: audioModule,
      onAllBricksDestroyed: () => {
        this.handleMapRunCompleted(true);
      },
      statistics: statisticsModule,
    });
    const playerUnitsModule = new PlayerUnitsModule({
      scene: sceneObjects,
      bricks: bricksModule,
      bridge: this.dataBridge,
      movement: movementService,
      bonuses: bonusesModule,
      explosions: explosionModule,
      arcs: undefined, // will set after ArcModule created
      effects: undefined, // will set after EffectsModule created
      audio: audioModule,
      onAllUnitsDefeated: () => {
        this.handleAllUnitsDefeated();
      },
      getModuleLevel: (id) => this.unitModuleWorkshopModule.getModuleLevel(id),
      hasSkill: (id) => this.skillTreeModule.getLevel(id) > 0,
      getDesignTargetingMode: (designId, type) =>
        unitDesignModule.getTargetingModeForDesign(designId, type),
      statistics: statisticsModule,
    });
    this.necromancerModule = new NecromancerModule({
      bridge: this.dataBridge,
      playerUnits: playerUnitsModule,
      scene: sceneObjects,
      bonuses: bonusesModule,
      unitDesigns: unitDesignModule,
      onSanityUnavailable: () => {
        this.handleAllUnitsDefeated();
      },
    });
    const unitAutomationModule = new UnitAutomationModule({
      bridge: this.dataBridge,
      necromancer: this.necromancerModule,
      unitDesigns: unitDesignModule,
      getSkillLevel: (id) => this.skillTreeModule.getLevel(id),
      isRunActive: () => mapModuleReference?.isRunActive() ?? false,
    });
    this.unitAutomationModule = unitAutomationModule;
    const arcModule = new ArcModule({
      scene: sceneObjects,
      getUnitPositionIfAlive: playerUnitsModule.getUnitPositionIfAlive,
    });
    this.arcModule = arcModule;

    const effectsModule = new EffectsModule({
      scene: sceneObjects,
      getUnitPositionIfAlive: playerUnitsModule.getUnitPositionIfAlive,
    });
    this.effectsModule = effectsModule;

    const fireballModule = new FireballModule({
      scene: sceneObjects,
      explosions: explosionModule,
      getBrickPosition: (brickId) => {
        const brick = bricksModule.getBrickState(brickId);
        return brick?.position || null;
      },
      damageBrick: (brickId, damage) => {
        const brick = bricksModule.getBrickState(brickId);
        if (brick) {
          bricksModule.applyDamage(brickId, damage, { x: 0, y: 0 }, {
            rewardMultiplier: 1,
            armorPenetration: 0,
          });
        }
      },
      getBricksInRadius: (position, radius) => {
        const nearbyBricks = bricksModule.findBricksNear(position, radius);
        return nearbyBricks.map(brick => brick.id);
      },
      logEvent: (message) => console.log(`[FireballModule] ${message}`),
    });
    this.fireballModule = fireballModule;

    mapModuleReference = new MapModule({
      scene: sceneObjects,
      bridge: this.dataBridge,
      bricks: bricksModule,
      playerUnits: playerUnitsModule,
      necromancer: this.necromancerModule,
      resources: resourcesModule,
      unlocks: unlockService,
      unitsAutomation: unitAutomationModule,
      arcs: arcModule,
      getSkillLevel: (id) => this.skillTreeModule.getLevel(id),
      onRunCompleted: (success) => this.handleMapRunCompleted(success),
    });
    this.mapModule = mapModuleReference;

    const bulletModule = new BulletModule({
      scene: sceneObjects,
      explosions: explosionModule,
    });
    this.bulletModule = bulletModule;

    const spellcastingModule = new SpellcastingModule({
      bridge: this.dataBridge,
      scene: sceneObjects,
      necromancer: this.necromancerModule,
      bricks: bricksModule,
      bonuses: bonusesModule,
    });
    this.spellcastingModule = spellcastingModule;

    this.registerModule(bonusesModule);
    this.registerModule(statisticsModule);
    this.registerModule(resourcesModule);
    this.registerModule(skillTreeModule);
    this.registerModule(craftingModule);
    this.registerModule(buildingsModule);
    this.registerModule(unitModuleWorkshopModule);
    this.registerModule(unitDesignModule);
    this.registerModule(timeModule);
    this.registerModule(bricksModule);
    this.registerModule(playerUnitsModule);
    // now arcs module is ready; link it to playerUnits (optional, legacy code still works without)
    (playerUnitsModule as any).arcs = arcModule;
    (playerUnitsModule as any).effects = effectsModule;
    (playerUnitsModule as any).fireballs = fireballModule;
    this.registerModule(this.necromancerModule);
    this.registerModule(this.unitAutomationModule);
    this.registerModule(this.mapModule);
    this.registerModule(explosionModule);
    this.registerModule(arcModule);
    this.registerModule(effectsModule);
    this.registerModule(fireballModule);
    this.registerModule(bulletModule);
    this.registerModule(spellcastingModule);
    this.registerModule(audioModule);
  }

  public initialize(): void {
    this.modules.forEach((module) => module.initialize());
  }

  public reset(): void {
    const scene = this.getSceneObjects();
    scene.clear();
    this.modules.forEach((module) => module.reset());
    // Clear GPU wave instances to avoid lingering artifacts
    try {
      resetAllWaveBatches();
    } catch {}
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
    this.leaveCurrentMap();
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

  public getUnitDesigner(): UnitDesignModule {
    return this.unitDesignModule;
  }

  public getSkillTree(): SkillTreeModule {
    return this.skillTreeModule;
  }

  public getUnitAutomation(): UnitAutomationModule {
    return this.unitAutomationModule;
  }

  public getUnitModuleWorkshop(): UnitModuleWorkshopModule {
    return this.unitModuleWorkshopModule;
  }

  public getBuildings(): BuildingsModule {
    return this.buildingsModule;
  }

  public getCrafting(): CraftingModule {
    return this.craftingModule;
  }

  public getSpellcasting(): SpellcastingModule {
    return this.spellcastingModule;
  }

  public restartCurrentMap(): void {
    this.cleanupSceneAfterRun();
    this.mapModule.restartSelectedMap();
  }

  public setAutoRestartEnabled(enabled: boolean): void {
    this.mapModule.setAutoRestartEnabled(enabled);
  }

  public setAutoRestartThreshold(enabled: boolean, minEffectiveUnits: number): void {
    this.mapModule.setAutoRestartThreshold(enabled, minEffectiveUnits);
  }

  public leaveCurrentMap(): void {
    this.mapModule.leaveCurrentMap();
    this.cleanupSceneAfterRun();
  }

  public selectMap(mapId: MapId): void {
    this.mapModule.selectMap(mapId);
  }

  public selectMapLevel(mapId: MapId, level: number): void {
    this.mapModule.selectMapLevel(mapId, level);
  }

  public hasActiveSaveSlot(): boolean {
    return this.getSaveManager().getActiveSlotId() !== null;
  }

  public exportActiveSave(): StoredSaveData | null {
    return this.getSaveManager().exportActiveSlot();
  }

  public importActiveSave(data: StoredSaveData): void {
    this.getSaveManager().importToActiveSlot(data);
  }

  public applyAudioSettings(settings: AudioSettingsPercentages): void {
    this.audioModule.applyPercentageSettings(settings);
  }

  public resumeAudio(): void {
    this.audioModule.resumeMusic();
  }

  public playCampPlaylist(): void {
    this.audioModule.playPlaylist("camp");
  }

  public playMapPlaylist(): void {
    this.audioModule.playPlaylist("map");
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
    this.handleMapRunCompleted(false);
  }

  private handleMapRunCompleted(success: boolean): void {
    if (this.resourcesModule.isRunSummaryAvailable()) {
      return;
    }
    const durationMs = this.resourcesModule.getRunDurationMs();
    this.mapModule.recordRunResult({ success, durationMs });
    this.resourcesModule.finishRun();
    this.cleanupSceneAfterRun();
  }

  private cleanupSceneAfterRun(): void {
    this.fireballModule.reset();
    this.bulletModule.reset();
    this.explosionModule.reset();
    this.arcModule.reset();
    this.effectsModule.reset();
  }

}
