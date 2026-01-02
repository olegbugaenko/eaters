import { GameModule } from "../../../core/types";
import type { DataBridge } from "../../../core/DataBridge";
import { PLAYER_UNIT_TYPES, PlayerUnitType, isPlayerUnitType } from "../../../../db/player-units-db";
import type { NecromancerModule } from "../necromancer/necromancer.module";
import type { NecromancerResourceSnapshot } from "../necromancer/necromancer.types";
import {
  UnitDesignId,
  UnitDesignerUnitState,
} from "../../camp/unit-design/unit-design.types";
import type {
  UnitAutomationUnitState,
  UnitAutomationBridgeState,
  UnitAutomationModuleOptions,
  UnitAutomationSaveData,
  AutomationSelectionCandidate,
  AutomationAvailability,
} from "./unit-automation.types";
import {
  UNIT_AUTOMATION_STATE_BRIDGE_KEY,
  DEFAULT_UNIT_AUTOMATION_STATE,
  AUTOMATION_SKILL_ID,
  MAX_AUTOMATION_ITERATIONS,
  MAX_AUTOMATION_FAILURES_BEFORE_FALLBACK,
} from "./unit-automation.const";
import { selectNextAutomationTarget } from "./unit-automation.helpers";
import { SkillId } from "@/db/skills-db";
import { MapRunState } from "../map/MapRunState";
import { UnitDesignModule } from "../../camp/unit-design/unit-design.module";

export class UnitAutomationModule implements GameModule {
  public readonly id = "unitAutomation";

  private readonly bridge: DataBridge;
  private readonly necromancer: Pick<
    NecromancerModule,
    "trySpawnDesign" | "getResources" | "getRemainingUnitCapacity"
  >;
  private readonly unitDesigns: Pick<
    UnitDesignModule,
    "subscribe" | "getDefaultDesignForType" | "getActiveRosterDesigns"
  >;
  private readonly getUnitCountByDesignId: (designId: UnitDesignId) => number;
  private readonly getSkillLevel: (id: SkillId) => number;
  private readonly runState: MapRunState;
  private readonly isRunActiveFn: () => boolean;

  private unlocked = false;
  private enabled = new Map<UnitDesignId, boolean>();
  private weights = new Map<UnitDesignId, number>();
  private designLookup = new Map<UnitDesignId, UnitDesignerUnitState>();
  private designOrder: UnitDesignId[] = [];
  private pendingTypeEnables = new Map<PlayerUnitType, boolean>();
  private failureCounts = new Map<UnitDesignId, number>();
  private unsubscribeDesigns: (() => void) | null = null;

  constructor(options: UnitAutomationModuleOptions) {
    this.bridge = options.bridge;
    this.necromancer = options.necromancer;
    this.unitDesigns = options.unitDesigns;
    this.getUnitCountByDesignId = options.getUnitCountByDesignId;
    this.getSkillLevel = options.getSkillLevel;
    this.runState = options.runState;
    this.isRunActiveFn = options.isRunActive;
  }

  public initialize(): void {
    this.unsubscribeDesigns = this.unitDesigns.subscribe(() => {
      this.handleDesignsChanged();
    });
    this.refreshUnlockState();
    this.pushState();
  }

  public reset(): void {
    this.enabled.clear();
    this.weights.clear();
    this.failureCounts.clear();
    this.pendingTypeEnables.clear();
    this.refreshUnlockState();
    this.pushState();
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    this.enabled = parsed.enabled;
    this.weights = parsed.weights;
    this.pendingTypeEnables = parsed.pendingTypes;
    this.failureCounts.clear();
    this.refreshUnlockState();
    this.pushState();
  }

  public save(): unknown {
    return {
      enabled: this.serializeEnabled(),
      weights: this.serializeWeights(),
    } satisfies UnitAutomationSaveData;
  }

  private automationCooldownMs = 0;
  private static readonly AUTOMATION_INTERVAL_MS = 300;

  public tick(deltaMs: number): void {
    if (!this.runState.shouldProcessTick()) {
      return;
    }
    const changed = this.refreshUnlockState();
    if (changed) {
      this.pushState();
    }

    if (!this.unlocked) {
      return;
    }
    this.automationCooldownMs = Math.max(0, this.automationCooldownMs - Math.max(0, deltaMs));
    if (this.automationCooldownMs > 0) {
      return;
    }
    this.automationCooldownMs = UnitAutomationModule.AUTOMATION_INTERVAL_MS;
    this.runAutomation();
  }

  public onMapStart(): void {
    this.failureCounts.clear();
    this.automationCooldownMs = 0;
  }

  public onMapEnd(): void {
    this.failureCounts.clear();
    this.automationCooldownMs = 0;
  }

  public setAutomationEnabled(designId: UnitDesignId, enabled: boolean): void {
    if (!this.designLookup.has(designId)) {
      return;
    }
    const design = this.designLookup.get(designId);
    if (design) {
      this.pendingTypeEnables.delete(design.type);
    }
    if (enabled) {
      this.enabled.set(designId, true);
      if (!this.weights.has(designId)) {
        this.weights.set(designId, 1);
      }
    } else {
      this.enabled.set(designId, false);
      this.failureCounts.delete(designId);
    }
    this.pushState();
  }

  public setAutomationWeight(designId: UnitDesignId, weight: number): void {
    if (!this.designLookup.has(designId)) {
      return;
    }
    const sanitized = Math.max(1, Math.floor(Number.isFinite(weight) ? weight : 1));
    this.weights.set(designId, sanitized);
    this.pushState();
  }

