import { GameModule } from "@core/logic/types";
import type { DataBridge } from "@/core/logic/ui/DataBridge";
import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import { parseLevelsRecordFromSaveData } from "../../../helpers/save-data.helper";
import { getAssetUrl } from "@shared/helpers/assets.helper";
import {
  SKILL_IDS,
  SkillConfig,
  SkillId,
  getSkillConfig,
} from "../../../../db/skills-db";
import {
  normalizeResourceAmount,
  cloneResourceStockpile,
  createEmptyResourceStockpile,
  RESOURCE_IDS,
} from "../../../../db/resources-db";
import { BonusesModule } from "../../shared/bonuses/bonuses.module";
import { ResourcesModule } from "../../shared/resources/resources.module";
import { EventLogModule } from "../../shared/event-log/event-log.module";
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
  SKILL_TREE_VIEW_TRANSFORM_BRIDGE_KEY,
} from "./skill-tree.const";
import { RESOURCE_TOTALS_BRIDGE_KEY } from "../../shared/resources/resources.module";
import {
  createDefaultLevels,
  clampLevel,
} from "./skill-tree.helpers";

export class SkillTreeModule implements GameModule {
  public readonly id = "skillTree";

  private readonly bridge: DataBridge;
  private readonly resources: ResourcesModule;
  private readonly bonuses: BonusesModule;
  private readonly eventLog: EventLogModule;
  private readonly audio?: SkillTreeModuleOptions["audio"];
  private levels: SkillLevelMap = createDefaultLevels();
  private viewTransform: { scale: number; worldX: number; worldY: number } | null = null;
  private unsubscribeBonuses: (() => void) | null = null;
  private nodePayloadCache = new Map<SkillId, SkillNodeBridgePayload>();

  constructor(options: SkillTreeModuleOptions) {
    this.bridge = options.bridge;
    this.resources = options.resources;
    this.bonuses = options.bonuses;
    this.eventLog = options.eventLog;
    this.audio = options.audio;
    DataBridgeHelpers.registerComparator(
      this.bridge,
      SKILL_TREE_STATE_BRIDGE_KEY,
      (previous, next) => {
        if (!previous) {
          return false;
        }
        if (previous.nodes.length !== next.nodes.length) {
          return false;
        }
        return previous.nodes.every((node, index) => node === next.nodes[index]);
      }
    );
    DataBridgeHelpers.registerComparator(
      this.bridge,
      SKILL_TREE_VIEW_TRANSFORM_BRIDGE_KEY,
      (previous, next) => {
        if (!previous && !next) {
          return true;
        }
        if (!previous || !next) {
          return false;
        }
        return (
          previous.scale === next.scale &&
          previous.worldX === next.worldX &&
          previous.worldY === next.worldY
        );
      }
    );
    this.registerBonusSources();
    this.syncAllBonusLevels();
    this.unsubscribeBonuses = this.bonuses.subscribe(() => {
      this.pushState();
    });
    this.bridge.subscribe(RESOURCE_TOTALS_BRIDGE_KEY, () => {
      this.pushState();
    });
  }

  public initialize(): void {
    this.syncAllBonusLevels();
    this.pushState();
    this.pushViewTransform();
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
    const saveData = this.parseFullSaveData(data);
    this.viewTransform = saveData?.viewTransform ?? null;
    this.syncAllBonusLevels();
    this.pushState();
    this.pushViewTransform();
  }

