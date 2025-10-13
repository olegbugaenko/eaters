import { DataBridge } from "../core/DataBridge";
import { GameModule } from "../core/types";
import { BonusesModule } from "./BonusesModule";
import { ResourcesModule } from "./ResourcesModule";
import { UnlockService } from "../services/UnlockService";
import {
  BUILDING_IDS,
  BuildingId,
  getBuildingConfig,
  BuildingConfig,
} from "../../db/buildings-db";
import {
  ResourceStockpile,
  RESOURCE_IDS,
  normalizeResourceAmount,
} from "../../db/resources-db";
import { BonusEffectPreview } from "../../types/bonuses";
import { SkillId } from "../../db/skills-db";

export interface BuildingWorkshopItemState {
  readonly id: BuildingId;
  readonly name: string;
  readonly description: string;
  readonly level: number;
  readonly maxLevel: number | null;
  readonly maxed: boolean;
  readonly available: boolean;
  readonly nextCost: Record<string, number> | null;
  readonly bonusEffects: readonly BonusEffectPreview[];
}

export interface BuildingsWorkshopBridgeState {
  readonly unlocked: boolean;
  readonly buildings: readonly BuildingWorkshopItemState[];
}

export const DEFAULT_BUILDINGS_WORKSHOP_STATE: BuildingsWorkshopBridgeState = Object.freeze({
  unlocked: false,
  buildings: [],
});

export const BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY = "buildings/workshop";

interface BuildingsModuleOptions {
  readonly bridge: DataBridge;
  readonly resources: ResourcesModule;
  readonly bonuses: BonusesModule;
  readonly unlocks: UnlockService;
  readonly getSkillLevel: (id: SkillId) => number;
}

interface BuildingsSaveData {
  readonly levels?: Partial<Record<BuildingId, number>>;
}

const BUILDINGS_UNLOCK_SKILL_ID: SkillId = "construction_guild";

export class BuildingsModule implements GameModule {
  public readonly id = "buildings";

  private readonly bridge: DataBridge;
  private readonly resources: ResourcesModule;
  private readonly bonuses: BonusesModule;
  private readonly unlocks: UnlockService;
  private readonly getSkillLevel: (id: SkillId) => number;

  private unlocked = false;
  private visibleBuildingIds: BuildingId[] = [];
  private levels: Map<BuildingId, number> = createDefaultLevels();
  private listeners = new Set<() => void>();

  constructor(options: BuildingsModuleOptions) {
    this.bridge = options.bridge;
    this.resources = options.resources;
    this.bonuses = options.bonuses;
    this.unlocks = options.unlocks;
    this.getSkillLevel = options.getSkillLevel;
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
    const serialized: Partial<Record<BuildingId, number>> = {};
    this.levels.forEach((level, id) => {
      if (level > 0) {
        serialized[id] = level;
      }
    });
    return { levels: serialized } satisfies BuildingsSaveData;
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
    const cost = normalizeResourceAmount(config.cost(nextLevel));
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

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
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
    const payload: BuildingsWorkshopBridgeState = {
      unlocked: this.unlocked,
      buildings: this.visibleBuildingIds.map((id) => this.createBuildingState(id)),
    };
    this.bridge.setValue(BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY, payload);
  }

  private createBuildingState(id: BuildingId): BuildingWorkshopItemState {
    const config = getBuildingConfig(id);
    const level = this.levels.get(id) ?? 0;
    const maxLevelLimit = getMaxLevel(config);
    const maxLevel = config.maxLevel ?? null;
    const available = this.unlocks.areConditionsMet(config.unlockedBy);
    const maxed = level >= maxLevelLimit;
    const canUpgrade = available && !maxed;
    const nextCost = canUpgrade
      ? this.cloneCost(normalizeResourceAmount(config.cost(level + 1)))
      : null;
    let bonusEffects = this.bonuses.getBonusEffects(this.getBonusSourceId(id));
    if (maxed) {
      bonusEffects = bonusEffects.map((effect) => ({
        ...effect,
        nextValue: effect.currentValue,
      }));
    }
    return {
      id,
      name: config.name,
      description: config.description,
      level,
      maxLevel,
      maxed,
      available,
      nextCost,
      bonusEffects,
    };
  }

  private parseSaveData(data: unknown | undefined): Map<BuildingId, number> {
    const levels = createDefaultLevels();
    if (!data || typeof data !== "object" || !("levels" in data)) {
      return levels;
    }
    const { levels: serialized } = data as BuildingsSaveData;
    BUILDING_IDS.forEach((id) => {
      const config = getBuildingConfig(id);
      const raw = serialized?.[id];
      levels.set(id, sanitizeLevel(raw, config));
    });
    return levels;
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

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("BuildingsModule listener error", error);
      }
    });
  }

  private getBonusSourceId(id: BuildingId): string {
    return `building_${id}`;
  }
}

const createDefaultLevels = (): Map<BuildingId, number> => {
  const levels = new Map<BuildingId, number>();
  BUILDING_IDS.forEach((id) => {
    levels.set(id, 0);
  });
  return levels;
};

const areBuildingListsEqual = (
  a: readonly BuildingId[],
  b: readonly BuildingId[]
): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
};

const getMaxLevel = (config: BuildingConfig): number => {
  if (config.maxLevel === undefined || config.maxLevel === null) {
    return Number.POSITIVE_INFINITY;
  }
  if (!Number.isFinite(config.maxLevel)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.floor(config.maxLevel));
};

const sanitizeLevel = (value: unknown, config: BuildingConfig): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  const normalized = Math.max(0, Math.floor(value));
  const maxLevel = getMaxLevel(config);
  return Math.min(normalized, maxLevel);
};
