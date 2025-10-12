import { DataBridge } from "../core/DataBridge";
import { GameModule } from "../core/types";
import {
  PLAYER_UNIT_TYPES,
  PlayerUnitType,
  getPlayerUnitConfig,
  isPlayerUnitType,
} from "../../db/player-units-db";
import {
  UNIT_MODULE_IDS,
  UnitModuleId,
  UnitModuleBonusType,
  getUnitModuleConfig,
} from "../../db/unit-modules-db";
import { BonusValueMap, BonusesModule } from "./BonusesModule";
import { UnitModuleWorkshopModule } from "./UnitModuleWorkshopModule";
import {
  PlayerUnitBlueprintStats,
  PlayerUnitBonusLine,
  PlayerUnitRuntimeModifiers,
} from "../../types/player-units";
import {
  ResourceAmountMap,
  createEmptyResourceAmount,
  normalizeResourceCost,
} from "../../types/resources";
import {
  computePlayerUnitBlueprint,
  roundStat,
} from "./PlayerUnitsModule";

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
}

interface UnitDesignerSaveDataEntry {
  readonly id: string;
  readonly type: PlayerUnitType;
  readonly name: string;
  readonly modules: UnitModuleId[];
}

interface UnitDesignerSaveData {
  readonly units?: UnitDesignerSaveDataEntry[];
}

interface UnitDesignModuleOptions {
  bridge: DataBridge;
  bonuses: BonusesModule;
  workshop: UnitModuleWorkshopModule;
}

export const UNIT_DESIGNER_STATE_BRIDGE_KEY = "unitDesigner/state";

export const MAX_MODULES_PER_UNIT = 3;

export const DEFAULT_UNIT_DESIGNER_STATE: UnitDesignerBridgeState = Object.freeze({
  units: [],
  availableModules: [],
  maxModules: MAX_MODULES_PER_UNIT,
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
    this.ensureDefaults();
    this.refreshComputedState();
  }

  public load(data: unknown | undefined): void {
    this.designs.clear();
    this.designOrder = [];
    this.idCounter = 0;
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
    return { units } satisfies UnitDesignerSaveData;
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

  private applySaveData(data: unknown | undefined): void {
    if (!data || typeof data !== "object") {
      return;
    }
    const payload = (data as UnitDesignerSaveData).units;
    if (!Array.isArray(payload)) {
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
    });
  }

  private ensureDefaults(): void {
    PLAYER_UNIT_TYPES.forEach((type) => {
      if (!this.hasDesignForType(type)) {
        this.createDefaultDesign(type);
      }
    });
  }

  private hasDesignForType(type: PlayerUnitType): boolean {
    return this.designOrder.some((id) => this.designs.get(id)?.type === type);
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

    this.pushState(computed);
    this.listeners.forEach((listener) => listener(computed));
  }

  private computeDesignState(
    record: UnitDesignRecord,
    bonusValues: BonusValueMap
  ): UnitDesignerUnitState {
    const moduleDetails = this.createModuleDetails(record.modules);
    const blueprint = this.createBlueprint(record.type, bonusValues, moduleDetails);
    const cost = this.computeCost(record.type, moduleDetails);
    const runtime = this.computeRuntime(moduleDetails);
    return {
      id: record.id,
      type: record.type,
      name: record.name,
      modules: [...moduleDetails.map((detail) => detail.id)],
      moduleDetails,
      cost,
      blueprint,
      runtime,
    };
  }

  private pushState(units: UnitDesignerUnitState[]): void {
    const availableModules = this.createAvailableModules();
    this.bridge.setValue<UnitDesignerBridgeState>(UNIT_DESIGNER_STATE_BRIDGE_KEY, {
      units,
      availableModules,
      maxModules: MAX_MODULES_PER_UNIT,
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
    let sanityBonus = 0;
    modules.forEach((detail) => {
      manaMultiplier *= detail.manaCostMultiplier;
      sanityBonus += detail.sanityCost;
    });
    result.mana = roundStat(baseCost.mana * Math.max(manaMultiplier, 0));
    result.sanity = roundStat(baseCost.sanity + sanityBonus);
    return result;
  }

  private computeRuntime(
    modules: readonly UnitDesignModuleDetail[]
  ): PlayerUnitRuntimeModifiers {
    let rewardMultiplier = 1;
    let damageTransferPercent = 0;
    let damageTransferRadius = PERFORATOR_RADIUS;

    modules.forEach((detail) => {
      switch (detail.id) {
        case "magnet":
          rewardMultiplier = Math.max(detail.bonusValue, 1);
          break;
        case "perforator":
          damageTransferPercent = Math.max(detail.bonusValue, 0);
          break;
        default:
          break;
      }
    });

    return {
      rewardMultiplier,
      damageTransferPercent,
      damageTransferRadius,
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
    return {
      ...blueprint,
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
