import { DataBridge } from "../../../core/DataBridge";
import { DataBridgeHelpers } from "../../../core/DataBridgeHelpers";
import { BaseGameModule } from "../../../core/BaseGameModule";
import {
  serializeLevelsMap,
  parseLevelsMapFromSaveData,
} from "../../../helpers/save-data.helper";
import { BonusesModule } from "../../shared/bonuses/bonuses.module";
import { ResourcesModule } from "../../shared/resources/resources.module";
import { UnlockService } from "../../../services/unlock/UnlockService";
import {
  BUILDING_IDS,
  BuildingId,
  getBuildingConfig,
} from "../../../../db/buildings-db";
import {
  createDefaultLevels,
  areBuildingListsEqual,
  getMaxLevel,
  sanitizeLevel,
} from "./buildings.helpers";
import {
  ResourceStockpile,
  RESOURCE_IDS,
  normalizeResourceAmount,
  createEmptyResourceStockpile,
} from "../../../../db/resources-db";
import { SkillId } from "../../../../db/skills-db";
import type {
  BuildingWorkshopItemState,
  BuildingsWorkshopBridgeState,
  BuildingsModuleOptions,
  BuildingsSaveData,
} from "./buildings.types";
import {
  DEFAULT_BUILDINGS_WORKSHOP_STATE,
  BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY,
  BUILDINGS_UNLOCK_SKILL_ID,
} from "./buildings.const";
import {
  BuildingStateFactory,
  BuildingStateInput,
} from "./buildings.state-factory";

export class BuildingsModule extends BaseGameModule<() => void> {
  public readonly id = "buildings";

  private readonly bridge: DataBridge;
  private readonly resources: ResourcesModule;
  private readonly bonuses: BonusesModule;
  private readonly unlocks: UnlockService;
  private readonly getSkillLevel: (id: SkillId) => number;

  private unlocked = false;
  private visibleBuildingIds: BuildingId[] = [];
  private levels: Map<BuildingId, number> = createDefaultLevels();
  private readonly stateFactory: BuildingStateFactory;

  constructor(options: BuildingsModuleOptions) {
    super();
    this.bridge = options.bridge;
    this.resources = options.resources;
    this.bonuses = options.bonuses;
    this.unlocks = options.unlocks;
    this.getSkillLevel = options.getSkillLevel;
    this.stateFactory = new BuildingStateFactory();
    this.registerBonusSources();
  }

  public initialize(): void {
    this.syncAllBonusLevels();
    this.refreshUnlockState();
    this.pushState();
    this.notifyListeners();
  }

  public reset(): void {
    this.levels = createDefaultLevels();
    this.syncAllBonusLevels();
    this.refreshUnlockState();
    this.pushState();
    this.notifyListeners();
  }

  public load(data: unknown | undefined): void {
    this.levels = this.parseSaveData(data);
    this.syncAllBonusLevels();
    this.refreshUnlockState();
    this.pushState();
    this.notifyListeners();
  }

  public save(): unknown {
    return { levels: serializeLevelsMap(this.levels) } satisfies BuildingsSaveData;
  }

  public tick(_deltaMs: number): void {
    if (this.refreshUnlockState()) {
      this.pushState();
      this.notifyListeners();
    }
  }

  public tryUpgradeBuilding(id: BuildingId): boolean {
    if (!this.unlocked) {
      return false;
    }
    if (!BUILDING_IDS.includes(id)) {
      return false;
    }
    if (!this.visibleBuildingIds.includes(id)) {
      return false;
    }
    const config = getBuildingConfig(id);
    const currentLevel = this.levels.get(id) ?? 0;
    const maxLevel = getMaxLevel(config);
    if (currentLevel >= maxLevel) {
      return false;
    }
    const available = this.unlocks.areConditionsMet(config.unlockedBy);
    if (!available) {
      return false;
    }
    const nextLevel = currentLevel + 1;
    const baseCost = normalizeResourceAmount(config.cost(nextLevel));
    const cost = this.applyCostModifiers(baseCost);
    if (!this.resources.spendResources(cost)) {
      return false;
    }
    this.levels.set(id, nextLevel);
    this.syncBonusLevel(id);
    this.pushState();
    this.notifyListeners();
    return true;
  }

