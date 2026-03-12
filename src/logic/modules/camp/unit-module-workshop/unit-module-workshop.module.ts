import { BaseGameModule } from "@/core/logic/engine/BaseGameModule";
import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import {
  serializeLevelsMap,
  parseLevelsMapFromSaveData,
} from "../../../helpers/save-data.helper";
import type { DataBridge } from "@/core/logic/ui/DataBridge";
import {
  UNIT_MODULE_IDS,
  UnitModuleId,
  getUnitModuleConfig,
} from "../../../../db/unit-modules-db";
import { isDemoBuild } from "@shared/helpers/demo.helper";
import {
  ResourceStockpile,
  normalizeResourceAmount,
} from "../../../../db/resources-db";
import { ResourcesModule } from "../../shared/resources/resources.module";
import type { SkillId } from "../../../../db/skills-db";
import { UnlockService } from "../../../services/unlock/UnlockService";
import { NewUnlockNotificationService } from "@logic/services/new-unlock-notification/NewUnlockNotification";
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
  getMaxLevel,
  scaleResourceStockpile,
  areModuleListsEqual,
} from "./unit-module-workshop.helpers";
import {
  UnitModuleStateFactory,
  UnitModuleStateInput,
} from "./unit-module-workshop.state-factory";
import { trackAnalyticsEvent } from "@shared/helpers/google-analytics.helper";

export class UnitModuleWorkshopModule extends BaseGameModule<() => void> {
  public readonly id = "unitModuleWorkshop";

  private readonly bridge: DataBridge;
  private readonly resources: ResourcesModule;
  private readonly getSkillLevel: (id: SkillId) => number;
  private readonly unlocks: UnlockService;
  private readonly newUnlocks: NewUnlockNotificationService;

  private unlocked = false;
  private visibleModuleIds: UnitModuleId[] = [];
  private levels: Map<UnitModuleId, number> = createDefaultLevels();
  private hideMaxedWorkshop = false;
  private showHiddenWorkshop = false;
  private hiddenModuleIds = new Set<UnitModuleId>();
  private readonly stateFactory: UnitModuleStateFactory;
  private hasRegisteredUnlocks = false;

  constructor(options: UnitModuleWorkshopModuleOptions) {
    super();
    this.bridge = options.bridge;
    this.resources = options.resources;
    this.getSkillLevel = options.getSkillLevel;
    this.unlocks = options.unlocks;
    this.newUnlocks = options.newUnlocks;
    this.stateFactory = new UnitModuleStateFactory({
      getText: ({ id, name, description, bonusLabel }) =>
        options.localization?.getUnitModuleText(id, { name, description, bonusLabel }) ?? {
          name,
          description,
          bonusLabel,
        },
    });
  }

  public initialize(): void {
    this.registerUnlockNotifications();
    this.refreshUnlockState();
    this.newUnlocks.invalidate("biolab");
    this.pushState();
    this.notifyListeners();
  }

  public reset(): void {
    this.levels = createDefaultLevels();
    this.hideMaxedWorkshop = false;
    this.showHiddenWorkshop = false;
    this.hiddenModuleIds = new Set();
    this.refreshUnlockState();
    this.newUnlocks.invalidate("biolab");
    this.pushState();
    this.notifyListeners();
  }

  public load(data: unknown | undefined): void {
    this.levels = this.parseSaveData(data);
    this.hideMaxedWorkshop = this.parseHideMaxedWorkshop(data);
    this.showHiddenWorkshop = this.parseShowHiddenWorkshop(data);
    this.hiddenModuleIds = this.parseHiddenModuleIds(data);
    this.refreshUnlockState();
    this.newUnlocks.invalidate("biolab");
    this.pushState();
    this.notifyListeners();
  }

  public save(): unknown {
    return {
      levels: serializeLevelsMap(this.levels),
      hideMaxedWorkshop: this.hideMaxedWorkshop,
      showHiddenWorkshop: this.showHiddenWorkshop,
      hiddenModuleIds: this.hiddenModuleIds.size > 0 ? Array.from(this.hiddenModuleIds) : undefined,
    } satisfies UnitModuleWorkshopSaveData;
  }

