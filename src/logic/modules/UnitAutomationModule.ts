import { DataBridge } from "../core/DataBridge";
import { GameModule } from "../core/types";
import { PLAYER_UNIT_TYPES, PlayerUnitType, isPlayerUnitType } from "../../db/player-units-db";
import { NecromancerModule } from "./NecromancerModule";
import { SkillId } from "../../db/skills-db";

export interface UnitAutomationUnitState {
  readonly type: PlayerUnitType;
  readonly enabled: boolean;
}

export interface UnitAutomationBridgeState {
  readonly unlocked: boolean;
  readonly units: readonly UnitAutomationUnitState[];
}

export const UNIT_AUTOMATION_STATE_BRIDGE_KEY = "automation/state";

export const DEFAULT_UNIT_AUTOMATION_STATE: UnitAutomationBridgeState = Object.freeze({
  unlocked: false,
  units: [],
});

interface UnitAutomationModuleOptions {
  bridge: DataBridge;
  necromancer: Pick<NecromancerModule, "trySpawnUnit">;
  getSkillLevel: (id: SkillId) => number;
}

interface UnitAutomationSaveData {
  readonly enabled?: Partial<Record<PlayerUnitType, boolean>>;
}

const AUTOMATION_SKILL_ID: SkillId = "stone_automatons";
const MAX_AUTOMATION_ITERATIONS = 32;

export class UnitAutomationModule implements GameModule {
  public readonly id = "unitAutomation";

  private readonly bridge: DataBridge;
  private readonly necromancer: Pick<NecromancerModule, "trySpawnUnit">;
  private readonly getSkillLevel: (id: SkillId) => number;

  private unlocked = false;
  private enabled = new Map<PlayerUnitType, boolean>();

  constructor(options: UnitAutomationModuleOptions) {
    this.bridge = options.bridge;
    this.necromancer = options.necromancer;
    this.getSkillLevel = options.getSkillLevel;
  }

  public initialize(): void {
    this.refreshUnlockState();
    this.pushState();
  }

  public reset(): void {
    this.enabled.clear();
    this.refreshUnlockState();
    this.pushState();
  }

  public load(data: unknown | undefined): void {
    this.enabled = this.parseSaveData(data);
    this.refreshUnlockState();
    this.pushState();
  }

  public save(): unknown {
    return {
      enabled: this.serializeEnabled(),
    } satisfies UnitAutomationSaveData;
  }

  public tick(_deltaMs: number): void {
    const changed = this.refreshUnlockState();
    if (this.unlocked) {
      this.runAutomation();
    }
    if (changed) {
      this.pushState();
    }
  }

  public setAutomationEnabled(type: PlayerUnitType, enabled: boolean): void {
    if (!isPlayerUnitType(type)) {
      return;
    }
    this.enabled.set(type, Boolean(enabled));
    this.pushState();
  }

  private runAutomation(): void {
    let iterations = 0;
    PLAYER_UNIT_TYPES.forEach((type) => {
      if (!this.isAutomationEnabled(type)) {
        return;
      }
      if (iterations >= MAX_AUTOMATION_ITERATIONS) {
        return;
      }
      iterations += 1;
      this.necromancer.trySpawnUnit(type);
    });
  }

  private isAutomationEnabled(type: PlayerUnitType): boolean {
    return this.enabled.get(type) ?? false;
  }

  private refreshUnlockState(): boolean {
    const unlocked = this.getSkillLevel(AUTOMATION_SKILL_ID) > 0;
    if (this.unlocked === unlocked) {
      return false;
    }
    this.unlocked = unlocked;
    return true;
  }

  private pushState(): void {
    const units: UnitAutomationUnitState[] = PLAYER_UNIT_TYPES.map((type) => ({
      type,
      enabled: this.isAutomationEnabled(type),
    }));
    this.bridge.setValue<UnitAutomationBridgeState>(UNIT_AUTOMATION_STATE_BRIDGE_KEY, {
      unlocked: this.unlocked,
      units,
    });
  }

  private parseSaveData(data: unknown): Map<PlayerUnitType, boolean> {
    if (!data || typeof data !== "object") {
      return new Map();
    }
    const enabled = (data as UnitAutomationSaveData).enabled;
    if (!enabled || typeof enabled !== "object") {
      return new Map();
    }
    const entries: [PlayerUnitType, boolean][] = [];
    Object.entries(enabled).forEach(([type, value]) => {
      if (isPlayerUnitType(type) && typeof value === "boolean") {
        entries.push([type, value]);
      }
    });
    return new Map(entries);
  }

  private serializeEnabled(): Partial<Record<PlayerUnitType, boolean>> {
    const result: Partial<Record<PlayerUnitType, boolean>> = {};
    this.enabled.forEach((value, type) => {
      if (value) {
        result[type] = true;
      }
    });
    return result;
  }
}
