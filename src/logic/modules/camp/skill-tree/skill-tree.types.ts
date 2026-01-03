import type { DataBridge } from "../../../core/DataBridge";
import type { SkillId, SkillConfig, SkillNodePosition } from "../../../../db/skills-db";
import type { ResourceStockpile } from "../../../../db/resources-db";
import type { BonusEffectPreview } from "@shared/types/bonuses";
import type { ResourcesModule } from "../../shared/resources/resources.module";
import type { BonusesModule } from "../../shared/bonuses/bonuses.module";

export interface SkillNodeRequirementPayload {
  id: SkillId;
  requiredLevel: number;
  currentLevel: number;
}

export interface SkillNodeBridgePayload {
  id: SkillId;
  name: string;
  description: string;
  icon?: string;
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

export interface SkillTreeModuleOptions {
  bridge: DataBridge;
  resources: ResourcesModule;
  bonuses: BonusesModule;
}

export interface SkillTreeSaveData {
  levels: Partial<Record<SkillId, number>>;
}

export type SkillLevelMap = Record<SkillId, number>;