  public tick(_deltaMs: number): void {
    if (this.refreshUnlockState()) {
      this.newUnlocks.invalidate("biolab");
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
    const maxLevel = getMaxLevel(getUnitModuleConfig(id));
    if (currentLevel >= maxLevel) {
      return false;
    }
    const cost = this.getUpgradeCost(id, currentLevel);
    if (!this.resources.spendResources(cost)) {
      return false;
    }
    const nextLevel = currentLevel + 1;
    this.levels.set(id, nextLevel);
    this.pushState();
    this.notifyListeners();
    trackAnalyticsEvent("unit_module_purchased", { moduleId: id, level: nextLevel });
    return true;
  }

  public getModuleLevel(id: UnitModuleId): number {
    return this.levels.get(id) ?? 0;
  }

  public setHideMaxedWorkshop(value: boolean): void {
    if (this.hideMaxedWorkshop === value) return;
    this.hideMaxedWorkshop = value;
    this.pushState();
    this.notifyListeners();
  }

  public setShowHiddenWorkshop(value: boolean): void {
    if (this.showHiddenWorkshop === value) return;
    this.showHiddenWorkshop = value;
    this.pushState();
    this.notifyListeners();
  }

  public setModuleHidden(id: UnitModuleId, hidden: boolean): void {
    if (!UNIT_MODULE_IDS.includes(id)) return;
    if (hidden) {
      this.hiddenModuleIds.add(id);
    } else {
      this.hiddenModuleIds.delete(id);
    }
    this.pushState();
    this.notifyListeners();
  }

  private refreshUnlockState(): boolean {
    const unlocked = this.getSkillLevel(MODULE_UNLOCK_SKILL_ID) > 0;
    const visibleIds = unlocked
      ? UNIT_MODULE_IDS.filter((id) =>
          this.unlocks.areConditionsMet(getUnitModuleConfig(id).unlockedBy) &&
          !(isDemoBuild() && getUnitModuleConfig(id).lockedForDemo)
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

  private registerUnlockNotifications(): void {
    if (this.hasRegisteredUnlocks) {
      return;
    }
    this.hasRegisteredUnlocks = true;
    UNIT_MODULE_IDS.forEach((id) => {
      const config = getUnitModuleConfig(id);
      this.newUnlocks.registerUnlock(`biolab.organs.${id}`, () => {
        if (this.getSkillLevel(MODULE_UNLOCK_SKILL_ID) <= 0) {
          return false;
        }
        if (isDemoBuild() && config.lockedForDemo) {
          return false;
        }
        return this.unlocks.areConditionsMet(config.unlockedBy);
      });
    });
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
    const payload: UnitModuleWorkshopBridgeState = {
      unlocked: this.unlocked,
      modules,
      hideMaxedWorkshop: this.hideMaxedWorkshop,
      showHiddenWorkshop: this.showHiddenWorkshop,
      hiddenModuleIds: this.hiddenModuleIds.size > 0 ? Array.from(this.hiddenModuleIds) : [],
    };
    DataBridgeHelpers.pushState(
      this.bridge,
      UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY,
      payload
    );
  }



  private parseSaveData(data: unknown): Map<UnitModuleId, number> {
    return parseLevelsMapFromSaveData(
      data,
      UNIT_MODULE_IDS,
      createDefaultLevels,
      (id, raw) => clampLevel(raw, getUnitModuleConfig(id))
    );
  }

  private parseHideMaxedWorkshop(data: unknown): boolean {
    if (data == null || typeof data !== "object" || !("hideMaxedWorkshop" in data)) return false;
    return (data as UnitModuleWorkshopSaveData).hideMaxedWorkshop === true;
  }

  private parseShowHiddenWorkshop(data: unknown): boolean {
    if (data == null || typeof data !== "object" || !("showHiddenWorkshop" in data)) return false;
    return (data as UnitModuleWorkshopSaveData).showHiddenWorkshop === true;
  }

  private parseHiddenModuleIds(data: unknown): Set<UnitModuleId> {
    if (data == null || typeof data !== "object" || !("hiddenModuleIds" in data)) return new Set();
    const raw = (data as UnitModuleWorkshopSaveData).hiddenModuleIds;
    if (!Array.isArray(raw)) return new Set();
    const set = new Set<UnitModuleId>();
    raw.forEach((id) => {
      if (UNIT_MODULE_IDS.includes(id)) set.add(id);
    });
    return set;
  }
}
