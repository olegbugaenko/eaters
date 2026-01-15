import { clampNumber } from "@shared/helpers/numbers.helper";
import { calculateMitigatedDamage } from "./damage-formula";

export interface DamageOptionInput {
  readonly rewardMultiplier?: number;
  readonly armorPenetration?: number;
  readonly overTime?: number;
  readonly skipKnockback?: boolean;
}

export interface DamageOptions {
  readonly rewardMultiplier: number;
  readonly armorPenetration: number;
  readonly overTime: number;
  readonly skipKnockback: boolean;
}

export const sanitizeDamageOptions = (options?: DamageOptionInput): DamageOptions => ({
  rewardMultiplier: clampNumber(options?.rewardMultiplier ?? 1, 0, Number.POSITIVE_INFINITY),
  armorPenetration: clampNumber(options?.armorPenetration ?? 0, 0, Number.POSITIVE_INFINITY),
  overTime: clampNumber(options?.overTime ?? 1, 0, Number.POSITIVE_INFINITY),
  skipKnockback: options?.skipKnockback === true,
});

export interface DamagePipelineInput {
  readonly rawDamage: number;
  readonly armor: number;
  readonly armorDelta?: number;
  readonly armorPenetration?: number;
  readonly incomingMultiplier?: number;
  readonly overTime?: number;
  readonly currentHp: number;
  readonly maxHp: number;
}

export interface DamagePipelineCallbacks {
  readonly onInflicted?: (inflictedDamage: number) => void;
  readonly onKnockback?: (inflictedDamage: number) => void;
}

export interface DamagePipelineOptions {
  readonly skipKnockback?: boolean;
}

export interface DamagePipelineResult {
  readonly inflictedDamage: number;
  readonly appliedDamage: number;
  readonly nextHp: number;
}

export const applyDamagePipeline = (
  input: DamagePipelineInput,
  options: DamagePipelineOptions = {},
  callbacks: DamagePipelineCallbacks = {},
): DamagePipelineResult => {
  if (input.rawDamage <= 0) {
    return { inflictedDamage: 0, appliedDamage: 0, nextHp: input.currentHp };
  }

  const armorPenetration = clampNumber(input.armorPenetration ?? 0, 0, Number.POSITIVE_INFINITY);
  const overTime = clampNumber(input.overTime ?? 1, 0, Number.POSITIVE_INFINITY);
  const appliedDamage = calculateMitigatedDamage({
    rawDamage: input.rawDamage,
    armor: input.armor,
    armorDelta: input.armorDelta,
    armorPenetration,
    incomingMultiplier: input.incomingMultiplier,
    overTime,
  });

  if (appliedDamage <= 0) {
    return { inflictedDamage: 0, appliedDamage, nextHp: input.currentHp };
  }

  const nextHp = clampNumber(input.currentHp - appliedDamage, 0, input.maxHp);
  const inflictedDamage = Math.max(0, input.currentHp - nextHp);
  if (inflictedDamage > 0) {
    callbacks.onInflicted?.(inflictedDamage);
    if (options.skipKnockback !== true) {
      callbacks.onKnockback?.(inflictedDamage);
    }
  }

  return { inflictedDamage, appliedDamage, nextHp };
};
