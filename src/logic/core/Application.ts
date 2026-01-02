import { DataBridge } from "./DataBridge";
import { ServiceContainer } from "./ServiceContainer";
import { ServiceDefinition } from "./loader/types";
import { createBootstrapDefinitions } from "./loader/bootstrap";
import { createModuleDefinitions } from "../definitions/modules";
import { GameModule, SaveSlotId, StoredSaveData } from "./types";
import { MapId } from "../../db/maps-db";
import { MapModule } from "../modules/active-map/map/map.module";
import { BulletModule } from "../modules/active-map/bullet/bullet.module";
import { NecromancerModule } from "../modules/active-map/necromancer/necromancer.module";
import { PlayerUnitsModule } from "../modules/active-map/player-units/player-units.module";
import { SpellcastingModule } from "../modules/active-map/spellcasting/spellcasting.module";
import { AudioModule } from "../modules/shared/audio/audio.module";
import { BonusesModule } from "../modules/shared/bonuses/bonuses.module";
import { ResourcesModule } from "../modules/shared/resources/resources.module";
import { SkillTreeModule } from "../modules/camp/skill-tree/skill-tree.module";
import { StatisticsModule } from "../modules/shared/statistics/statistics.module";
import { UnitAutomationModule } from "../modules/active-map/unit-automation/unit-automation.module";
import { UnitDesignModule } from "../modules/camp/unit-design/unit-design.module";
import { UnitModuleWorkshopModule } from "../modules/camp/unit-module-workshop/unit-module-workshop.module";
import { BuildingsModule } from "../modules/camp/buildings/buildings.module";
import { CraftingModule } from "../modules/camp/crafting/crafting.module";
import { resetAllWaveBatches } from "../../ui/renderers/primitives/gpu/ExplosionWaveGpuRenderer";
import { resetAllArcBatches } from "../../ui/renderers/primitives/gpu/ArcGpuRenderer";
import { clearAllParticleEmitters } from "../../ui/renderers/primitives/gpu/ParticleEmitterGpuRenderer";
import { AudioSettingsPercentages } from "../utils/audioSettings";
import { SaveManager } from "../services/SaveManager";
import { GameLoop } from "../services/GameLoop";
import { SceneObjectManager } from "../services/SceneObjectManager";
import { ExplosionModule } from "../modules/scene/explosion/explosion.module";
import { ArcModule } from "../modules/scene/arc/arc.module";
import { EffectsModule } from "../modules/scene/effects/effects.module";
import { FireballModule } from "../modules/scene/fireball/fireball.module";

export class Application {
  private serviceContainer = new ServiceContainer();
  private dataBridge = new DataBridge();
  private modules: GameModule[] = [];
  private mapModule?: MapModule;

  constructor() {
    this.serviceContainer.register("bridge", this.dataBridge);
    createBootstrapDefinitions().forEach((definition) => this.registerDefinition(definition));

    const moduleDefinitions = createModuleDefinitions({
      onRunCompleted: (success) => this.handleMapRunCompleted(success),
      onAllUnitsDefeated: () => this.handleAllUnitsDefeated(),
      setMapModule: (mapModule) => {
        this.mapModule = mapModule;
      },
    });

    moduleDefinitions.forEach((definition) => this.registerDefinition(definition));
  }

  public initialize(): void {
    this.modules.forEach((module) => module.initialize());
  }

  public reset(): void {
    const scene = this.getSceneObjects();
    scene.clear();
    this.modules.forEach((module) => module.reset());
    scene.flushAllPendingRemovals();
    this.resetGpuCaches();
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
    return this.serviceContainer.get("necromancer");
  }

  public getBonuses(): BonusesModule {
    return this.serviceContainer.get("bonuses");
  }

  public getUnitDesigner(): UnitDesignModule {
    return this.serviceContainer.get("unitDesign");
  }

  public getSkillTree(): SkillTreeModule {
    return this.serviceContainer.get("skillTree");
  }