  public getBuildingLevel(id: BuildingId): number {
    return this.levels.get(id) ?? 0;
  }

  private registerBonusSources(): void {
    BUILDING_IDS.forEach((id) => {
      const config = getBuildingConfig(id);
      this.bonuses.registerSource(this.getBonusSourceId(id), config.effects);
    });
  }

  private syncAllBonusLevels(): void {
    BUILDING_IDS.forEach((id) => this.syncBonusLevel(id));
  }

  private syncBonusLevel(id: BuildingId): void {
    const level = this.levels.get(id) ?? 0;
    this.bonuses.setBonusCurrentLevel(this.getBonusSourceId(id), level);
  }

  private refreshUnlockState(): boolean {
    const unlocked = this.getSkillLevel(BUILDINGS_UNLOCK_SKILL_ID) > 0;
    const visibleSet = new Set<BuildingId>();
    if (unlocked) {
      BUILDING_IDS.forEach((id) => {
        const config = getBuildingConfig(id);
        if (this.unlocks.areConditionsMet(config.unlockedBy)) {
          visibleSet.add(id);
        }
      });
      this.levels.forEach((level, id) => {
        if (level > 0) {
          visibleSet.add(id);
        }
      });
    }
    const orderedVisible = unlocked
      ? BUILDING_IDS.filter((id) => visibleSet.has(id))
      : [];
    const changed =
      unlocked !== this.unlocked ||
      !areBuildingListsEqual(this.visibleBuildingIds, orderedVisible);
    this.unlocked = unlocked;
    if (changed) {
      this.visibleBuildingIds = orderedVisible;
    }
    return changed;
  }

  private pushState(): void {
    const inputs: BuildingStateInput[] = this.visibleBuildingIds.map((id) => ({
      id,
      level: this.levels.get(id) ?? 0,
      unlocks: this.unlocks,
      bonuses: this.bonuses,
      getBonusSourceId: (buildingId) => this.getBonusSourceId(buildingId),
      cloneCost: (source) => this.cloneCost(source),
      applyCostModifiers: (source) => this.applyCostModifiers(source),
    }));
    const buildings = this.stateFactory.createMany(inputs);
    const payload: BuildingsWorkshopBridgeState = {
      unlocked: this.unlocked,
      buildings,
    };
    DataBridgeHelpers.pushState(this.bridge, BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY, payload);
  }


  private parseSaveData(data: unknown | undefined): Map<BuildingId, number> {
    return parseLevelsMapFromSaveData(
      data,
      BUILDING_IDS,
      createDefaultLevels,
      (id, raw) => sanitizeLevel(raw, getBuildingConfig(id))
    );
  }

  private cloneCost(source: ResourceStockpile): Record<string, number> {
    const clone: Record<string, number> = {};
    RESOURCE_IDS.forEach((id) => {
      const value = source[id];
      if (value > 0) {
        clone[id] = value;
      }
    });
    return clone;
  }

  private getBuildingCostMultiplier(): number {
    const raw = this.bonuses.getBonusValue("building_cost_multiplier");
    if (!Number.isFinite(raw) || raw <= 0) {
      return 1;
    }
    return raw;
  }

  private applyCostModifiers(source: ResourceStockpile): ResourceStockpile {
    const multiplier = this.getBuildingCostMultiplier();
    if (Math.abs(multiplier - 1) < 1e-9) {
      return source;
    }
    const adjusted: ResourceStockpile = createEmptyResourceStockpile();
    RESOURCE_IDS.forEach((id) => {
      const value = source[id];
      if (value && value > 0) {
        const scaled = Math.ceil(value * multiplier);
        if (scaled > 0) {
          adjusted[id] = scaled;
        }
      }
    });
    return adjusted;
  }

  private getBonusSourceId(id: BuildingId): string {
    return `building_${id}`;
  }
}
