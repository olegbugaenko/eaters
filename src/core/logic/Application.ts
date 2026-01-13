import { DataBridge } from "./ui/DataBridge";
import { ServiceContainer } from "./engine/ServiceContainer";
import { ServiceDefinition, ServiceLookup } from "./engine/loader/types";
import { BootstrapDefinitionList, createBootstrapDefinitions } from "./engine/loader/bootstrap";
import { createModuleDefinitions } from "@/core/logic/engine/module-definitions";
import { createModuleDefinitionContext } from "@/core/logic/engine/module-definitions/context";
import { registerModuleDefinitions } from "@/logic/engine/module-definitions/registry";
import { GameModule, SaveSlotId, StoredSaveData } from "./types";
import { createServiceLookup } from "./engine/loader/createServiceLookup";
import { DEFAULT_MODULE_CONFIG } from "@logic/config/modules";
import { ModuleRegistryConfig } from "./engine/ModuleRegistry";
import { MapModule } from "@logic/modules/active-map/map/map.module";
import { AudioModule } from "@/core/logic/provided/modules/audio/audio.module";
import { UiApiProvider } from "./ui/UiApiProvider";
import type { UiApiProxy } from "@shared/core/types/ui-api";
import type { LogicUiApiRegistry } from "@core/logic/ui/ui-api.registry";
import type { SpellcastingModuleUiApi } from "@logic/modules/active-map/spellcasting/spellcasting.types";
import type { NecromancerModuleUiApi } from "@logic/modules/active-map/necromancer/necromancer.types";
import type { UnitAutomationModuleUiApi } from "@logic/modules/active-map/unit-automation/unit-automation.types";
import type { UnitDesignModuleUiApi } from "@logic/modules/camp/unit-design/unit-design.types";
import type { UnitModuleWorkshopUiApi } from "@logic//modules/camp/unit-module-workshop/unit-module-workshop.types";
import type { BuildingsModuleUiApi } from "@logic/modules/camp/buildings/buildings.types";
import type { CraftingModuleUiApi } from "@logic/modules/camp/crafting/crafting.types";
import type { SkillTreeModuleUiApi } from "@logic/modules/camp/skill-tree/skill-tree.types";
import type { NewUnlockNotificationUiApi } from "@logic/services/new-unlock-notification/new-unlock-notification.types";

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
  public readonly uiApi: UiApiProxy<LogicUiApiRegistry>;

  constructor(private moduleConfig: ModuleRegistryConfig = DEFAULT_MODULE_CONFIG) {
    this.serviceContainer = new ServiceContainer();
    const moduleDefinitions = this.createModuleDefinitions();
    const definitions = this.buildDefinitions(moduleDefinitions);

    this.services = createServiceLookup(this.serviceContainer, definitions);

    definitions.forEach((definition) => this.registerDefinition(definition));

    this.uiApi = new UiApiProvider(this.createUiApiModules()).api;
  }

  private createModuleDefinitions(): ModuleDefinitionList {
    return createModuleDefinitions(
      createModuleDefinitionContext(),
      this.moduleConfig,
      registerModuleDefinitions,
    );
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
    (this.services.map as MapModule).leaveCurrentMap();
    saveManager.saveActiveSlot();
    saveManager.clearActiveSlot();
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

  private createUiApiModules(): LogicUiApiRegistry {
    return {
      app: this,
      audio: this.services.audio as AudioModule,
      map: this.services.map as MapModule,
      save: this.services.saveManager,
      scene: this.services.sceneObjects,
      gameLoop: this.services.gameLoop,
      spellcasting: this.services.spellcasting as SpellcastingModuleUiApi,
      necromancer: this.services.necromancer as NecromancerModuleUiApi,
      unitAutomation: this.services.unitAutomation as UnitAutomationModuleUiApi,
      unitDesign: this.services.unitDesign as UnitDesignModuleUiApi,
      unitModuleWorkshop: this.services.unitModuleWorkshop as UnitModuleWorkshopUiApi,
      buildings: this.services.buildings as BuildingsModuleUiApi,
      crafting: this.services.crafting as CraftingModuleUiApi,
      skillTree: this.services.skillTree as SkillTreeModuleUiApi,
      newUnlocks: this.services.newUnlocks as NewUnlockNotificationUiApi,
    };
  }

}
