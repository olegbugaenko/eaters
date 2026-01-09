import { DataBridge } from "./DataBridge";
import { ServiceContainer } from "./ServiceContainer";
import { ServiceDefinition, ServiceLookup } from "./loader/types";
import { BootstrapDefinitionList, createBootstrapDefinitions } from "./loader/bootstrap";
import { createModuleDefinitions } from "../definitions/modules";
import { createModuleDefinitionContext } from "../definitions/modules/context";
import { GameModule, SaveSlotId, StoredSaveData } from "./types";
import { AudioSettingsPercentages } from "../utils/audioSettings";
import { createServiceLookup } from "./loader/createServiceLookup";
import { MapId } from "../../db/maps-db";
import { DEFAULT_MODULE_CONFIG } from "../config/modules";
import { ModuleRegistryConfig } from "./ModuleRegistry";
import { MapModule } from "../modules/active-map/map/map.module";
import { AudioModule } from "../modules/shared/audio/audio.module";

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

  constructor(private moduleConfig: ModuleRegistryConfig = DEFAULT_MODULE_CONFIG) {
    this.serviceContainer = new ServiceContainer();
    const moduleDefinitions = this.createModuleDefinitions();
    const definitions = this.buildDefinitions(moduleDefinitions);

    this.services = createServiceLookup(this.serviceContainer, definitions);

    definitions.forEach((definition) => this.registerDefinition(definition));
  }

  private createModuleDefinitions(): ModuleDefinitionList {
    return createModuleDefinitions(createModuleDefinitionContext(), this.moduleConfig);
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
    (this.services.map as MapModule).restartSelectedMap();
  }

  public pauseCurrentMap(): void {
    (this.services.map as MapModule).pauseActiveMap();
  }

  public resumeCurrentMap(): void {
    (this.services.map as MapModule).resumeActiveMap();
  }

  public setAutoRestartEnabled(enabled: boolean): void {
    (this.services.map as MapModule).setAutoRestartEnabled(enabled);
  }

  public leaveCurrentMap(): void {
    (this.services.map as MapModule).leaveCurrentMap();
  }

  public selectMap(mapId: MapId): void {
    (this.services.map as MapModule).selectMap(mapId);
  }

  public selectMapLevel(mapId: MapId, level: number): void {
    (this.services.map as MapModule).selectMapLevel(mapId, level);
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
    const audio = this.services.audio as AudioModule;
    audio.applyPercentageSettings(settings);
  }

  public resumeAudio(): void {
    const audio = this.services.audio as AudioModule;
    audio.resumeMusic();
  }

  public playCampPlaylist(): void {
    const audio = this.services.audio as AudioModule;
    audio.playPlaylist("camp");
  }

  public playMapPlaylist(): void {
    const audio = this.services.audio as AudioModule;
    audio.playPlaylist("map");
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

}
