import { DataBridge } from "../../../core/DataBridge";
import { GameModule } from "../../../core/types";
import {
  PLAYER_UNIT_TYPES,
  PlayerUnitType,
  getPlayerUnitConfig,
  isPlayerUnitType,
} from "../../../../db/player-units-db";
import {
  UNIT_MODULE_IDS,
  UnitModuleId,
  UnitModuleBonusType,
  getUnitModuleConfig,
} from "../../../../db/unit-modules-db";
import { BonusValueMap, BonusesModule } from "../../shared/bonuses/bonuses.module";
import { UnitModuleWorkshopModule } from "../unit-module-workshop/unit-module-workshop.module";
import {
  PlayerUnitBlueprintStats,
  PlayerUnitBonusLine,
  PlayerUnitRuntimeModifiers,
} from "../../../../types/player-units";
import {
  DEFAULT_UNIT_TARGETING_MODE,
  DEFAULT_UNIT_TARGETING_SETTINGS,
  UnitTargetingMode,
  UnitTargetingSettings,
  UnitTargetingSettingsMap,
} from "../../../../types/unit-targeting";
import {
  ResourceAmountMap,
  createEmptyResourceAmount,
  normalizeResourceCost,
} from "../../../../types/resources";
import { computePlayerUnitBlueprint, roundStat } from "../../active-map/player-units/player-units.module";

export type UnitDesignId = string;

interface UnitDesignRecord {
  readonly id: UnitDesignId;
  readonly type: PlayerUnitType;
  name: string;
  modules: UnitModuleId[];
}

export interface UnitDesignModuleDetail {
  readonly id: UnitModuleId;
  readonly name: string;
  readonly description: string;
  readonly level: number;
  readonly bonusLabel: string;
  readonly bonusType: UnitModuleBonusType;
  readonly bonusValue: number;
  readonly manaCostMultiplier: number;
  readonly sanityCost: number;
}

export interface UnitDesignerUnitState {
  readonly id: UnitDesignId;
  readonly type: PlayerUnitType;
  readonly name: string;
  readonly modules: readonly UnitModuleId[];
  readonly moduleDetails: readonly UnitDesignModuleDetail[];
  readonly cost: ResourceAmountMap;
  readonly blueprint: PlayerUnitBlueprintStats;
  readonly runtime: PlayerUnitRuntimeModifiers;
  readonly targetingMode: UnitTargetingMode;
}

export interface UnitDesignerAvailableModuleState {
  readonly id: UnitModuleId;
  readonly name: string;
  readonly description: string;
  readonly level: number;
  readonly bonusLabel: string;
  readonly bonusType: UnitModuleBonusType;
  readonly bonusValue: number;
  readonly manaCostMultiplier: number;
  readonly sanityCost: number;
}

export interface UnitDesignerBridgeState {
  readonly units: readonly UnitDesignerUnitState[];
  readonly availableModules: readonly UnitDesignerAvailableModuleState[];
  readonly maxModules: number;
  readonly activeRoster: readonly UnitDesignId[];
  readonly maxActiveUnits: number;
  readonly targetingByUnit: UnitTargetingSettingsMap;
}

interface UnitDesignerSaveDataEntry {
  readonly id: string;
  readonly type: PlayerUnitType;
  readonly name: string;
  readonly modules: UnitModuleId[];
}

interface UnitDesignerSaveData {
  readonly units?: UnitDesignerSaveDataEntry[];
  readonly roster?: UnitDesignId[];
  readonly strategy?: UnitDesignerStrategySaveData;
}

interface UnitDesignerStrategySaveData {
  readonly targetingModes?: Record<string, UnitTargetingMode>;
}

interface UnitDesignModuleOptions {
  bridge: DataBridge;
  bonuses: BonusesModule;
  workshop: UnitModuleWorkshopModule;
}

export const UNIT_DESIGNER_STATE_BRIDGE_KEY = "unitDesigner/state";

export const MAX_MODULES_PER_UNIT = 3;
export const MAX_ACTIVE_UNITS = 3;