  private runAutomation(): void {
    if (!this.isRunActiveFn()) {
      return;
    }
    let iterations = 0;
    const skipped = new Set<UnitDesignId>();
    while (iterations < MAX_AUTOMATION_ITERATIONS) {
      const designId = this.pickNextAutomatedDesign(skipped);
      if (!designId) {
        break;
      }
      const design = this.designLookup.get(designId);
      if (!design) {
        skipped.add(designId);
        continue;
      }
      iterations += 1;
      const availability = this.evaluateDesignAvailability(design);
      if (availability === "wait") {
        break;
      }
      if (availability === "skip") {
        skipped.add(designId);
        continue;
      }
      const success = this.necromancer.trySpawnDesign(designId);
      if (success) {
        this.failureCounts.delete(designId);
        continue;
      }
      const updatedAvailability = this.evaluateDesignAvailability(design);
      if (updatedAvailability === "wait") {
        break;
      }
      if (updatedAvailability === "skip") {
        skipped.add(designId);
        continue;
      }
      const failures = this.incrementFailureCount(designId);
      if (failures >= MAX_AUTOMATION_FAILURES_BEFORE_FALLBACK) {
        skipped.add(designId);
        continue;
      }
      break;
    }
  }

  private isAutomationEnabled(designId: UnitDesignId): boolean {
    return this.enabled.get(designId) ?? false;
  }

  private getAutomationWeight(designId: UnitDesignId): number {
    const stored = this.weights.get(designId);
    if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
      return Math.floor(stored);
    }
    return 1;
  }

  private pickNextAutomatedDesign(skipped: ReadonlySet<UnitDesignId>): UnitDesignId | null {
    const candidates: AutomationSelectionCandidate[] = [];
    this.designOrder.forEach((designId, order) => {
      if (!this.isAutomationEnabled(designId)) {
        return;
      }
      const design = this.designLookup.get(designId);
      if (!design) {
        return;
      }
      const weight = this.getAutomationWeight(designId);
      if (weight <= 0) {
        return;
      }
      const activeCount = this.getActiveUnitCount(designId);
      candidates.push({ designId, weight, activeCount, order });
    });
    if (candidates.length === 0) {
      return null;
    }
    return selectNextAutomationTarget(candidates, skipped);
  }

  private getActiveUnitCount(designId: UnitDesignId): number {
    try {
      const value = this.getUnitCountByDesignId(designId);
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return Math.floor(value);
      }
    } catch {
      // ignore errors in consumer-supplied getter
    }
    return 0;
  }

  private incrementFailureCount(designId: UnitDesignId): number {
    const next = (this.failureCounts.get(designId) ?? 0) + 1;
    this.failureCounts.set(designId, next);
    return next;
  }

  private evaluateDesignAvailability(design: UnitDesignerUnitState): AutomationAvailability {
    const resources: NecromancerResourceSnapshot = this.necromancer.getResources();
    const remainingCapacity = this.necromancer.getRemainingUnitCapacity();
    if (remainingCapacity <= 0) {
      return "skip";
    }
    const costs = this.getDesignCosts(design);
    if (costs.mana > resources.mana.current) {
      if (costs.mana > resources.mana.max) {
        return "skip";
      }
      if (resources.mana.regenPerSecond <= 0) {
        return "skip";
      }
      return "wait";
    }
    return "affordable";
  }

  private getDesignCosts(design: UnitDesignerUnitState): { mana: number; sanity: number } {
    return {
      mana: this.sanitizeCostValue(design.cost?.mana),
      sanity: 0,
    };
  }

  private sanitizeCostValue(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return 0;
    }
    return value;
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
          weight: this.getAutomationWeight(design.id),
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
    weights: Map<UnitDesignId, number>;
    pendingTypes: Map<PlayerUnitType, boolean>;
  } {
    const enabled = new Map<UnitDesignId, boolean>();
    const weights = new Map<UnitDesignId, number>();
    const pendingTypes = new Map<PlayerUnitType, boolean>();
    if (!data || typeof data !== "object") {
      return { enabled, pendingTypes, weights };
    }
    const payload = (data as UnitAutomationSaveData).enabled;
    if (!payload || typeof payload !== "object") {
      // Continue parsing weights even if enabled map missing
    } else {
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
    }

    const weightPayload = (data as UnitAutomationSaveData).weights;
    if (weightPayload && typeof weightPayload === "object") {
      Object.entries(weightPayload).forEach(([key, value]) => {
        if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
          return;
        }
        weights.set(key as UnitDesignId, Math.floor(value));
      });
    }
    return { enabled, pendingTypes, weights };
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

  private serializeWeights(): Record<string, number> {
    const result: Record<string, number> = {};
    this.weights.forEach((value, id) => {
      if (value > 0 && Number.isFinite(value)) {
        result[id] = Math.floor(value);
      }
    });
    return result;
  }

  private handleDesignsChanged(): void {
    const designs: UnitDesignerUnitState[] = this.unitDesigns.getActiveRosterDesigns();
    const knownIds = new Set<UnitDesignId>();
    designs.forEach((design) => {
      knownIds.add(design.id);
      this.designLookup.set(design.id, design);
      if (!this.weights.has(design.id)) {
        this.weights.set(design.id, 1);
      }
    });
    this.designLookup.forEach((_value, id) => {
      if (!knownIds.has(id)) {
        this.designLookup.delete(id);
        this.enabled.delete(id);
        this.weights.delete(id);
        this.failureCounts.delete(id);
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
