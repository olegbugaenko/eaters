import { BonusEffectContext, BonusEffectType } from "@shared/types/bonuses";
import { BonusId, getBonusConfig } from "../../../../db/bonuses-db";
import type {
  BonusRule,
  BonusRuleContextInput,
  BonusSourceState,
  BonusValueMap,
} from "./bonuses.types";
import { createBonusValueMap, sanitizeEffectValue } from "./bonuses.helpers";

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
    const incomes = createBonusValueMap(() => 0);
    const multipliers = createBonusValueMap(() => 1);
    const baseOverrides = createBonusValueMap(() => Number.NaN);

    for (const source of sources) {
      const level = source.level;
      Object.entries(source.effects).forEach(([bonusId, effectTypes]) => {
        if (!effectTypes) {
          return;
        }
        const id = bonusId as BonusId;
        Object.entries(effectTypes).forEach(([effectType, formula]) => {
          const value = sanitizeEffectValue(formula(level, effectContext), effectType);
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
    }

    BonusCalculator.applyRuleEffects(incomes, multipliers, rules, ruleContext);

    return createBonusValueMap((config, id) => {
      const override = baseOverrides[id];
      const base = Number.isNaN(override) ? config.defaultValue : override;
      return (base + incomes[id]) * multipliers[id];
    });
  }

  private static applyRuleEffects(
    incomes: BonusValueMap,
    multipliers: BonusValueMap,
    rules: BonusRule[],
    ruleContext: BonusRuleContextInput,
  ): void {
    if (!rules.length) {
      return;
    }
    const progression = new Set(ruleContext.progressionKeys ?? []);
    const runtimeFlags = new Set(ruleContext.runtimeFlags ?? []);

    rules.forEach((rule) => {
      if (!BonusCalculator.areRuleRequirementsMet(rule, progression, runtimeFlags)) {
        return;
      }
      const bonusId = rule.bonusId;
      getBonusConfig(bonusId);
      const { addFlat = 0, addMultiplier = 0 } = rule.effects;
      if (addFlat !== 0) {
        incomes[bonusId] += addFlat;
      }
      if (addMultiplier !== 0) {
        multipliers[bonusId] *= 1 + addMultiplier;
      }
    });
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
