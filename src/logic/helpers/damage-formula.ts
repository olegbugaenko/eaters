export interface DamageFormulaOptions {
  readonly rawDamage: number;
  readonly armor: number;
  readonly armorDelta?: number;
  readonly armorPenetration?: number;
  readonly incomingMultiplier?: number;
  readonly overTime?: number;
}

export const calculateMitigatedDamage = (options: DamageFormulaOptions): number => {
  const armorPenetration = Math.max(options.armorPenetration ?? 0, 0);
  const armorDelta = options.armorDelta ?? 0;
  const effectiveArmor =
    Math.max(options.armor + armorDelta - armorPenetration, 0) * (options.overTime ?? 1);
  const incomingMultiplier = Math.max(options.incomingMultiplier ?? 1, 1);
  const armorDmgMitigation = options.rawDamage / (options.rawDamage + effectiveArmor + 0.001);
  return Math.max(options.rawDamage * armorDmgMitigation, 0) * incomingMultiplier;
};
