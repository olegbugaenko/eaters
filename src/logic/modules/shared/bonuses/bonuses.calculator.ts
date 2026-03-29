import { BonusEffectContext, BonusEffectType } from "@shared/types/bonuses";
import { BonusId, getBonusConfig } from "../../../../db/bonuses-db";
import type {
  BonusRule,
  BonusRuleContextInput,
  BonusSourceState,
  BonusValueMap,
} from "./bonuses.types";
import { createBonusValueMap, sanitizeEffectValue } from "./bonuses.helpers";
import type { BonusEffectFormula } from "@shared/types/bonuses";

export interface BonusCalculatorInput {
  sources: Iterable<BonusSourceState>;
  effectContext: BonusEffectContext;
  rules: BonusRule[];
  ruleContext: BonusRuleContextInput;
}

export class BonusCalculator {
  public static calculate({
    sources,
    effectContext,
    rules,
    ruleContext,
  }: BonusCalculatorInput): BonusValueMap {
    const effectEntriesByBonus = new Map<
      BonusId,
      Array<{ readonly effectType: string; readonly level: number; readonly formula: BonusEffectFormula }>
    >();

    for (const source of sources) {
      const level = source.level;
      Object.entries(source.effects).forEach(([bonusId, effectTypes]) => {
        if (!effectTypes) {
          return;
        }
        const id = bonusId as BonusId;
        const entries = effectEntriesByBonus.get(id) ?? [];
        Object.entries(effectTypes).forEach(([effectType, formula]) => {
          entries.push({
            effectType,
            level,
            formula,
          });
        });
        effectEntriesByBonus.set(id, entries);
      });
    }

    const memo = new Map<BonusId, number>();
    const visiting = new Set<BonusId>();
    const progression = new Set<string>(ruleContext.progressionKeys ?? []);
    const runtimeFlags = new Set<string>(ruleContext.runtimeFlags ?? []);

    const resolveBonusValue = (id: BonusId): number => {
      const cached = memo.get(id);
      if (cached !== undefined) {
        return cached;
      }
      if (visiting.has(id)) {
        const trail = [...visiting, id].join(" -> ");
        throw new Error(`Cyclic bonus dependency detected: ${trail}`);
      }
      visiting.add(id);

      let income = 0;
      let multiplier = 1;
      let baseOverride = Number.NaN;
      const entries = effectEntriesByBonus.get(id) ?? [];
      entries.forEach(({ effectType, level, formula }) => {
        const value = sanitizeEffectValue(
          formula(level, effectContext, { getBonusValue: resolveBonusValue }),
          effectType
        );
        switch (effectType as BonusEffectType) {
          case "income":
            income += value;
            break;
          case "multiplier":
            multiplier *= value;
            break;
          case "base":
            baseOverride = value;
            break;
          default:
            income += value;
            break;
        }
      });

      const ruleEffects = BonusCalculator.getRuleEffectsForBonus(
        id,
        rules,
        progression,
        runtimeFlags,
      );
      income += ruleEffects.addFlat;
      multiplier *= 1 + ruleEffects.addMultiplier;

      const config = getBonusConfig(id);
      const base = Number.isNaN(baseOverride) ? config.defaultValue : baseOverride;
      const resolved = (base + income) * multiplier;
      visiting.delete(id);
      memo.set(id, resolved);
      return resolved;
    };

    return createBonusValueMap((_config, id) => resolveBonusValue(id));
  }

  private static getRuleEffectsForBonus(
    bonusId: BonusId,
    rules: BonusRule[],
    progression: ReadonlySet<string>,
    runtimeFlags: ReadonlySet<string>,
  ): { addFlat: number; addMultiplier: number } {
    let addFlat = 0;
    let addMultiplier = 0;
    rules.forEach((rule) => {
      if (rule.bonusId !== bonusId) {
        return;
      }
      if (!BonusCalculator.areRuleRequirementsMet(rule, progression, runtimeFlags)) {
        return;
      }
      addFlat += rule.effects.addFlat ?? 0;
      addMultiplier += rule.effects.addMultiplier ?? 0;
    });
    return { addFlat, addMultiplier };
  }

  private static areRuleRequirementsMet(
    rule: BonusRule,
    progression: ReadonlySet<string>,
    runtimeFlags: ReadonlySet<string>,
  ): boolean {
    const { progressionKeys, runtimeFlags: requiredFlags } = rule.requires;
    if (progressionKeys?.length) {
      const hasAllProgression = progressionKeys.every((key) => progression.has(key));
      if (!hasAllProgression) {
        return false;
      }
    }
    if (requiredFlags?.length) {
      const hasAllFlags = requiredFlags.every((flag) => runtimeFlags.has(flag));
      if (!hasAllFlags) {
        return false;
      }
    }
    return true;
  }
}
