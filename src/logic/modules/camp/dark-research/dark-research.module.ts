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
} from "./dark-research.helpers";
import type {
  DarkResearchBridgeState,
  DarkResearchItemBridgeState,
  DarkResearchModuleOptions,
  DarkResearchRuntimeState,
  DarkResearchSaveData,
  DarkResearchModuleUiApi,
} from "./dark-research.types";

const BASE_SOUL_DROP_CHANCE = 0.1;
const SOUL_XP_PER_SECOND = 1;

export class DarkResearchModule implements GameModule, DarkResearchModuleUiApi {
  public readonly id = "darkResearch";

  private readonly bridge: DarkResearchModuleOptions["bridge"];
  private readonly bonuses: DarkResearchModuleOptions["bonuses"];
  private readonly newUnlocks: DarkResearchModuleOptions["newUnlocks"];
  private readonly getSkillLevel: DarkResearchModuleOptions["getSkillLevel"];

  private readonly states = new Map<DarkResearchId, DarkResearchRuntimeState>();
  private unlocked = false;
  private hasRegisteredUnlocks = false;
  private totalSouls = 0;

  constructor(options: DarkResearchModuleOptions) {
    this.bridge = options.bridge;
    this.bonuses = options.bonuses;
    this.newUnlocks = options.newUnlocks;
    this.getSkillLevel = options.getSkillLevel;

    DARK_RESEARCH_IDS.forEach((id) => {
      this.states.set(id, { level: 0, xp: 0, assignedSouls: 0 });
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
    this.totalSouls = 0;
    DARK_RESEARCH_IDS.forEach((id) => {
      const state = this.getRuntimeState(id);
      state.level = 0;
      state.xp = 0;
      state.assignedSouls = 0;
    });
    this.syncAllBonusLevels();
    this.refreshUnlocked();
    this.newUnlocks.invalidate("darkResearch");
    this.pushState();
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    this.totalSouls = sanitizeNonNegativeNumber(parsed.totalSouls, 0);
    DARK_RESEARCH_IDS.forEach((id) => {
      const state = this.getRuntimeState(id);
      const saved = parsed.researches?.[id];
      state.level = sanitizeLevel(saved?.level);
      state.xp = sanitizeNonNegativeNumber(saved?.xp, 0);
      state.assignedSouls = sanitizeLevel(saved?.assignedSouls);
    });
    this.rebalanceAssignedSouls();
    this.syncAllBonusLevels();
    this.refreshUnlocked();
    this.newUnlocks.invalidate("darkResearch");
    this.pushState();
  }

  public save(): unknown {
    const researches: Partial<DarkResearchSaveData["researches"]> = {};
    DARK_RESEARCH_IDS.forEach((id) => {
      const state = this.getRuntimeState(id);
      if (state.level <= 0 && state.xp <= 0 && state.assignedSouls <= 0) {
        return;
      }
      researches[id] = {
        level: state.level > 0 ? state.level : undefined,
        xp: state.xp > 0 ? state.xp : undefined,
        assignedSouls: state.assignedSouls > 0 ? state.assignedSouls : undefined,
      };
    });

    if (Object.keys(researches).length === 0 && this.totalSouls <= 0) {
      return {} satisfies DarkResearchSaveData;
    }

    return {
      totalSouls: this.totalSouls > 0 ? this.totalSouls : undefined,
      researches,
    } satisfies DarkResearchSaveData;
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
    const xpMultiplier = this.getSoulXpMultiplier();
    const seconds = clampedDeltaMs / 1000;
    let changed = unlockedChanged;

    DARK_RESEARCH_IDS.forEach((id) => {
      const state = this.getRuntimeState(id);
      const xpGain = state.assignedSouls * SOUL_XP_PER_SECOND * xpMultiplier * seconds;
      if (xpGain <= 0) {
        return;
      }
      state.xp += xpGain;

      const config = getDarkResearchConfig(id);
      let maxXp = calculateMaxXpForLevel(config, state.level);
      while (state.xp >= maxXp) {
        state.xp -= maxXp;
        state.level += 1;
        this.syncBonusLevel(id);
        maxXp = calculateMaxXpForLevel(config, state.level);
      }
      changed = true;
    });

    if (!changed) {
      return;
    }

    this.newUnlocks.invalidate("darkResearch");
    this.pushState();
  }

  public addSoulsFromEnemyKill(baseSouls: number, enemyLevel: number): void {
    if (!this.unlocked) {
      return;
    }
    const base = sanitizeNonNegativeNumber(baseSouls, 0);
    if (base <= 0) {
      return;
    }
    const level = Math.max(1, Math.floor(sanitizeNonNegativeNumber(enemyLevel, 1)));
    const amount = base * Math.pow(1.5, level);
    if (amount <= 0) {
      return;
    }

    this.totalSouls += amount;
    this.pushState();
  }

  public getSoulDropChance(): number {
    const bonusRaw = this.bonuses.getBonusValue("soul_drop_chance_add");
    const bonus = Number.isFinite(bonusRaw) ? bonusRaw : 0;
    return Math.max(0, Math.min(1, BASE_SOUL_DROP_CHANCE + bonus));
  }

  public setAssignedSouls(id: DarkResearchId, souls: number): void {
    if (!this.unlocked) {
      return;
    }
    const target = this.getRuntimeState(id);
    const sanitizedTarget = Math.max(0, Math.floor(sanitizeNonNegativeNumber(souls, 0)));
    const freeWithoutCurrent = this.getFreeSouls() + target.assignedSouls;
    target.assignedSouls = Math.min(sanitizedTarget, freeWithoutCurrent);
    this.pushState();
  }

  public adjustAssignedSouls(id: DarkResearchId, delta: number): void {
    const target = this.getRuntimeState(id);
    const next = target.assignedSouls + Math.floor(delta);
    this.setAssignedSouls(id, next);
  }

  private getSoulXpMultiplier(): number {
    const raw = this.bonuses.getBonusValue("dark_research_xp_multiplier");
    if (!Number.isFinite(raw)) {
      return 1;
    }
    return Math.max(0, raw);
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

  private getAssignedSoulsTotal(): number {
    let total = 0;
    DARK_RESEARCH_IDS.forEach((id) => {
      total += this.getRuntimeState(id).assignedSouls;
    });
    return total;
  }

  private getFreeSouls(): number {
    return Math.max(0, this.totalSouls - this.getAssignedSoulsTotal());
  }

  private rebalanceAssignedSouls(): void {
    let remaining = this.totalSouls;
    DARK_RESEARCH_IDS.forEach((id) => {
      const state = this.getRuntimeState(id);
      const assigned = Math.max(0, Math.min(state.assignedSouls, remaining));
      state.assignedSouls = assigned;
      remaining -= assigned;
    });
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
    const xpPerSecond = runtime.assignedSouls * SOUL_XP_PER_SECOND * this.getSoulXpMultiplier();

    return {
      id,
      name: config.name,
      description: config.description,
      icon: config.icon,
      level: runtime.level,
      xp: runtime.xp,
      maxXp: calculateMaxXpForLevel(config, runtime.level),
      xpPerSecond,
      assignedSouls: runtime.assignedSouls,
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
      totalSouls: this.totalSouls,
      freeSouls: this.getFreeSouls(),
      researches: DARK_RESEARCH_IDS.map((id) => this.buildResearchState(id)),
    };
    DataBridgeHelpers.pushState(this.bridge, DARK_RESEARCH_STATE_BRIDGE_KEY, payload);
  }
}