export const DEFAULT_UNIT_DESIGNER_STATE: UnitDesignerBridgeState = Object.freeze({
  units: [],
  availableModules: [],
  maxModules: MAX_MODULES_PER_UNIT,
  activeRoster: [],
  maxActiveUnits: MAX_ACTIVE_UNITS,
  targetingByUnit: {},
});

const DEFAULT_UNIT_NAME_FALLBACK = "Custom Unit";
const PERFORATOR_RADIUS = 30;

const clampModuleCount = (modules: UnitModuleId[]): UnitModuleId[] =>
  modules.slice(0, MAX_MODULES_PER_UNIT);

export type UnitDesignerListener = (
  designs: readonly UnitDesignerUnitState[]
) => void;

export class UnitDesignModule implements GameModule {
  public readonly id = "unitDesign";

  private readonly bridge: DataBridge;
  private readonly bonuses: BonusesModule;
  private readonly workshop: UnitModuleWorkshopModule;

  private designs = new Map<UnitDesignId, UnitDesignRecord>();
  private designOrder: UnitDesignId[] = [];
  private idCounter = 0;
  private cachedComputed = new Map<UnitDesignId, UnitDesignerUnitState>();
  private activeRoster: UnitDesignId[] = [];
  private rosterInitialized = false;
  private designTargeting = new Map<UnitDesignId, UnitTargetingMode>();
  private cachedBonuses: BonusValueMap | null = null;
  private listeners = new Set<UnitDesignerListener>();
  private unsubscribeBonuses: (() => void) | null = null;
  private unsubscribeWorkshop: (() => void) | null = null;

  constructor(options: UnitDesignModuleOptions) {
    this.bridge = options.bridge;
    this.bonuses = options.bonuses;
    this.workshop = options.workshop;
  }

  public initialize(): void {
    this.unsubscribeBonuses = this.bonuses.subscribe((values) => {
      this.cachedBonuses = values;
      this.refreshComputedState();
    });
    this.unsubscribeWorkshop = this.workshop.subscribe(() => {
      this.refreshComputedState();
    });
    this.ensureDefaults();
    this.refreshComputedState();
  }

  public reset(): void {
    this.designs.clear();
    this.designOrder = [];
    this.idCounter = 0;
    this.activeRoster = [];
    this.rosterInitialized = false;
    this.designTargeting.clear();
    this.ensureDefaults();
    this.refreshComputedState();
  }

  public load(data: unknown | undefined): void {
    this.designs.clear();
    this.designOrder = [];
    this.idCounter = 0;
    this.activeRoster = [];
    this.rosterInitialized = false;
    this.designTargeting.clear();
    this.applySaveData(data);
    this.ensureDefaults();
    this.refreshComputedState();
  }

  public save(): unknown {
    const units: UnitDesignerSaveDataEntry[] = this.designOrder
      .map((id) => this.designs.get(id))
      .filter((record): record is UnitDesignRecord => Boolean(record))
      .map((record) => ({
        id: record.id,
        type: record.type,
        name: record.name,
        modules: [...record.modules],
      }));
    const roster = this.activeRoster.slice(0, MAX_ACTIVE_UNITS);
    const targetingModes: Record<string, UnitTargetingMode> = {};
    this.designOrder.forEach((id) => {
      const mode = this.designTargeting.get(id);
      if (mode) {
        targetingModes[id] = mode;
      }
    });
    const strategy: UnitDesignerStrategySaveData = { targetingModes };
    return { units, roster, strategy } satisfies UnitDesignerSaveData;
  }

  public tick(_deltaMs: number): void {
    // No-op; state changes are event-driven.
  }

  public createDesign(type: PlayerUnitType): UnitDesignId {
    const sanitizedType = this.sanitizeUnitType(type);
    const config = getPlayerUnitConfig(sanitizedType);
    const id = this.createDesignId();
    const record: UnitDesignRecord = {
      id,
      type: sanitizedType,
      name: `${config.name} ${this.designOrder.length + 1}`,
      modules: [],
    };
    this.designs.set(id, record);
    this.designOrder.push(id);
    this.designTargeting.set(id, DEFAULT_UNIT_TARGETING_MODE);
    // Auto-add to roster if there's a free slot
    if (this.activeRoster.length < MAX_ACTIVE_UNITS && !this.activeRoster.includes(id)) {
      this.activeRoster = this.sanitizeRoster([...this.activeRoster, id]);
      this.rosterInitialized = true;
    }
    this.refreshComputedState();
    return id;
  }

