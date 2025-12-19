import { DataBridge } from "../../core/DataBridge";
import { GameModule } from "../../core/types";
import {
  SKILL_IDS,
  SkillConfig,
  SkillId,
  SkillNodePosition,
  getSkillConfig,
} from "../../../db/skills-db";
import { BonusEffectPreview } from "../../../types/bonuses";
import {
  RESOURCE_IDS,
  ResourceStockpile,
  createEmptyResourceStockpile,
  normalizeResourceAmount,
} from "../../../db/resources-db";
import { ResourcesModule } from "../shared/ResourcesModule";
import { BonusesModule } from "../shared/BonusesModule";

export const SKILL_TREE_STATE_BRIDGE_KEY = "skills/tree";

export interface SkillNodeRequirementPayload {
  id: SkillId;
  requiredLevel: number;
  currentLevel: number;
}

export interface SkillNodeBridgePayload {
  id: SkillId;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  position: SkillNodePosition;
  requirements: SkillNodeRequirementPayload[];
  unlocked: boolean;
  maxed: boolean;
  nextCost: ResourceStockpile | null;
  bonusEffects: BonusEffectPreview[];
}

export interface SkillTreeBridgePayload {
  nodes: SkillNodeBridgePayload[];
}

export const DEFAULT_SKILL_TREE_STATE: SkillTreeBridgePayload = Object.freeze({
  nodes: [],
});

interface SkillTreeModuleOptions {
  bridge: DataBridge;
  resources: ResourcesModule;
  bonuses: BonusesModule;
}

interface SkillTreeSaveData {
  levels: Partial<Record<SkillId, number>>;
}

type SkillLevelMap = Record<SkillId, number>;

const createDefaultLevels = (): SkillLevelMap => {
  const levels = {} as SkillLevelMap;
  SKILL_IDS.forEach((id) => {
    levels[id] = 0;
  });
  return levels;
};

const clampLevel = (value: number, config: SkillConfig): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const sanitized = Math.floor(Math.max(value, 0));
  return Math.min(sanitized, config.maxLevel);
};

export class SkillTreeModule implements GameModule {
  public readonly id = "skillTree";

  private readonly bridge: DataBridge;
  private readonly resources: ResourcesModule;
  private readonly bonuses: BonusesModule;
  private levels: SkillLevelMap = createDefaultLevels();
  private unsubscribeBonuses: (() => void) | null = null;

  constructor(options: SkillTreeModuleOptions) {
    this.bridge = options.bridge;
    this.resources = options.resources;
    this.bonuses = options.bonuses;
    this.registerBonusSources();
    this.syncAllBonusLevels();
    this.unsubscribeBonuses = this.bonuses.subscribe(() => {
      this.pushState();
    });
  }

  public initialize(): void {
    this.syncAllBonusLevels();
    this.pushState();
  }

  public reset(): void {
    this.levels = createDefaultLevels();
    this.syncAllBonusLevels();
    this.pushState();
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    if (parsed) {
      this.levels = parsed;
    }
    this.syncAllBonusLevels();
    this.pushState();
  }

  public save(): unknown {
    return {
      levels: { ...this.levels },
    } satisfies SkillTreeSaveData;
  }

  public tick(_deltaMs: number): void {
    // Skill upgrades do not require periodic updates yet.
  }

  public tryPurchaseSkill(id: SkillId): boolean {
    const config = getSkillConfig(id);
    const currentLevel = this.levels[id] ?? 0;

    if (currentLevel >= config.maxLevel) {
      return false;
    }
    if (!this.areRequirementsMet(config)) {
      return false;
    }

    const targetLevel = currentLevel + 1;
    const cost = normalizeResourceAmount(config.cost(targetLevel));
    if (!this.resources.spendResources(cost)) {
      return false;
    }

    this.levels[id] = targetLevel;
    this.syncBonusLevel(id);
    this.pushState();
    return true;
  }

  public getLevel(id: SkillId): number {
    return this.levels[id] ?? 0;
  }

  private areRequirementsMet(config: SkillConfig): boolean {
    return Object.entries(config.nodesRequired).every(([requiredId, level]) => {
      const id = requiredId as SkillId;
      return (this.levels[id] ?? 0) >= (level ?? 0);
    });
  }

  private pushState(): void {
    const payload: SkillTreeBridgePayload = {
      nodes: SKILL_IDS.map((id) => this.createNodePayload(id)),
    };
    this.bridge.setValue(SKILL_TREE_STATE_BRIDGE_KEY, payload);
  }

  private createNodePayload(id: SkillId): SkillNodeBridgePayload {
    const config = getSkillConfig(id);
    const level = this.levels[id] ?? 0;
    const unlocked = this.areRequirementsMet(config);
    const nextLevel = level + 1;
    const nextCost =
      unlocked && nextLevel <= config.maxLevel
        ? this.cloneCost(normalizeResourceAmount(config.cost(nextLevel)))
        : null;

    return {
      id,
      name: config.name,
      description: config.description,
      level,
      maxLevel: config.maxLevel,
      position: config.nodePosition,
      requirements: this.createRequirementPayloads(config),
      unlocked,
      maxed: level >= config.maxLevel,
      nextCost,
      bonusEffects: this.bonuses.getBonusEffects(this.getBonusSourceId(id)),
    };
  }

  private createRequirementPayloads(config: SkillConfig): SkillNodeRequirementPayload[] {
    return Object.entries(config.nodesRequired).map(([requiredId, requiredLevel]) => {
      const id = requiredId as SkillId;
      return {
        id,
        requiredLevel: requiredLevel ?? 0,
        currentLevel: this.levels[id] ?? 0,
      };
    });
  }

  private cloneCost(source: ResourceStockpile): ResourceStockpile {
    const clone = createEmptyResourceStockpile();
    RESOURCE_IDS.forEach((id) => {
      clone[id] = source[id];
    });
    return clone;
  }

  private parseSaveData(data: unknown): SkillLevelMap | null {
    if (!data || typeof data !== "object" || !("levels" in data)) {
      return null;
    }

    const { levels } = data as SkillTreeSaveData;
    const next = createDefaultLevels();
    SKILL_IDS.forEach((id) => {
      const config = getSkillConfig(id);
      const raw = levels?.[id];
      if (typeof raw === "number") {
        next[id] = clampLevel(raw, config);
      }
    });
    return next;
  }

  private registerBonusSources(): void {
    SKILL_IDS.forEach((id) => {
      const config = getSkillConfig(id);
      const sourceId = this.getBonusSourceId(id);
      this.bonuses.registerSource(sourceId, config.effects);
    });
  }

  private syncAllBonusLevels(): void {
    SKILL_IDS.forEach((id) => this.syncBonusLevel(id));
  }

  private syncBonusLevel(id: SkillId): void {
    const sourceId = this.getBonusSourceId(id);
    const level = this.levels[id] ?? 0;
    this.bonuses.setBonusCurrentLevel(sourceId, level);
  }

  private getBonusSourceId(id: SkillId): string {
    return `skill_${id}`;
  }
}
