import { DataBridge } from "../core/DataBridge";
import { GameModule } from "../core/types";
import { PLAYER_UNIT_TYPES, PlayerUnitType, isPlayerUnitType } from "../../db/player-units-db";
import { NecromancerModule, NecromancerResourceSnapshot } from "./NecromancerModule";
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
  readonly weight: number;
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
  necromancer: Pick<NecromancerModule, "trySpawnDesign" | "getResources">;
  unitDesigns: Pick<
    UnitDesignModule,
    "subscribe" | "getDefaultDesignForType" | "getActiveRosterDesigns"
  >;
  getSkillLevel: (id: SkillId) => number;
  isRunActive: () => boolean;
}

interface UnitAutomationSaveData {
  readonly enabled?: Record<string, boolean>;
  readonly weights?: Record<string, number>;
}

const AUTOMATION_SKILL_ID: SkillId = "stone_automatons";
const MAX_AUTOMATION_ITERATIONS = 32;
const MAX_AUTOMATION_FAILURES_BEFORE_FALLBACK = 32;

export interface AutomationSelectionCandidate {
  readonly designId: UnitDesignId;
  readonly weight: number;
  readonly spawned: number;
  readonly order: number;
}

const AUTOMATION_SELECTION_EPSILON = 1e-6;

type AutomationAvailability = "affordable" | "wait" | "skip";

export const selectNextAutomationTarget = (
  candidates: readonly AutomationSelectionCandidate[],
  skipped: ReadonlySet<UnitDesignId> = new Set<UnitDesignId>()
): UnitDesignId | null => {
  let best: AutomationSelectionCandidate | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let fallback: AutomationSelectionCandidate | null = null;

  for (const candidate of candidates) {
    if (skipped.has(candidate.designId)) {
      continue;
    }
    if (!fallback) {
      fallback = candidate;
    }
    const normalizedSpawned = candidate.spawned > 0 ? candidate.spawned : 0;
    const effectiveWeight = candidate.weight > 0 ? candidate.weight : 1;
    const score = normalizedSpawned / effectiveWeight;
    if (!best) {
      best = candidate;
      bestScore = score;
      continue;
    }
    if (score + AUTOMATION_SELECTION_EPSILON < bestScore) {
      best = candidate;
      bestScore = score;
      continue;
    }
    if (Math.abs(score - bestScore) <= AUTOMATION_SELECTION_EPSILON && candidate.order < best.order) {
      best = candidate;
      bestScore = score;
    }
  }

  if (best) {
    return best.designId;
  }
  return fallback ? fallback.designId : null;
};

export class UnitAutomationModule implements GameModule {
  public readonly id = "unitAutomation";

  private readonly bridge: DataBridge;
  private readonly necromancer: Pick<NecromancerModule, "trySpawnDesign" | "getResources">;
  private readonly unitDesigns: Pick<
    UnitDesignModule,
    "subscribe" | "getDefaultDesignForType" | "getActiveRosterDesigns"
  >;
  private readonly getSkillLevel: (id: SkillId) => number;
  private readonly isRunActiveFn: () => boolean;

  private unlocked = false;
  private enabled = new Map<UnitDesignId, boolean>();
  private weights = new Map<UnitDesignId, number>();
  private designLookup = new Map<UnitDesignId, UnitDesignerUnitState>();
  private designOrder: UnitDesignId[] = [];
  private pendingTypeEnables = new Map<PlayerUnitType, boolean>();
  private spawnCounts = new Map<UnitDesignId, number>();
  private failureCounts = new Map<UnitDesignId, number>();
  private unsubscribeDesigns: (() => void) | null = null;

  constructor(options: UnitAutomationModuleOptions) {
    this.bridge = options.bridge;
    this.necromancer = options.necromancer;
    this.unitDesigns = options.unitDesigns;
    this.getSkillLevel = options.getSkillLevel;
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
    this.spawnCounts.clear();
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
    this.spawnCounts.clear();
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
      this.spawnCounts.delete(designId);
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
        this.incrementSpawnCount(designId);
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
      const spawned = this.spawnCounts.get(designId) ?? 0;
      candidates.push({ designId, weight, spawned, order });
    });
    if (candidates.length === 0) {
      return null;
    }
    return selectNextAutomationTarget(candidates, skipped);
  }

  private incrementSpawnCount(designId: UnitDesignId): void {
    const previous = this.spawnCounts.get(designId) ?? 0;
    this.spawnCounts.set(designId, previous + 1);
  }

  private incrementFailureCount(designId: UnitDesignId): number {
    const next = (this.failureCounts.get(designId) ?? 0) + 1;
    this.failureCounts.set(designId, next);
    return next;
  }

  private evaluateDesignAvailability(design: UnitDesignerUnitState): AutomationAvailability {
    const resources: NecromancerResourceSnapshot = this.necromancer.getResources();
    const costs = this.getDesignCosts(design);
    if (costs.sanity > resources.sanity.current) {
      return "skip";
    }
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
      sanity: this.sanitizeCostValue(design.cost?.sanity),
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
        this.spawnCounts.delete(id);
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