  public updateDesign(
    id: UnitDesignId,
    updates: Partial<{ name: string; modules: UnitModuleId[] }>
  ): void {
    const record = this.designs.get(id);
    if (!record) {
      return;
    }
    if (typeof updates.name === "string") {
      const trimmed = updates.name.trim();
      record.name = trimmed.length > 0 ? trimmed : DEFAULT_UNIT_NAME_FALLBACK;
    }
    if (Array.isArray(updates.modules)) {
      record.modules = clampModuleCount(this.sanitizeModules(updates.modules));
    }
    this.refreshComputedState();
  }

  public deleteDesign(id: UnitDesignId): void {
    const record = this.designs.get(id);
    if (!record) {
      return;
    }
    const type = record.type;
    this.designs.delete(id);
    this.designOrder = this.designOrder.filter((entry) => entry !== id);
    this.cachedComputed.delete(id);
    this.designTargeting.delete(id);
    if (!this.hasDesignForType(type)) {
      this.createDefaultDesign(type);
    }
    this.refreshComputedState();
  }

  public getDesign(id: UnitDesignId): UnitDesignerUnitState | null {
    return this.cachedComputed.get(id) ?? null;
  }

  public getAllDesigns(): UnitDesignerUnitState[] {
    return this.designOrder
      .map((entry) => this.cachedComputed.get(entry))
      .filter((entry): entry is UnitDesignerUnitState => Boolean(entry));
  }

  public getActiveRosterIds(): readonly UnitDesignId[] {
    return [...this.activeRoster];
  }

  public getActiveRosterDesigns(): UnitDesignerUnitState[] {
    return this.activeRoster
      .map((id) => this.cachedComputed.get(id) ?? null)
      .filter((entry): entry is UnitDesignerUnitState => Boolean(entry));
  }

  public getDesignTargetingMode(id: UnitDesignId): UnitTargetingMode {
    return this.ensureDesignTargeting(id);
  }

  public getTargetingModeForDesign(
    designId: UnitDesignId | null,
    type: PlayerUnitType
  ): UnitTargetingMode {
    if (designId && this.designs.has(designId)) {
      return this.ensureDesignTargeting(designId);
    }
    const fallback = this.getDefaultDesignForType(type);
    if (fallback) {
      return this.ensureDesignTargeting(fallback.id);
    }
    return DEFAULT_UNIT_TARGETING_MODE;
  }

  public getDefaultDesignForType(type: PlayerUnitType): UnitDesignerUnitState | null {
    const foundId = this.designOrder.find((id) => {
      const record = this.designs.get(id);
      return record?.type === type;
    });
    if (!foundId) {
      return null;
    }
    return this.cachedComputed.get(foundId) ?? null;
  }

