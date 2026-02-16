import type { BonusEffectPreview } from "@shared/types/bonuses";
import type { DataBridge } from "@/core/logic/ui/DataBridge";
import type { SkillId } from "@/db/skills-db";
import type { DarkResearchId } from "@/db/dark-research-db";
import type { BonusesModule } from "@logic/modules/shared/bonuses/bonuses.module";
import type { NewUnlockNotificationService } from "@logic/services/new-unlock-notification/NewUnlockNotification";

export interface DarkResearchItemBridgeState {
  readonly id: DarkResearchId;
  readonly name: string;
  readonly description: string;
  readonly icon?: string;
  readonly level: number;
  readonly xp: number;
  readonly maxXp: number;
  readonly xpPerSecond: number;
  readonly bonusEffects: BonusEffectPreview[];
}

export interface DarkResearchBridgeState {
  readonly unlocked: boolean;
  readonly researches: DarkResearchItemBridgeState[];
}

export interface DarkResearchSaveState {
  readonly level?: number;
  readonly xp?: number;
}

export interface DarkResearchSaveData {
  readonly researches?: Partial<Record<DarkResearchId, DarkResearchSaveState>>;
}

export interface DarkResearchRuntimeState {
  level: number;
  xp: number;
}

export interface DarkResearchModuleOptions {
  readonly bridge: DataBridge;
  readonly bonuses: BonusesModule;
  readonly newUnlocks: NewUnlockNotificationService;
  readonly getSkillLevel: (id: SkillId) => number;
}

export interface DarkResearchModuleUiApi {
  // Placeholder for future queue/priority controls.
}

declare module "@/core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    darkResearch: DarkResearchModuleUiApi;
  }
}
