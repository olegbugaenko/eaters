import { DataBridge } from "./DataBridge";
import { ServiceContainer } from "./ServiceContainer";
import { ServiceDefinition, ServiceLookup } from "./loader/types";
import { BootstrapDefinitionList, createBootstrapDefinitions } from "./loader/bootstrap";
import { createModuleDefinitions } from "../definitions/modules";
import { GameModule, SaveSlotId, StoredSaveData } from "./types";
import { MapId } from "../../db/maps-db";
import { MapModule } from "../modules/active-map/map/map.module";
import { resetAllWaveBatches } from "../../ui/renderers/primitives/gpu/ExplosionWaveGpuRenderer";
import { resetAllArcBatches } from "../../ui/renderers/primitives/gpu/ArcGpuRenderer";
import { clearAllParticleEmitters } from "../../ui/renderers/primitives/gpu/ParticleEmitterGpuRenderer";
import { AudioSettingsPercentages } from "../utils/audioSettings";
import { MapRunState, MapRunEvent } from "../modules/active-map/map/MapRunState";
import { createServiceLookup } from "./loader/createServiceLookup";

type ModuleDefinitionList = ReturnType<typeof createModuleDefinitions>;
type ApplicationDefinitionList = readonly [
  ServiceDefinition<DataBridge, "bridge">,
  ...BootstrapDefinitionList,
  ...ModuleDefinitionList,
];
export type ApplicationServices = ServiceLookup<ApplicationDefinitionList>;

export class Application {
  private serviceContainer: ServiceContainer;
  private dataBridge = new DataBridge();
  private modules: GameModule[] = [];
  public services: ApplicationServices;
  private mapModule?: MapModule;

  constructor() {
    this.serviceContainer = new ServiceContainer();
    const moduleDefinitions = this.createModuleDefinitions();
    const definitions = this.buildDefinitions(moduleDefinitions);

    this.services = createServiceLookup(this.serviceContainer, definitions);

    definitions.forEach((definition) => this.registerDefinition(definition));

    const runState = this.services.mapRunState;
    runState.subscribe((event) => this.handleRunStateEvent(event));
  }

  private createModuleDefinitions(): ModuleDefinitionList {
    return createModuleDefinitions({
      onAllUnitsDefeated: () => this.handleAllUnitsDefeated(),
      setMapModule: (mapModule) => {
        this.mapModule = mapModule;
      },
    });
  }

  private buildDefinitions(moduleDefinitions: ModuleDefinitionList): ApplicationDefinitionList {
    return [
      this.createBridgeDefinition(),
      ...createBootstrapDefinitions(),
      ...moduleDefinitions,
    ] as const;
  }

  private createBridgeDefinition(): ServiceDefinition<DataBridge, "bridge"> {
    return { token: "bridge", factory: () => this.dataBridge };
  }

  public initialize(): void {
    this.modules.forEach((module) => module.initialize());
  }

  public reset(): void {
    const scene = this.services.sceneObjects;
    scene.clear();
    this.modules.forEach((module) => module.reset());
    scene.flushAllPendingRemovals();
    this.resetGpuCaches();
  }

  public selectSlot(slot: SaveSlotId): void {
    const { saveManager, gameLoop } = this.services;
    gameLoop.stop();
    saveManager.setActiveSlot(slot);
    this.reset();
    saveManager.loadActiveSlot();
    saveManager.startAutoSave(10_000);
    gameLoop.start();
  }

  public returnToMainMenu(): void {
    const { saveManager, gameLoop } = this.services;
    gameLoop.stop();
    this.leaveCurrentMap();
    saveManager.saveActiveSlot();
    saveManager.clearActiveSlot();
  }

  public restartCurrentMap(): void {
    this.cleanupSceneAfterRun();
    this.getMapModule().restartSelectedMap();
  }

  public pauseCurrentMap(): void {
    this.services.map.pauseActiveMap();
  }

  public resumeCurrentMap(): void {
    this.services.map.resumeActiveMap();
  }

  public setAutoRestartEnabled(enabled: boolean): void {
    this.services.map.setAutoRestartEnabled(enabled);
  }

  public leaveCurrentMap(): void {
    this.services.map.leaveCurrentMap();
    this.cleanupSceneAfterRun();
  }

  public selectMap(mapId: MapId): void {
    this.services.map.selectMap(mapId);
  }

  public selectMapLevel(mapId: MapId, level: number): void {
    this.services.map.selectMapLevel(mapId, level);
  }

  public hasActiveSaveSlot(): boolean {
    return this.services.saveManager.getActiveSlotId() !== null;
  }

  public exportActiveSave(): StoredSaveData | null {
    return this.services.saveManager.exportActiveSlot();
  }

  public importActiveSave(data: StoredSaveData): void {
    this.services.saveManager.importToActiveSlot(data);
  }

  public applyAudioSettings(settings: AudioSettingsPercentages): void {
    this.services.audio.applyPercentageSettings(settings);
  }

  public resumeAudio(): void {
    this.services.audio.resumeMusic();
  }

  public playCampPlaylist(): void {
    this.services.audio.playPlaylist("camp");
  }

  public playMapPlaylist(): void {
    this.services.audio.playPlaylist("map");
  }

  private registerDefinition<TDefinition extends ServiceDefinition<unknown, string, any>>(
    definition: TDefinition,
  ): TDefinition extends ServiceDefinition<infer Instance, string, any> ? Instance : never {
    const instance = definition.factory(this.serviceContainer);
    this.serviceContainer.register(definition.token, instance);

    if (definition.registerAsModule) {
      this.registerModule(instance as unknown as GameModule);
    }

    definition.onReady?.(instance, this.serviceContainer);
    return instance as TDefinition extends ServiceDefinition<infer Instance, string, any> ? Instance : never;
  }

  private registerModule(module: GameModule): void {
    const { saveManager, gameLoop } = this.services;
    this.modules.push(module);
    saveManager.registerModule(module);
    gameLoop.registerModule(module);
  }

  private handleRunStateEvent(event: MapRunEvent): void {
    if (event.type === "complete") {
      this.handleMapRunCompleted(event.success);
    }
  }

  private getMapModule(): MapModule {
    return this.services.map;
  }

  private handleAllUnitsDefeated(): void {
    if (this.services.necromancer.isSanityDepleted()) {
      this.services.mapRunState.complete(false);
    }
  }

  private handleMapRunCompleted(success: boolean): void {
    const { resources } = this.services;
    if (resources.isRunSummaryAvailable()) {
      return;
    }
    const durationMs = resources.getRunDurationMs();
    this.getMapModule().recordRunResult({ success, durationMs });
    resources.finishRun();
  }

  private cleanupSceneAfterRun(): void {
    this.services.fireball.reset();
    this.services.bullet.reset();
    this.services.explosion.reset();
    this.services.arc.reset();
    this.services.effects.reset();
    this.services.sceneObjects.flushAllPendingRemovals();
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