  public save(): unknown {
    return {
      levels: { ...this.levels },
      viewTransform: this.viewTransform ?? undefined,
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
    this.audio?.playSoundEffect(getAssetUrl("audio/sounds/ui/purchase_v0.mp3"));
    if (config.registerEvent) {
      this.eventLog.registerEvent(
        "skill-obtained",
        `Skill ${config.name} obtained: ${config.registerEvent.text}`
      );
    }
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
    const totals = this.resources.getTotals();
    const payload: SkillTreeBridgePayload = {
      nodes: SKILL_IDS.map((id) => this.getNodePayload(id, totals)),
    };
    DataBridgeHelpers.pushState(this.bridge, SKILL_TREE_STATE_BRIDGE_KEY, payload);
  }

  private getNodePayload(
    id: SkillId,
    totals: ReturnType<ResourcesModule["getTotals"]>
  ): SkillNodeBridgePayload {
    const next = this.createNodePayload(id, totals);
    const previous = this.nodePayloadCache.get(id);
    if (previous && this.isNodePayloadEqual(previous, next)) {
      return previous;
    }
    this.nodePayloadCache.set(id, next);
    return next;
  }

  private createNodePayload(
    id: SkillId,
    totals: ReturnType<ResourcesModule["getTotals"]>
  ): SkillNodeBridgePayload {
    const config = getSkillConfig(id);
    const level = this.levels[id] ?? 0;
    const maxed = level >= config.maxLevel;
    const unlocked = this.areRequirementsMet(config);
    const nextLevel = level + 1;
    const nextCost =
      unlocked && nextLevel <= config.maxLevel
        ? cloneResourceStockpile(normalizeResourceAmount(config.cost(nextLevel)))
        : null;
    const affordable = nextCost ? this.resources.canAfford(nextCost) : false;
    const purchasable = unlocked && !maxed && affordable;
    const missingResources = createEmptyResourceStockpile();
    if (nextCost) {
      RESOURCE_IDS.forEach((resourceId) => {
        const required = nextCost[resourceId] ?? 0;
        const available = totals[resourceId] ?? 0;
        missingResources[resourceId] = Math.max(required - available, 0);
      });
    }

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
      maxed,
      affordable,
      purchasable,
      missingResources,
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

  private isNodePayloadEqual(
    previous: SkillNodeBridgePayload,
    next: SkillNodeBridgePayload
  ): boolean {
    if (previous === next) {
      return true;
    }
    if (
      previous.id !== next.id ||
      previous.name !== next.name ||
      previous.description !== next.description ||
      previous.icon !== next.icon ||
      previous.level !== next.level ||
      previous.maxLevel !== next.maxLevel ||
      previous.unlocked !== next.unlocked ||
      previous.maxed !== next.maxed ||
      previous.affordable !== next.affordable ||
      previous.purchasable !== next.purchasable ||
      previous.position.x !== next.position.x ||
      previous.position.y !== next.position.y
    ) {
      return false;
    }
    if (!this.areRequirementsEqual(previous.requirements, next.requirements)) {
      return false;
    }
    if (!this.areCostsEqual(previous.nextCost, next.nextCost)) {
      return false;
    }
    if (!this.areCostsEqual(previous.missingResources, next.missingResources)) {
      return false;
    }
    return this.areBonusEffectsEqual(previous.bonusEffects, next.bonusEffects);
  }

  private areRequirementsEqual(
    previous: SkillNodeRequirementPayload[],
    next: SkillNodeRequirementPayload[]
  ): boolean {
    if (previous.length !== next.length) {
      return false;
    }
    return previous.every((item, index) => {
      const nextItem = next[index];
      if (!nextItem) {
        return false;
      }
      return (
        item.id === nextItem.id &&
        item.requiredLevel === nextItem.requiredLevel &&
        item.currentLevel === nextItem.currentLevel
      );
    });
  }

  private areCostsEqual(
    previous: SkillNodeBridgePayload["nextCost"],
    next: SkillNodeBridgePayload["nextCost"]
  ): boolean {
    if (!previous || !next) {
      return previous === next;
    }
    return RESOURCE_IDS.every((id) => (previous[id] ?? 0) === (next[id] ?? 0));
  }

  private areBonusEffectsEqual(
    previous: SkillNodeBridgePayload["bonusEffects"],
    next: SkillNodeBridgePayload["bonusEffects"]
  ): boolean {
    if (previous.length !== next.length) {
      return false;
    }
    return previous.every((item, index) => {
      const nextItem = next[index];
      if (!nextItem) {
        return false;
      }
      return (
        item.bonusId === nextItem.bonusId &&
        item.bonusName === nextItem.bonusName &&
        item.effectType === nextItem.effectType &&
        item.currentValue === nextItem.currentValue &&
        item.nextValue === nextItem.nextValue
      );
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

  private parseFullSaveData(data: unknown): SkillTreeSaveData | undefined {
    if (typeof data !== "object" || data === null) {
      return undefined;
    }
    const raw = data as { levels?: unknown; viewTransform?: unknown };
    const levels = this.parseSaveData(data);
    const viewTransform = this.parseViewTransform(raw.viewTransform);
    return { levels: levels ?? {}, viewTransform };
  }

  private parseViewTransform(data: unknown): { scale: number; worldX: number; worldY: number } | undefined {
    if (typeof data !== "object" || data === null) {
      return undefined;
    }
    const raw = data as { scale?: unknown; worldX?: unknown; worldY?: unknown };
    if (
      typeof raw.scale === "number" &&
      typeof raw.worldX === "number" &&
      typeof raw.worldY === "number"
    ) {
      return { scale: raw.scale, worldX: raw.worldX, worldY: raw.worldY };
    }
    return undefined;
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

  private pushViewTransform(): void {
    DataBridgeHelpers.pushState(
      this.bridge,
      SKILL_TREE_VIEW_TRANSFORM_BRIDGE_KEY,
      this.viewTransform
    );
  }

  public setViewTransform(transform: { scale: number; worldX: number; worldY: number } | null): void {
    this.viewTransform = transform;
    this.pushViewTransform();
  }
}
