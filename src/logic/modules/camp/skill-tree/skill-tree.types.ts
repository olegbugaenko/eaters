import type { DataBridge } from "@/core/logic/ui/DataBridge";
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
  viewTransform?: { scale: number; worldX: number; worldY: number };
}

export type SkillLevelMap = Record<SkillId, number>;

export interface SkillTreeModuleUiApi {
  setViewTransform(transform: { scale: number; worldX: number; worldY: number } | null): void;
  tryPurchaseSkill(id: SkillId): boolean;
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    skillTree: SkillTreeModuleUiApi;
  }
}
