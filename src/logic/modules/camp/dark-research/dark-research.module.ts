import type { GameModule } from "@/core/logic/types";
import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import {
  DARK_RESEARCH_IDS,
  getDarkResearchConfig,
  type DarkResearchId,
} from "@/db/dark-research-db";
import {
  DARK_RESEARCH_STATE_BRIDGE_KEY,
  DARK_RESEARCH_UNLOCK_SKILL_ID,
  DEFAULT_DARK_RESEARCH_STATE,
} from "./dark-research.const";
import {
  calculateMaxXpForLevel,
  sanitizeLevel,
  sanitizeNonNegativeNumber,
  XP_PER_SECOND_DEFAULT,
} from "./dark-research.helpers";
import type {
  DarkResearchBridgeState,
  DarkResearchItemBridgeState,
  DarkResearchModuleOptions,
  DarkResearchRuntimeState,
  DarkResearchSaveData,
} from "./dark-research.types";

export class DarkResearchModule implements GameModule {
  public readonly id = "darkResearch";

  private readonly bridge: DarkResearchModuleOptions["bridge"];
  private readonly bonuses: DarkResearchModuleOptions["bonuses"];
  private readonly newUnlocks: DarkResearchModuleOptions["newUnlocks"];
  private readonly getSkillLevel: DarkResearchModuleOptions["getSkillLevel"];

  private readonly states = new Map<DarkResearchId, DarkResearchRuntimeState>();
  private unlocked = false;
  private hasRegisteredUnlocks = false;

  constructor(options: DarkResearchModuleOptions) {
    this.bridge = options.bridge;
    this.bonuses = options.bonuses;
    this.newUnlocks = options.newUnlocks;
    this.getSkillLevel = options.getSkillLevel;

    DARK_RESEARCH_IDS.forEach((id) => {
      this.states.set(id, { level: 0, xp: 0 });
      this.bonuses.registerSource(this.getBonusSourceId(id), getDarkResearchConfig(id).effects);
    });
  }

  public initialize(): void {
    this.registerUnlockNotifications();
    this.syncAllBonusLevels();
    this.refreshUnlocked();
    this.newUnlocks.invalidate("darkResearch");
    this.pushState();
  }

  public reset(): void {
    DARK_RESEARCH_IDS.forEach((id) => {
      const state = this.getRuntimeState(id);
      state.level = 0;
      state.xp = 0;
    });
    this.syncAllBonusLevels();
    this.refreshUnlocked();
    this.newUnlocks.invalidate("darkResearch");
    this.pushState();
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    DARK_RESEARCH_IDS.forEach((id) => {
      const state = this.getRuntimeState(id);
      const saved = parsed.researches?.[id];
      state.level = sanitizeLevel(saved?.level);
      state.xp = sanitizeNonNegativeNumber(saved?.xp, 0);
    });
    this.syncAllBonusLevels();
    this.refreshUnlocked();
    this.newUnlocks.invalidate("darkResearch");
    this.pushState();
  }

  public save(): unknown {
    const researches: Partial<DarkResearchSaveData["researches"]> = {};
    DARK_RESEARCH_IDS.forEach((id) => {
      const state = this.getRuntimeState(id);
      if (state.level <= 0 && state.xp <= 0) {
        return;
      }
      researches[id] = {
        level: state.level > 0 ? state.level : undefined,
        xp: state.xp > 0 ? state.xp : undefined,
      };
    });

    if (Object.keys(researches).length === 0) {
      return {} satisfies DarkResearchSaveData;
    }

    return { researches } satisfies DarkResearchSaveData;
  }

  public tick(deltaMs: number): void {
    const unlockedChanged = this.refreshUnlocked();
    if (!this.unlocked) {
      if (unlockedChanged) {
        this.newUnlocks.invalidate("darkResearch");
        this.pushState();
      }
      return;
    }

    const clampedDeltaMs = Math.max(0, deltaMs);
    const xpGain = (clampedDeltaMs / 1000) * XP_PER_SECOND_DEFAULT;
    let changed = unlockedChanged;

    if (xpGain > 0) {
      DARK_RESEARCH_IDS.forEach((id) => {
        const state = this.getRuntimeState(id);
        state.xp += xpGain;

        const config = getDarkResearchConfig(id);
        let maxXp = calculateMaxXpForLevel(config, state.level);
        while (state.xp >= maxXp) {
          state.xp -= maxXp;
          state.level += 1;
          this.syncBonusLevel(id);
          maxXp = calculateMaxXpForLevel(config, state.level);
          changed = true;
        }
        changed = true;
      });
    }

    if (!changed) {
      return;
    }

    this.newUnlocks.invalidate("darkResearch");
    this.pushState();
  }

  private registerUnlockNotifications(): void {
    if (this.hasRegisteredUnlocks) {
      return;
    }
    this.hasRegisteredUnlocks = true;

    this.newUnlocks.registerUnlock("darkResearch", () => this.getIsMechanicUnlocked());
    DARK_RESEARCH_IDS.forEach((id) => {
      this.newUnlocks.registerUnlock(`darkResearch.${id}`, () => this.getIsMechanicUnlocked());
    });
  }

  private syncAllBonusLevels(): void {
    DARK_RESEARCH_IDS.forEach((id) => this.syncBonusLevel(id));
  }

  private syncBonusLevel(id: DarkResearchId): void {
    const state = this.getRuntimeState(id);
    this.bonuses.setBonusCurrentLevel(this.getBonusSourceId(id), state.level);
  }

  private getBonusSourceId(id: DarkResearchId): string {
    return `dark_research_${id}`;
  }

  private getRuntimeState(id: DarkResearchId): DarkResearchRuntimeState {
    const state = this.states.get(id);
    if (!state) {
      throw new Error(`Unknown dark research runtime state for id ${id}`);
    }
    return state;
  }

  private getIsMechanicUnlocked(): boolean {
    return this.getSkillLevel(DARK_RESEARCH_UNLOCK_SKILL_ID) > 0;
  }

  private refreshUnlocked(): boolean {
    const next = this.getIsMechanicUnlocked();
    if (next === this.unlocked) {
      return false;
    }
    this.unlocked = next;
    return true;
  }

  private parseSaveData(data: unknown): DarkResearchSaveData {
    if (!data || typeof data !== "object") {
      return {};
    }
    return data as DarkResearchSaveData;
  }

  private buildResearchState(id: DarkResearchId): DarkResearchItemBridgeState {
    const config = getDarkResearchConfig(id);
    const runtime = this.getRuntimeState(id);
    return {
      id,
      name: config.name,
      description: config.description,
      icon: config.icon,
      level: runtime.level,
      xp: runtime.xp,
      maxXp: calculateMaxXpForLevel(config, runtime.level),
      xpPerSecond: XP_PER_SECOND_DEFAULT,
      bonusEffects: this.bonuses.getBonusEffects(this.getBonusSourceId(id)),
    };
  }

  private pushState(): void {
    if (!this.unlocked) {
      DataBridgeHelpers.pushState(this.bridge, DARK_RESEARCH_STATE_BRIDGE_KEY, DEFAULT_DARK_RESEARCH_STATE);
      return;
    }

    const payload: DarkResearchBridgeState = {
      unlocked: true,
      researches: DARK_RESEARCH_IDS.map((id) => this.buildResearchState(id)),
    };
    DataBridgeHelpers.pushState(this.bridge, DARK_RESEARCH_STATE_BRIDGE_KEY, payload);
  }
}
