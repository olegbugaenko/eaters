import { clampNumber } from "@shared/helpers/numbers.helper";

import { calculateMitigatedDamage, DamageFormulaOptions } from "./damage-formula";

export interface DamagePipelineInput extends DamageFormulaOptions {
  readonly currentHp: number;
  readonly maxHp?: number;
}

export interface DamagePipelineResult {
  readonly effectiveDamage: number;
  readonly appliedDamage: number;
  readonly remainingHp: number;
}

export const resolveDamageApplication = (options: DamagePipelineInput): DamagePipelineResult => {
  const effectiveDamage = calculateMitigatedDamage(options);
  const maxHp = options.maxHp ?? options.currentHp;
  const remainingHp = clampNumber(options.currentHp - effectiveDamage, 0, maxHp);
  const appliedDamage = Math.max(0, options.currentHp - remainingHp);

  return {
    effectiveDamage,
    appliedDamage,
    remainingHp,
  };
};