  public subscribe(listener: UnitDesignerListener): () => void {
    this.listeners.add(listener);
    listener(this.getAllDesigns());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setActiveRoster(roster: readonly UnitDesignId[]): void {
    const sanitized = this.sanitizeRoster(roster);
    if (this.areRostersEqual(sanitized, this.activeRoster)) {
      return;
    }
    this.activeRoster = sanitized;
    this.rosterInitialized = true;
    const units = this.getAllDesigns();
    this.emitState(units);
  }

  public setDesignTargetingMode(id: UnitDesignId, mode: UnitTargetingMode): void {
    if (!this.designs.has(id)) {
      return;
    }
    const sanitized = this.sanitizeTargetingMode(mode);
    const current = this.ensureDesignTargeting(id);
    if (sanitized === current) {
      return;
    }
    this.designTargeting.set(id, sanitized);
    const units = this.getAllDesigns();
    this.emitState(units);
  }

  private applySaveData(data: unknown | undefined): void {
    if (!data || typeof data !== "object") {
      return;
    }
    let roster: UnitDesignId[] = [];
    const rosterPayload = (data as UnitDesignerSaveData).roster;
    if (Array.isArray(rosterPayload)) {
      roster = rosterPayload.filter((id): id is UnitDesignId => typeof id === "string");
      this.rosterInitialized = true;
    }
    const strategyPayload = (data as UnitDesignerSaveData).strategy;
    if (strategyPayload && typeof strategyPayload === "object") {
      const targetingModes = strategyPayload.targetingModes;
      if (targetingModes && typeof targetingModes === "object") {
        Object.entries(targetingModes).forEach(([id, mode]) => {
          if (typeof id === "string") {
            this.designTargeting.set(
              id,
              this.sanitizeTargetingMode(mode)
            );
          }
        });
      }
    }
    const payload = (data as UnitDesignerSaveData).units;
    if (!Array.isArray(payload)) {
      this.activeRoster = this.sanitizeRoster(roster);
      return;
    }
    payload.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const id = typeof entry.id === "string" && entry.id.trim().length > 0 ? entry.id : this.createDesignId();
      const type = this.sanitizeUnitType(entry.type);
      const name = typeof entry.name === "string" && entry.name.trim().length > 0 ? entry.name.trim() : DEFAULT_UNIT_NAME_FALLBACK;
      const modules = Array.isArray(entry.modules) ? this.sanitizeModules(entry.modules) : [];
      if (this.designs.has(id)) {
        return;
      }
      const record: UnitDesignRecord = { id, type, name, modules };
      this.designs.set(id, record);
      this.designOrder.push(id);
      this.idCounter = Math.max(this.idCounter, this.extractCounter(id));
      if (!this.designTargeting.has(id)) {
        this.designTargeting.set(id, DEFAULT_UNIT_TARGETING_MODE);
      }
    });
    this.activeRoster = this.sanitizeRoster(roster);
  }

  private ensureDefaults(): void {
    PLAYER_UNIT_TYPES.forEach((type) => {
      if (!this.hasDesignForType(type)) {
        this.createDefaultDesign(type);
      }
    });
    if (!this.rosterInitialized && this.activeRoster.length === 0) {
      this.activeRoster = this.designOrder.slice(0, MAX_ACTIVE_UNITS);
      this.rosterInitialized = true;
    } else {
      this.activeRoster = this.sanitizeRoster(this.activeRoster);
      if (this.activeRoster.length > 0) {
        this.rosterInitialized = true;
      }
    }
    this.pruneOrphanTargetingModes();
    this.designOrder.forEach((id) => this.ensureDesignTargeting(id));
  }

  private hasDesignForType(type: PlayerUnitType): boolean {
    return this.designOrder.some((id) => this.designs.get(id)?.type === type);
  }

  private sanitizeRoster(roster: readonly UnitDesignId[]): UnitDesignId[] {
    if (this.designOrder.length === 0) {
      return [];
    }
    const availableSet = new Set(this.designOrder);
    const sanitized: UnitDesignId[] = [];
    roster.forEach((id) => {
      if (sanitized.length >= MAX_ACTIVE_UNITS) {
        return;
      }
      if (!availableSet.has(id)) {
        return;
      }
      if (sanitized.includes(id)) {
        return;
      }
      sanitized.push(id);
    });
    return sanitized;
  }

  private sanitizeTargetingMode(mode: unknown): UnitTargetingMode {
    if (typeof mode === "string") {
      switch (mode) {
        case "nearest":
        case "highestHp":
        case "lowestHp":
        case "highestDamage":
        case "lowestDamage":
        case "none":
          return mode;
        default:
          break;
      }
    }
    return DEFAULT_UNIT_TARGETING_SETTINGS.mode;
  }

  private ensureDesignTargeting(id: UnitDesignId): UnitTargetingMode {
    const current = this.designTargeting.get(id);
    const sanitized = this.sanitizeTargetingMode(
      current ?? DEFAULT_UNIT_TARGETING_MODE
    );
    if (current !== sanitized) {
      this.designTargeting.set(id, sanitized);
    }
    return sanitized;
  }

  private pruneOrphanTargetingModes(): void {
    const validIds = new Set(this.designOrder);
    Array.from(this.designTargeting.keys()).forEach((id) => {
      if (!validIds.has(id)) {
        this.designTargeting.delete(id);
      }
    });
  }

  private areRostersEqual(
    first: readonly UnitDesignId[],
    second: readonly UnitDesignId[]
  ): boolean {
    if (first.length !== second.length) {
      return false;
    }
    for (let index = 0; index < first.length; index += 1) {
      if (first[index] !== second[index]) {
        return false;
      }
    }
    return true;
  }

  private createDefaultDesign(type: PlayerUnitType): void {
    const config = getPlayerUnitConfig(type);
    const id = this.createDesignId();
    const record: UnitDesignRecord = {
      id,
      type,
      name: config.name,
      modules: [],
    };
    this.designs.set(id, record);
    this.designOrder.push(id);
    this.designTargeting.set(id, DEFAULT_UNIT_TARGETING_MODE);
  }

  private refreshComputedState(): void {
    const bonusValues = this.cachedBonuses ?? this.bonuses.getAllValues();
    const computed: UnitDesignerUnitState[] = [];
    this.cachedComputed = new Map<UnitDesignId, UnitDesignerUnitState>();

    this.designOrder.forEach((id) => {
      const record = this.designs.get(id);
      if (!record) {
        return;
      }
      const sanitizedModules = clampModuleCount(this.sanitizeModules(record.modules));
      if (!this.areModulesEqual(sanitizedModules, record.modules)) {
        record.modules = sanitizedModules;
      }
      const unitState = this.computeDesignState(record, bonusValues);
      this.cachedComputed.set(id, unitState);
      computed.push(unitState);
    });

    const sanitizedRoster = this.sanitizeRoster(this.activeRoster);
    if (!this.areRostersEqual(sanitizedRoster, this.activeRoster)) {
      this.activeRoster = sanitizedRoster;
    }

    this.emitState(computed);
  }

  private emitState(units: UnitDesignerUnitState[]): void {
    this.pushState(units);
    this.listeners.forEach((listener) => listener(units));
  }

  private computeDesignState(
    record: UnitDesignRecord,
    bonusValues: BonusValueMap
  ): UnitDesignerUnitState {
    const moduleDetails = this.createModuleDetails(record.modules);
    const blueprint = this.createBlueprint(record.type, bonusValues, moduleDetails);
    const cost = this.computeCost(record.type, moduleDetails);
    const runtime = this.computeRuntime(moduleDetails);
    const targetingMode = this.ensureDesignTargeting(record.id);
    return {
      id: record.id,
      type: record.type,
      name: record.name,
      modules: [...moduleDetails.map((detail) => detail.id)],
      moduleDetails,
      cost,
      blueprint,
      runtime,
      targetingMode,
    };
  }

  private pushState(units: UnitDesignerUnitState[]): void {
    const availableModules = this.createAvailableModules();
    const targetingByUnit: Record<string, UnitTargetingSettings> = {};
    this.designOrder.forEach((id) => {
      const mode = this.ensureDesignTargeting(id);
      targetingByUnit[id] = { mode };
    });
    this.bridge.setValue<UnitDesignerBridgeState>(UNIT_DESIGNER_STATE_BRIDGE_KEY, {
      units,
      availableModules,
      maxModules: MAX_MODULES_PER_UNIT,
      activeRoster: [...this.activeRoster],
      maxActiveUnits: MAX_ACTIVE_UNITS,
      targetingByUnit,
    });
  }

  private createAvailableModules(): UnitDesignerAvailableModuleState[] {
    return UNIT_MODULE_IDS.map((id) => {
      const config = getUnitModuleConfig(id);
      const level = this.workshop.getModuleLevel(id);
      const bonusValue = this.computeModuleValue(config.bonusType, config.baseBonusValue, config.bonusPerLevel, level);
      return {
        id,
        name: config.name,
        description: config.description,
        level,
        bonusLabel: config.bonusLabel,
        bonusType: config.bonusType,
        bonusValue,
        manaCostMultiplier: config.manaCostMultiplier,
        sanityCost: config.sanityCost,
      };
    });
  }

  private createModuleDetails(modules: readonly UnitModuleId[]): UnitDesignModuleDetail[] {
    const details: UnitDesignModuleDetail[] = [];
    modules.forEach((moduleId) => {
      const config = getUnitModuleConfig(moduleId);
      const level = this.workshop.getModuleLevel(moduleId);
      if (level <= 0) {
        return;
      }
      const bonusValue = this.computeModuleValue(
        config.bonusType,
        config.baseBonusValue,
        config.bonusPerLevel,
        level
      );
      details.push({
        id: moduleId,
        name: config.name,
        description: config.description,
        level,
        bonusLabel: config.bonusLabel,
        bonusType: config.bonusType,
        bonusValue,
        manaCostMultiplier: config.manaCostMultiplier,
        sanityCost: config.sanityCost,
      });
    });
    return details;
  }

  private computeCost(
    type: PlayerUnitType,
    modules: readonly UnitDesignModuleDetail[]
  ): ResourceAmountMap {
    const baseCost = normalizeResourceCost(getPlayerUnitConfig(type).cost);
    const result = createEmptyResourceAmount();
    let manaMultiplier = 1;
    modules.forEach((detail) => {
      manaMultiplier *= detail.manaCostMultiplier;
    });
    result.mana = roundStat(baseCost.mana * Math.max(manaMultiplier, 0));
    result.sanity = 0;
    return result;
  }

  private computeRuntime(
    modules: readonly UnitDesignModuleDetail[]
  ): PlayerUnitRuntimeModifiers {
    let rewardMultiplier = 1;
    let damageTransferPercent = 0;
    let damageTransferRadius = PERFORATOR_RADIUS;
    let attackStackBonusPerHit = 0;
    let attackStackBonusCap = 0;

    modules.forEach((detail) => {
      switch (detail.id) {
        case "magnet":
          rewardMultiplier = Math.max(detail.bonusValue, 1);
          break;
        case "perforator":
          damageTransferPercent = Math.max(detail.bonusValue, 0);
          break;
        case "internalFurnace": {
          const level = Math.max(detail.level, 1);
          attackStackBonusPerHit = Math.max(detail.bonusValue, 0);
          attackStackBonusCap = Math.max(1 + 0.1 * (level - 1), 0);
          break;
        }
        default:
          break;
      }
    });

    return {
      rewardMultiplier,
      damageTransferPercent,
      damageTransferRadius,
      attackStackBonusPerHit,
      attackStackBonusCap,
    };
  }

  private createBlueprint(
    type: PlayerUnitType,
    bonusValues: BonusValueMap,
    modules: readonly UnitDesignModuleDetail[]
  ): PlayerUnitBlueprintStats {
    const blueprint = computePlayerUnitBlueprint(type, bonusValues);
    const bonuses: PlayerUnitBonusLine[] = modules.map((detail) =>
      this.createBonusLine(detail)
    );
    let hpMultiplier = 1;
    let attackMultiplier = 1;
    let armorMultiplier = 1;

    modules.forEach((detail) => {
      switch (detail.id) {
        case "vitalHull":
          hpMultiplier *= Math.max(detail.bonusValue, 0);
          break;
        case "ironForge":
          attackMultiplier *= Math.max(detail.bonusValue, 0);
          break;
        case "silverArmor":
          armorMultiplier *= Math.max(detail.bonusValue, 0);
          break;
        default:
          break;
      }
    });

    const appliedHpMultiplier = Math.max(hpMultiplier, 0);
    const appliedAttackMultiplier = Math.max(attackMultiplier, 0);
    const appliedArmorMultiplier = Math.max(armorMultiplier, 0);
    const effectiveMaxHp = roundStat(blueprint.effective.maxHp * appliedHpMultiplier);
    const effectiveAttackDamage = roundStat(
      blueprint.effective.attackDamage * appliedAttackMultiplier
    );
    const hpRegenPerSecond = roundStat(
      (blueprint.hpRegenPercentage * 0.01) * effectiveMaxHp
    );
    const effectiveArmor = roundStat(blueprint.armor * appliedArmorMultiplier);

    return {
      ...blueprint,
      effective: {
        attackDamage: effectiveAttackDamage,
        maxHp: Math.max(effectiveMaxHp, 1),
      },
      multipliers: {
        attackDamage: blueprint.multipliers.attackDamage * appliedAttackMultiplier,
        maxHp: blueprint.multipliers.maxHp * appliedHpMultiplier,
      },
      hpRegenPerSecond,
      armor: Math.max(effectiveArmor, 0),
      bonuses,
    };
  }

  private createBonusLine(detail: UnitDesignModuleDetail): PlayerUnitBonusLine {
    switch (detail.id) {
      case "magnet":
        return {
          label: detail.bonusLabel,
          value: detail.bonusValue,
          format: "multiplier",
        };
      case "perforator":
        return {
          label: detail.bonusLabel,
          value: detail.bonusValue,
          format: "percent",
          hint: `within ${PERFORATOR_RADIUS} units`,
        };
      case "silverArmor":
        return {
          label: detail.bonusLabel,
          value: detail.bonusValue,
          format: "multiplier",
        };
      case "burningTail":
        return {
          label: detail.bonusLabel,
          value: detail.bonusValue,
          format: "percent",
          hint: "Applies for 4s",
        };
      case "freezingTail": {
        const divisor = Math.max(detail.bonusValue, 0);
        return {
          label: detail.bonusLabel,
          value: divisor,
          format: "multiplier",
          hint: "Divides enemy damage for 4s",
        };
      }
      case "internalFurnace": {
        const level = Math.max(detail.level, 1);
        const capPercent = Math.max(1 + 0.1 * (level - 1), 0) * 100;
        const roundedCap = Math.round(capPercent * 10) / 10;
        return {
          label: detail.bonusLabel,
          value: detail.bonusValue,
          format: "percent",
          hint: `Stacks up to +${roundedCap}% attack`,
        };
      }
      default:
        return {
          label: detail.bonusLabel,
          value: detail.bonusValue,
          format: detail.bonusType === "percent" ? "percent" : "multiplier",
        };
    }
  }

  private computeModuleValue(
    type: UnitModuleBonusType,
    base: number,
    perLevel: number,
    level: number
  ): number {
    if (level <= 0) {
      return 0;
    }
    const sanitizedBase = Number.isFinite(base) ? base : 0;
    const sanitizedPerLevel = Number.isFinite(perLevel) ? perLevel : 0;
    const value = sanitizedBase + sanitizedPerLevel * (level - 1);
    if (type === "multiplier") {
      return Math.max(value, 0);
    }
    return Math.max(value, 0);
  }

  private sanitizeModules(modules: readonly UnitModuleId[]): UnitModuleId[] {
    const unique: UnitModuleId[] = [];
    modules.forEach((moduleId) => {
      if (!UNIT_MODULE_IDS.includes(moduleId)) {
        return;
      }
      if (this.workshop.getModuleLevel(moduleId) <= 0) {
        return;
      }
      if (unique.includes(moduleId)) {
        return;
      }
      unique.push(moduleId);
    });
    return unique.slice(0, MAX_MODULES_PER_UNIT);
  }

  private areModulesEqual(a: readonly UnitModuleId[], b: readonly UnitModuleId[]): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => value === b[index]);
  }

  private sanitizeUnitType(type: PlayerUnitType | undefined): PlayerUnitType {
    if (isPlayerUnitType(type)) {
      return type;
    }
    return "bluePentagon";
  }

  private createDesignId(): UnitDesignId {
    this.idCounter += 1;
    return `unit-${this.idCounter}`;
  }

  private extractCounter(id: string): number {
    const match = /unit-(\d+)/.exec(id);
    if (!match) {
      return 0;
    }
    const value = Number.parseInt(match[1] ?? "0", 10);
    return Number.isFinite(value) ? value : 0;
  }
}
