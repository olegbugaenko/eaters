import { DataBridge } from "../core/DataBridge";
import { GameModule } from "../core/types";
import { PLAYER_UNIT_TYPES, PlayerUnitType, isPlayerUnitType } from "../../db/player-units-db";
import { NecromancerModule } from "./NecromancerModule";
import {
  UnitDesignId,
  UnitDesignModule,
  UnitDesignerUnitState,
} from "./UnitDesignModule";
import { SkillId } from "../../db/skills-db";

export interface UnitAutomationUnitState {
  readonly designId: UnitDesignId;
  readonly type: PlayerUnitType;
  readonly name: string;
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
  necromancer: Pick<NecromancerModule, "trySpawnDesign">;
  unitDesigns: Pick<UnitDesignModule, "subscribe" | "getDefaultDesignForType">;
  getSkillLevel: (id: SkillId) => number;
}

interface UnitAutomationSaveData {
  readonly enabled?: Record<string, boolean>;
}

const AUTOMATION_SKILL_ID: SkillId = "stone_automatons";
const MAX_AUTOMATION_ITERATIONS = 32;

export class UnitAutomationModule implements GameModule {
  public readonly id = "unitAutomation";

  private readonly bridge: DataBridge;
  private readonly necromancer: Pick<NecromancerModule, "trySpawnDesign">;
  private readonly unitDesigns: Pick<UnitDesignModule, "subscribe" | "getDefaultDesignForType">;
  private readonly getSkillLevel: (id: SkillId) => number;

  private unlocked = false;
  private enabled = new Map<UnitDesignId, boolean>();
  private designLookup = new Map<UnitDesignId, UnitDesignerUnitState>();
  private designOrder: UnitDesignId[] = [];
  private pendingTypeEnables = new Map<PlayerUnitType, boolean>();
  private unsubscribeDesigns: (() => void) | null = null;

  constructor(options: UnitAutomationModuleOptions) {
    this.bridge = options.bridge;
    this.necromancer = options.necromancer;
    this.unitDesigns = options.unitDesigns;
    this.getSkillLevel = options.getSkillLevel;
  }

  public initialize(): void {
    this.unsubscribeDesigns = this.unitDesigns.subscribe((designs) => {
      this.handleDesignsChanged(designs);
    });
    this.refreshUnlockState();
    this.pushState();
  }

  public reset(): void {
    this.enabled.clear();
    this.pendingTypeEnables.clear();
    this.refreshUnlockState();
    this.pushState();
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    this.enabled = parsed.enabled;
    this.pendingTypeEnables = parsed.pendingTypes;
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

  public setAutomationEnabled(designId: UnitDesignId, enabled: boolean): void {
    if (!this.designLookup.has(designId)) {
      return;
    }
    const design = this.designLookup.get(designId);
    if (design) {
      this.pendingTypeEnables.delete(design.type);
    }
    this.enabled.set(designId, Boolean(enabled));
    this.pushState();
  }

  private runAutomation(): void {
    let iterations = 0;
    for (const id of this.designOrder) {
      if (iterations >= MAX_AUTOMATION_ITERATIONS) {
        break;
      }
      if (!this.isAutomationEnabled(id)) {
        continue;
      }
      iterations += 1;
      this.necromancer.trySpawnDesign(id);
    }
  }

  private isAutomationEnabled(designId: UnitDesignId): boolean {
    return this.enabled.get(designId) ?? false;
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
    const units: UnitAutomationUnitState[] = this.designOrder
      .map((id) => {
        const design = this.designLookup.get(id);
        if (!design) {
          return null;
        }
        return {
          designId: design.id,
          type: design.type,
          name: design.name,
          enabled: this.isAutomationEnabled(design.id),
        } satisfies UnitAutomationUnitState;
      })
      .filter((entry): entry is UnitAutomationUnitState => Boolean(entry));
    this.bridge.setValue<UnitAutomationBridgeState>(UNIT_AUTOMATION_STATE_BRIDGE_KEY, {
      unlocked: this.unlocked,
      units,
    });
  }

  private parseSaveData(data: unknown): {
    enabled: Map<UnitDesignId, boolean>;
    pendingTypes: Map<PlayerUnitType, boolean>;
  } {
    const enabled = new Map<UnitDesignId, boolean>();
    const pendingTypes = new Map<PlayerUnitType, boolean>();
    if (!data || typeof data !== "object") {
      return { enabled, pendingTypes };
    }
    const payload = (data as UnitAutomationSaveData).enabled;
    if (!payload || typeof payload !== "object") {
      return { enabled, pendingTypes };
    }
    Object.entries(payload).forEach(([key, value]) => {
      if (typeof value !== "boolean") {
        return;
      }
      if (isPlayerUnitType(key)) {
        pendingTypes.set(key, value);
        return;
      }
      enabled.set(key as UnitDesignId, value);
    });
    return { enabled, pendingTypes };
  }

  private serializeEnabled(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    this.enabled.forEach((value, id) => {
      if (value) {
        result[id] = true;
      }
    });
    return result;
  }

  private handleDesignsChanged(designs: readonly UnitDesignerUnitState[]): void {
    const knownIds = new Set<UnitDesignId>();
    designs.forEach((design) => {
      knownIds.add(design.id);
      this.designLookup.set(design.id, design);
    });
    this.designLookup.forEach((_value, id) => {
      if (!knownIds.has(id)) {
        this.designLookup.delete(id);
        this.enabled.delete(id);
      }
    });
    this.designOrder = designs.map((design) => design.id);
    this.applyPendingTypeEnables();
    this.pushState();
  }

  private applyPendingTypeEnables(): void {
    if (this.pendingTypeEnables.size === 0) {
      return;
    }
    const appliedTypes = new Set<PlayerUnitType>();
    this.designOrder.forEach((designId) => {
      const design = this.designLookup.get(designId);
      if (!design) {
        return;
      }
      if (appliedTypes.has(design.type)) {
        return;
      }
      const pending = this.pendingTypeEnables.get(design.type);
      if (pending === undefined) {
        return;
      }
      if (pending) {
        this.enabled.set(designId, true);
      }
      appliedTypes.add(design.type);
      this.pendingTypeEnables.delete(design.type);
    });
    if (this.pendingTypeEnables.size === 0) {
      return;
    }
    PLAYER_UNIT_TYPES.forEach((type) => {
      const pending = this.pendingTypeEnables.get(type);
      if (pending === undefined) {
        return;
      }
      const defaultDesign = this.unitDesigns.getDefaultDesignForType(type);
      if (!defaultDesign) {
        return;
      }
      if (pending) {
        this.enabled.set(defaultDesign.id, true);
      }
      this.pendingTypeEnables.delete(type);
    });
  }
}
