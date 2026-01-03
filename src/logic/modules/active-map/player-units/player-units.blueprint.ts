import { getPlayerUnitConfig, PlayerUnitType } from "../../../../db/player-units-db";
import { getBonusConfig } from "../../../../db/bonuses-db";
import { BonusValueMap } from "../../shared/bonuses/bonuses.module";
import { PlayerUnitBlueprintStats } from "@shared/types/player-units";
import { clampProbability } from "@shared/helpers/numbers.helper";
import {
  sanitizeMultiplier,
  sanitizeAdditive,
  normalizeMultiplier,
  roundStat,
} from "../../../../shared/helpers/numbers.helper";

const DEFAULT_CRIT_MULTIPLIER_BONUS = getBonusConfig(
  "all_units_crit_mult"
).defaultValue;

export const computePlayerUnitBlueprint = (
  type: PlayerUnitType,
  values: BonusValueMap
): PlayerUnitBlueprintStats => {
  const config = getPlayerUnitConfig(type);
  const baseAttack = Math.max(config.baseAttackDamage, 0);
  const baseHp = Math.max(config.maxHp, 0);
  const baseInterval = Math.max(config.baseAttackInterval, 0.01);
  const baseDistance = Math.max(config.baseAttackDistance, 0);
  const baseMoveSpeed = Math.max(config.moveSpeed, 0);
  const baseMoveAcceleration = Math.max(config.moveAcceleration, 0);
  const baseMass = Math.max(config.mass, 0.001);
  const baseSize = Math.max(config.physicalSize, 0);
  const baseCritChance = clampProbability(config.baseCritChance ?? 0);
  const baseCritMultiplier = Math.max(
    config.baseCritMultiplier ?? DEFAULT_CRIT_MULTIPLIER_BONUS,
    1
  );

  const globalAttackMultiplier = sanitizeMultiplier(
    values["all_units_attack_multiplier"],
    1
  );
  const globalHpMultiplier = sanitizeMultiplier(values["all_units_hp_multiplier"], 1);
  const globalArmorBonus = sanitizeAdditive(values["all_units_armor"], 0);
  const globalCritChanceBonus = sanitizeAdditive(values["all_units_crit_chance"], 0);
  const globalCritMultiplierRaw = sanitizeMultiplier(
    values["all_units_crit_mult"],
    DEFAULT_CRIT_MULTIPLIER_BONUS
  );
  const globalCritMultiplier = normalizeMultiplier(
    globalCritMultiplierRaw,
    DEFAULT_CRIT_MULTIPLIER_BONUS
  );
  const globalHpRegenPercentage = Math.max(
    sanitizeAdditive(values["all_units_hp_regen_percentage"], 0),
    0
  );
  const globalArmorPenetration = Math.max(
    sanitizeAdditive(values["all_units_armor_penetration"], 0),
    0
  );

  let specificAttackMultiplier = 1;
  let specificHpMultiplier = 1;
  let specificCritChanceBonus = 0;
  let specificCritMultiplier = 1;

  switch (type) {
    case "bluePentagon":
      specificAttackMultiplier = sanitizeMultiplier(
        values["blue_vanguard_attack_multiplier"],
        1
      );
      specificHpMultiplier = sanitizeMultiplier(
        values["blue_vanguard_hp_multiplier"],
        1
      );
      break;
    default:
      break;
  }

  const attackMultiplier = Math.max(globalAttackMultiplier, 0) * Math.max(specificAttackMultiplier, 0);
  const hpMultiplier = Math.max(globalHpMultiplier, 0) * Math.max(specificHpMultiplier, 0);
  const critMultiplierMultiplier =
    Math.max(globalCritMultiplier, 0) * Math.max(specificCritMultiplier, 0);
  const totalCritChanceBonus = globalCritChanceBonus + specificCritChanceBonus;

  const effectiveAttack = roundStat(baseAttack * attackMultiplier);
  const effectiveHp = roundStat(baseHp * hpMultiplier);
  const effectiveCritMultiplier = roundStat(
    baseCritMultiplier * Math.max(critMultiplierMultiplier, 0)
  );
  const effectiveCritChance = clampProbability(baseCritChance + totalCritChanceBonus);
  const hpRegenPerSecond = roundStat(
    Math.max(effectiveHp, 0) * (globalHpRegenPercentage * 0.01)
  );

  return {
    type,
    name: config.name,
    base: {
      attackDamage: baseAttack,
      maxHp: baseHp,
    },
    damageVariance: { minMultiplier: 0.8, maxMultiplier: 1.2 },
    effective: {
      attackDamage: effectiveAttack,
      maxHp: Math.max(effectiveHp, 1),
    },
    multipliers: {
      attackDamage: attackMultiplier,
      maxHp: hpMultiplier,
    },
    critChance: {
      base: baseCritChance,
      bonus: effectiveCritChance - baseCritChance,
      effective: effectiveCritChance,
    },
    critMultiplier: {
      base: baseCritMultiplier,
      multiplier: Math.max(critMultiplierMultiplier, 0),
      effective: Math.max(effectiveCritMultiplier, 1),
    },
    armor: Math.max(config.armor, 0) + globalArmorBonus,
    hpRegenPerSecond,
    hpRegenPercentage: globalHpRegenPercentage,
    armorPenetration: globalArmorPenetration,
    baseAttackInterval: baseInterval,
    baseAttackDistance: baseDistance,
    moveSpeed: baseMoveSpeed,
    moveAcceleration: baseMoveAcceleration,
    mass: baseMass,
    physicalSize: baseSize,
  };
};