  public getUnitAutomation(): UnitAutomationModule {
    return this.serviceContainer.get("unitAutomation");
  }

  public getUnitModuleWorkshop(): UnitModuleWorkshopModule {
    return this.serviceContainer.get("unitModuleWorkshop");
  }

  public getBuildings(): BuildingsModule {
    return this.serviceContainer.get("buildings");
  }

  public getCrafting(): CraftingModule {
    return this.serviceContainer.get("crafting");
  }

  public getSpellcasting(): SpellcastingModule {
    return this.serviceContainer.get("spellcasting");
  }

  public restartCurrentMap(): void {
    this.cleanupSceneAfterRun();
    this.getMapModule().restartSelectedMap();
  }

  public pauseCurrentMap(): void {
    this.getMapModule().pauseActiveMap();
  }

  public resumeCurrentMap(): void {
    this.getMapModule().resumeActiveMap();
  }

  public setAutoRestartEnabled(enabled: boolean): void {
    this.getMapModule().setAutoRestartEnabled(enabled);
  }

  public leaveCurrentMap(): void {
    this.getMapModule().leaveCurrentMap();
    this.cleanupSceneAfterRun();
  }

  public selectMap(mapId: MapId): void {
    this.getMapModule().selectMap(mapId);
  }

  public selectMapLevel(mapId: MapId, level: number): void {
    this.getMapModule().selectMapLevel(mapId, level);
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
    this.serviceContainer.get<AudioModule>("audio").applyPercentageSettings(settings);
  }

  public resumeAudio(): void {
    this.serviceContainer.get<AudioModule>("audio").resumeMusic();
  }

  public playCampPlaylist(): void {
    this.serviceContainer.get<AudioModule>("audio").playPlaylist("camp");
  }

  public playMapPlaylist(): void {
    this.serviceContainer.get<AudioModule>("audio").playPlaylist("map");
  }

  private registerDefinition<T>(definition: ServiceDefinition<T>): T {
    const instance = definition.factory(this.serviceContainer);
    this.serviceContainer.register(definition.token, instance);

    if (definition.registerAsModule) {
      this.registerModule(instance as unknown as GameModule);
    }

    definition.onReady?.(instance, this.serviceContainer);
    return instance;
  }

  private registerModule(module: GameModule): void {
    const saveManager = this.getSaveManager();
    const gameLoop = this.getGameLoop();
    this.modules.push(module);
    saveManager.registerModule(module);
    gameLoop.registerModule(module);
  }

  private getMapModule(): MapModule {
    return this.serviceContainer.get("map");
  }

  private handleAllUnitsDefeated(): void {
    if (this.getNecromancer().isSanityDepleted()) {
      this.handleMapRunCompleted(false);
    }
  }

  private handleMapRunCompleted(success: boolean): void {
    const resources = this.serviceContainer.get<ResourcesModule>("resources");
    if (resources.isRunSummaryAvailable()) {
      return;
    }
    const durationMs = resources.getRunDurationMs();
    this.getMapModule().recordRunResult({ success, durationMs });
    resources.finishRun();
  }

  private cleanupSceneAfterRun(): void {
    this.serviceContainer.get<FireballModule>("fireball").reset();
    this.serviceContainer.get<BulletModule>("bullet").reset();
    this.serviceContainer.get<ExplosionModule>("explosion").reset();
    this.serviceContainer.get<ArcModule>("arc").reset();
    this.serviceContainer.get<EffectsModule>("effects").reset();
    this.getSceneObjects().flushAllPendingRemovals();
    this.resetGpuCaches();
  }

  private resetGpuCaches(): void {
    // Clear GPU caches to avoid lingering artifacts and memory leaks between runs
    try {
      resetAllWaveBatches();
    } catch {}
    try {
      resetAllArcBatches();
    } catch {}
    try {
      clearAllParticleEmitters();
    } catch {}
  }

}
