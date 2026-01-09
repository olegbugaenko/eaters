import { BaseGameModule } from "@/core/logic/engine/BaseGameModule";
import { BonusId, getBonusConfig } from "../../../../db/bonuses-db";
import {
  BonusEffectContext,
  BonusEffectFormula,
  BonusEffectMap,
  BonusEffectPreview,
  BonusEffectType,
} from "@shared/types/bonuses";
import type {
  BonusValueMap,
  BonusValuesListener,
  SanitizedBonusEffects,
  BonusSourceState,
} from "./bonuses.types";
import {
  createBonusValueMap,
  sanitizeLevel,
  sanitizeEffectValue,
  areBonusMapsEqual,
} from "./bonuses.helpers";

// Re-export types for backward compatibility
export type { BonusValueMap, BonusValuesListener } from "./bonuses.types";

export class BonusesModule extends BaseGameModule<BonusValuesListener> {
  public readonly id = "bonuses";

  private sources = new Map<string, BonusSourceState>();
  private cachedValues: BonusValueMap = createBonusValueMap((config) => config.defaultValue);
  private dirty = true;
  private effectContext: BonusEffectContext = {};

  public initialize(): void {
    this.ensureValues();
  }

  public reset(): void {
    this.sources.forEach((source) => {
      source.level = 0;
    });
    this.markDirty();
    this.ensureValues();
  }

  public load(_data: unknown | undefined): void {
    this.markDirty();
  }

  public save(): unknown {
    return undefined;
  }

  public tick(_deltaMs: number): void {
    // Bonuses are computed on demand.
  }

  public registerSource(sourceId: string, effects: BonusEffectMap | undefined): void {
    if (this.sources.has(sourceId)) {
      throw new Error(`Bonus source already registered: ${sourceId}`);
    }
    const sanitized = this.sanitizeEffects(effects);
    this.sources.set(sourceId, { id: sourceId, effects: sanitized, level: 0 });
    this.markDirty();
  }

  public unregisterSource(sourceId: string): void {
    if (!this.sources.delete(sourceId)) {
      return;
    }
    this.markDirty();
  }

  public setSourceLevel(sourceId: string, level: number): void {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`Unknown bonus source: ${sourceId}`);
    }
    const sanitizedLevel = sanitizeLevel(level);
    if (source.level === sanitizedLevel) {
      return;
    }
    source.level = sanitizedLevel;
    this.markDirty();
    this.ensureValues();
  }

  public setBonusCurrentLevel(sourceId: string, level: number): void {
    this.setSourceLevel(sourceId, level);
  }

  public getBonusValue(id: BonusId): number {
    this.ensureValues();
    return this.cachedValues[id] ?? getBonusConfig(id).defaultValue;
  }

  public getAllValues(): BonusValueMap {
    this.ensureValues();
    return { ...this.cachedValues };
  }

  public getBonusEffects(sourceId: string): BonusEffectPreview[] {
    const source = this.sources.get(sourceId);
    if (!source) {
      return [];
    }
    const level = source.level;
    const nextLevel = level + 1;
    const previews: BonusEffectPreview[] = [];

    Object.entries(source.effects).forEach(([bonusId, effectTypes]) => {
      if (!effectTypes) {
        return;
      }
      const config = getBonusConfig(bonusId as BonusId);
      Object.entries(effectTypes).forEach(([effectType, formula]) => {
        const currentValue = sanitizeEffectValue(
          formula(level, this.effectContext),
          effectType
        );
        const nextValue = sanitizeEffectValue(
          formula(nextLevel, this.effectContext),
          effectType
        );
        previews.push({
          bonusId: config.id,
          bonusName: config.name,
          effectType,
          currentValue,
          nextValue,
        });
      });
    });

    return previews.sort((a, b) => {
      if (a.bonusName === b.bonusName) {
        return a.effectType.localeCompare(b.effectType);
      }
      return a.bonusName.localeCompare(b.bonusName);
    });
  }

  public override subscribe(listener: BonusValuesListener): () => void {
    return super.subscribe(listener, () => {
      listener(this.getAllValues());
    });
  }

  private sanitizeEffects(effects: BonusEffectMap | undefined): SanitizedBonusEffects {
    const sanitized: SanitizedBonusEffects = {};
    if (!effects) {
      return sanitized;
    }

    Object.entries(effects).forEach(([bonusId, effectTypes]) => {
      if (!effectTypes) {
        return;
      }
      const id = bonusId as BonusId;
      getBonusConfig(id);
      Object.entries(effectTypes).forEach(([effectType, formula]) => {
        if (typeof formula !== "function") {
          return;
        }
        if (!sanitized[id]) {
          sanitized[id] = {} as Record<string, BonusEffectFormula>;
        }
        sanitized[id]![effectType] = formula;
      });
    });

    return sanitized;
  }

  private ensureValues(): void {
    if (!this.dirty) {
      return;
    }
    const previous = this.cachedValues;
    const incomes = createBonusValueMap(() => 0);
    const multipliers = createBonusValueMap(() => 1);
    const baseOverrides = createBonusValueMap(() => Number.NaN);

    this.sources.forEach((source) => {
      const level = source.level;
      Object.entries(source.effects).forEach(([bonusId, effectTypes]) => {
        if (!effectTypes) {
          return;
        }
        const id = bonusId as BonusId;
        Object.entries(effectTypes).forEach(([effectType, formula]) => {
          const value = sanitizeEffectValue(formula(level, this.effectContext), effectType);
          switch (effectType as BonusEffectType) {
            case "income":
              incomes[id] += value;
              break;
            case "multiplier":
              multipliers[id] *= value;
              break;
            case "base":
              baseOverrides[id] = value;
              break;
            default:
              incomes[id] += value;
              break;
          }
        });
      });
    });

    const next = createBonusValueMap((config, id) => {
      const override = baseOverrides[id];
      const base = Number.isNaN(override) ? config.defaultValue : override;
      return (base + incomes[id]) * multipliers[id];
    });

    this.cachedValues = next;
    this.dirty = false;

    if (!areBonusMapsEqual(previous, next)) {
      this.notifyListeners();
    }
  }

  private markDirty(): void {
    this.dirty = true;
  }

  public setEffectContext(context: BonusEffectContext): void {
    const sanitized = context ?? {};
    const nextContext = { ...this.effectContext, ...sanitized };
    const keys = new Set([...Object.keys(this.effectContext), ...Object.keys(nextContext)]);
    const changed = Array.from(keys).some((key) => this.effectContext[key] !== nextContext[key]);
    if (!changed) {
      return;
    }
    this.effectContext = nextContext;
    this.markDirty();
    this.ensureValues();
    this.notifyListeners();
  }

  protected override notifyListeners(): void {
    const snapshot = this.getAllValues();
    this.notifyListenersWith((listener) => listener(snapshot));
  }
}

