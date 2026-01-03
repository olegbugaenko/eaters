import { GameModule } from "../../../core/types";
import type { DataBridge } from "../../../core/DataBridge";
import { DataBridgeHelpers } from "../../../core/DataBridgeHelpers";
import { parseLevelsRecordFromSaveData } from "../../../helpers/save-data.helper";
import {
  SKILL_IDS,
  SkillConfig,
  SkillId,
  getSkillConfig,
} from "../../../../db/skills-db";
import {
  normalizeResourceAmount,
  cloneResourceStockpile,
} from "../../../../db/resources-db";
import { BonusesModule } from "../../shared/bonuses/bonuses.module";
import { ResourcesModule } from "../../shared/resources/resources.module";
import type {
  SkillNodeRequirementPayload,
  SkillNodeBridgePayload,
  SkillTreeBridgePayload,
  SkillTreeModuleOptions,
  SkillTreeSaveData,
  SkillLevelMap,
} from "./skill-tree.types";
import {
  SKILL_TREE_STATE_BRIDGE_KEY,
  DEFAULT_SKILL_TREE_STATE,
} from "./skill-tree.const";
import {
  createDefaultLevels,
  clampLevel,
} from "./skill-tree.helpers";

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
    DataBridgeHelpers.pushState(this.bridge, SKILL_TREE_STATE_BRIDGE_KEY, payload);
  }

  private createNodePayload(id: SkillId): SkillNodeBridgePayload {
    const config = getSkillConfig(id);
    const level = this.levels[id] ?? 0;
    const unlocked = this.areRequirementsMet(config);
    const nextLevel = level + 1;
    const nextCost =
      unlocked && nextLevel <= config.maxLevel
        ? cloneResourceStockpile(normalizeResourceAmount(config.cost(nextLevel)))
        : null;

    return {
      id,
      name: config.name,
      description: config.description,
      icon: config.icon,
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


  private parseSaveData(data: unknown): SkillLevelMap | null {
    return parseLevelsRecordFromSaveData(
      data,
      SKILL_IDS,
      createDefaultLevels,
      (id, raw) =>
        typeof raw === "number" ? clampLevel(raw, getSkillConfig(id)) : 0
    );
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
