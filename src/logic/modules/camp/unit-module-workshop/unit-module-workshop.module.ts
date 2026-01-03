import { GameModule } from "../../../core/types";
import type { DataBridge } from "../../../core/DataBridge";
import {
  UNIT_MODULE_IDS,
  UnitModuleId,
  getUnitModuleConfig,
} from "../../../../db/unit-modules-db";
import {
  ResourceStockpile,
  normalizeResourceAmount,
} from "../../../../db/resources-db";
import { ResourcesModule } from "../../shared/resources/resources.module";
import type { SkillId } from "../../../../db/skills-db";
import { UnlockService } from "../../../services/unlock/UnlockService";
import type {
  UnitModuleWorkshopItemState,
  UnitModuleWorkshopBridgeState,
  UnitModuleWorkshopModuleOptions,
  UnitModuleWorkshopSaveData,
} from "./unit-module-workshop.types";
import {
  DEFAULT_UNIT_MODULE_WORKSHOP_STATE,
  UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY,
  MODULE_UNLOCK_SKILL_ID,
} from "./unit-module-workshop.const";

// Re-export for tests
export { UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY };
export type { UnitModuleWorkshopBridgeState } from "./unit-module-workshop.types";
import {
  createDefaultLevels,
  clampLevel,
  scaleResourceStockpile,
  areModuleListsEqual,
} from "./unit-module-workshop.helpers";
import {
  UnitModuleStateFactory,
  UnitModuleStateInput,
} from "./unit-module-workshop.state-factory";

export class UnitModuleWorkshopModule implements GameModule {
  public readonly id = "unitModuleWorkshop";

  private readonly bridge: DataBridge;
  private readonly resources: ResourcesModule;
  private readonly getSkillLevel: (id: SkillId) => number;
  private readonly unlocks: UnlockService;

  private unlocked = false;
  private visibleModuleIds: UnitModuleId[] = [];
  private levels: Map<UnitModuleId, number> = createDefaultLevels();
  private listeners = new Set<() => void>();
  private readonly stateFactory: UnitModuleStateFactory;

  constructor(options: UnitModuleWorkshopModuleOptions) {
    this.bridge = options.bridge;
    this.resources = options.resources;
    this.getSkillLevel = options.getSkillLevel;
    this.unlocks = options.unlocks;
    this.stateFactory = new UnitModuleStateFactory();
  }

  public initialize(): void {
    this.refreshUnlockState();
    this.pushState();
    this.notifyListeners();
  }

  public reset(): void {
    this.levels = createDefaultLevels();
    this.refreshUnlockState();
    this.pushState();
    this.notifyListeners();
  }

  public load(data: unknown | undefined): void {
    this.levels = this.parseSaveData(data);
    this.refreshUnlockState();
    this.pushState();
    this.notifyListeners();
  }

  public save(): unknown {
    const serialized: Partial<Record<UnitModuleId, number>> = {};
    this.levels.forEach((level, id) => {
      if (level > 0) {
        serialized[id] = level;
      }
    });
    return {
      levels: serialized,
    } satisfies UnitModuleWorkshopSaveData;
  }

  public tick(_deltaMs: number): void {
    if (this.refreshUnlockState()) {
      this.pushState();
      this.notifyListeners();
    }
  }

  public tryUpgradeModule(id: UnitModuleId): boolean {
    if (!this.unlocked) {
      return false;
    }
    if (!UNIT_MODULE_IDS.includes(id)) {
      return false;
    }
    if (!this.visibleModuleIds.includes(id)) {
      return false;
    }
    const currentLevel = this.levels.get(id) ?? 0;
    const cost = this.getUpgradeCost(id, currentLevel);
    if (!this.resources.spendResources(cost)) {
      return false;
    }
    const nextLevel = currentLevel + 1;
    this.levels.set(id, nextLevel);
    this.pushState();
    this.notifyListeners();
    return true;
  }

  public getModuleLevel(id: UnitModuleId): number {
    return this.levels.get(id) ?? 0;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private refreshUnlockState(): boolean {
    const unlocked = this.getSkillLevel(MODULE_UNLOCK_SKILL_ID) > 0;
    const visibleIds = unlocked
      ? UNIT_MODULE_IDS.filter((id) =>
          this.unlocks.areConditionsMet(getUnitModuleConfig(id).unlockedBy)
        )
      : [];
    const visibleSet = new Set<UnitModuleId>(visibleIds);
    if (unlocked) {
      this.levels.forEach((level, id) => {
        if (level > 0) {
          visibleSet.add(id);
        }
      });
    }
    const orderedVisible = unlocked
      ? UNIT_MODULE_IDS.filter((id) => visibleSet.has(id))
      : [];

    const unlockedChanged = this.unlocked !== unlocked;
    const visibleChanged = !areModuleListsEqual(this.visibleModuleIds, orderedVisible);
    if (unlockedChanged || visibleChanged) {
      this.unlocked = unlocked;
      this.visibleModuleIds = orderedVisible;
      return true;
    }
    return false;
  }

  private getUpgradeCost(id: UnitModuleId, level: number): ResourceStockpile {
    const config = getUnitModuleConfig(id);
    const baseCost = normalizeResourceAmount(config.baseCost);
    const multiplier = Math.pow(2, Math.max(level, 0));
    const scaled = scaleResourceStockpile(baseCost, multiplier);
    return scaled;
  }

  private pushState(): void {
    const moduleIds = this.unlocked ? this.visibleModuleIds : [];
    const inputs: UnitModuleStateInput[] = moduleIds.map((id) => ({
      id,
      level: this.levels.get(id) ?? 0,
      getUpgradeCost: (moduleId, level) => this.getUpgradeCost(moduleId, level),
    }));
    const modules = this.stateFactory.createMany(inputs);
    this.bridge.setValue<UnitModuleWorkshopBridgeState>(
      UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY,
      {
        unlocked: this.unlocked,
        modules,
      }
    );
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("UnitModuleWorkshopModule listener error", error);
      }
    });
  }



  private parseSaveData(data: unknown): Map<UnitModuleId, number> {
    const levels = createDefaultLevels();
    if (!data || typeof data !== "object") {
      return levels;
    }
    const rawLevels = (data as UnitModuleWorkshopSaveData).levels;
    if (!rawLevels || typeof rawLevels !== "object") {
      return levels;
    }
    Object.entries(rawLevels).forEach(([key, value]) => {
      if (UNIT_MODULE_IDS.includes(key as UnitModuleId)) {
        levels.set(key as UnitModuleId, clampLevel(value));
      }
    });
    return levels;
  }
}

