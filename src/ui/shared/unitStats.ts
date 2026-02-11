import { PlayerUnitBlueprintStats } from "@shared/types/player-units";
import { formatNumber } from "./format/number";

export interface UnitStatEntry {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}

export type UnitStatsTranslator = (key: string, fallback: string) => string;

const interpolate = (template: string, values: Record<string, string | number>): string => {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{{${key}}}`).join(String(value)),
    template
  );
};

const formatBaseHint = (base: number, multiplier: number, t?: UnitStatsTranslator): string => {
  const translate: UnitStatsTranslator = t ?? ((_, fallback) => fallback);
  const baseValue = formatNumber(base);
  const multiplierDelta = Math.abs(multiplier - 1);
  if (multiplierDelta < 0.0001) {
    return interpolate(translate("voidCamp.unitStats.base", "Base {{value}}"), {
      value: baseValue,
    });
  }
  return interpolate(
    translate("voidCamp.unitStats.baseTimes", "Base {{value}} ×{{multiplier}}"),
    {
      value: baseValue,
      multiplier: formatNumber(multiplier, {
        maximumFractionDigits: 2,
      }),
    }
  );
};

const formatCritChanceHint = (base: number, bonus: number, t?: UnitStatsTranslator): string => {
  const translate: UnitStatsTranslator = t ?? ((_, fallback) => fallback);
  const basePercent = formatNumber(base * 100, {
    maximumFractionDigits: 1,
  });
  const bonusPercent = Math.abs(bonus) * 100;
  if (bonusPercent < 0.0001) {
    return interpolate(translate("voidCamp.unitStats.basePercent", "Base {{value}}%"), {
      value: basePercent,
    });
  }
  const formattedBonus = formatNumber(bonusPercent, {
    maximumFractionDigits: 1,
  });
  const sign = bonus >= 0 ? "+" : "-";
  return interpolate(
    translate("voidCamp.unitStats.basePercentBonus", "Base {{value}}% {{sign}}{{bonus}}%"),
    {
      value: basePercent,
      sign,
      bonus: formattedBonus,
    }
  );
};

const formatCritMultiplierHint = (base: number, multiplier: number, t?: UnitStatsTranslator): string => {
  const translate: UnitStatsTranslator = t ?? ((_, fallback) => fallback);
  const multiplierDelta = Math.abs(multiplier - 1);
  if (multiplierDelta < 0.0001) {
    return interpolate(
      translate("voidCamp.unitStats.base", "Base {{value}}"),
      { value: formatNumber(base, { maximumFractionDigits: 2 }) }
    );
  }
  return interpolate(
    translate("voidCamp.unitStats.baseTimes", "Base {{value}} ×{{multiplier}}"),
    {
      value: formatNumber(base, { maximumFractionDigits: 2 }),
      multiplier: formatNumber(multiplier, {
        maximumFractionDigits: 2,
      }),
    }
  );
};

export const buildUnitStatEntries = (
  blueprint: PlayerUnitBlueprintStats,
  t?: UnitStatsTranslator
): UnitStatEntry[] => {
  const translate: UnitStatsTranslator = t ?? ((_, fallback) => fallback);
  const entries: UnitStatEntry[] = [
    {
      label: translate("voidCamp.unitStats.hp", "HP"),
      value: formatNumber(blueprint.effective.maxHp),
      hint: formatBaseHint(blueprint.base.maxHp, blueprint.multipliers.maxHp, t),
    },
    {
      label: translate("voidCamp.unitStats.attack", "Attack"),
      value: (() => {
        const mean = blueprint.effective.attackDamage;
        const minMul = blueprint.damageVariance?.minMultiplier ?? 1;
        const maxMul = blueprint.damageVariance?.maxMultiplier ?? 1;
        const min = mean * Math.max(minMul, 0);
        const max = mean * Math.max(maxMul, 0);
        return `${formatNumber(min)}–${formatNumber(max)} ${translate("voidCamp.unitStats.damageSuffix", "dmg")}`;
      })(),
      hint: formatBaseHint(
        blueprint.base.attackDamage,
        blueprint.multipliers.attackDamage,
        t
      ),
    },
    {
      label: translate("voidCamp.unitStats.critChance", "Crit Chance"),
      value: `${formatNumber(blueprint.critChance.effective * 100, {
        maximumFractionDigits: 1,
      })}%`,
      hint: formatCritChanceHint(
        blueprint.critChance.base,
        blueprint.critChance.bonus,
        t
      ),
    },
    {
      label: translate("voidCamp.unitStats.critMultiplier", "Crit Multiplier"),
      value: `${formatNumber(blueprint.critMultiplier.effective, {
        maximumFractionDigits: 2,
      })}×`,
      hint: formatCritMultiplierHint(
        blueprint.critMultiplier.base,
        blueprint.critMultiplier.multiplier,
        t
      ),
    },
    {
      label: translate("voidCamp.unitStats.armor", "Armor"),
      value: formatNumber(blueprint.armor, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    },
    {
      label: translate("voidCamp.unitStats.hpRegen", "HP Regen"),
      value: `${formatNumber(blueprint.hpRegenPerSecond, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${translate("voidCamp.unitStats.hpPerSecond", "HP/s")}`,
      hint: interpolate(
        translate("voidCamp.unitStats.hpRegenHint", "{{value}}% of max HP per second"),
        {
          value: formatNumber(blueprint.hpRegenPercentage, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        }
      ),
    },
    {
      label: translate("voidCamp.unitStats.armorPenetration", "Armor Penetration"),
      value: formatNumber(blueprint.armorPenetration, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      hint: translate(
        "voidCamp.unitStats.armorPenetrationHint",
        "Reduces brick armor before damage is applied."
      ),
    },
    {
      label: translate("voidCamp.unitStats.range", "Range"),
      value: `${formatNumber(blueprint.baseAttackDistance, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${translate("voidCamp.unitStats.units", "units")}`,
    },
    {
      label: translate("voidCamp.unitStats.moveSpeed", "Move Speed"),
      value: `${formatNumber(blueprint.moveSpeed, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${translate("voidCamp.unitStats.unitsPerSecond", "u/s")}`,
    },
    {
      label: translate("voidCamp.unitStats.acceleration", "Acceleration"),
      value: `${formatNumber(blueprint.moveAcceleration, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${translate("voidCamp.unitStats.unitsPerSecondSq", "u/s²")}`,
    },
  ];

  if (Array.isArray(blueprint.bonuses)) {
    blueprint.bonuses.forEach((bonus) => {
      entries.push({
        label: bonus.label,
        value: bonus.format === "percent"
          ? `${formatNumber(bonus.value * 100, { maximumFractionDigits: 1 })}%`
          : bonus.format === "multiplier"
          ? `${formatNumber(bonus.value, { maximumFractionDigits: 2 })}×`
          : formatNumber(bonus.value),
        hint: bonus.hint,
      });
    });
  }

  return entries;
};
