import { PlayerUnitBlueprintStats } from "../../types/player-units";
import { formatNumber } from "./format/number";

export interface UnitStatEntry {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}

const formatBaseHint = (base: number, multiplier: number): string => {
  const baseValue = formatNumber(base);
  const multiplierDelta = Math.abs(multiplier - 1);
  if (multiplierDelta < 0.0001) {
    return `Base ${baseValue}`;
  }
  return `Base ${baseValue} ×${formatNumber(multiplier, {
    maximumFractionDigits: 2,
  })}`;
};

const formatCritChanceHint = (base: number, bonus: number): string => {
  const basePercent = formatNumber(base * 100, {
    maximumFractionDigits: 1,
  });
  const bonusPercent = Math.abs(bonus) * 100;
  if (bonusPercent < 0.0001) {
    return `Base ${basePercent}%`;
  }
  const formattedBonus = formatNumber(bonusPercent, {
    maximumFractionDigits: 1,
  });
  const sign = bonus >= 0 ? "+" : "-";
  return `Base ${basePercent}% ${sign}${formattedBonus}%`;
};

const formatCritMultiplierHint = (base: number, multiplier: number): string => {
  const multiplierDelta = Math.abs(multiplier - 1);
  if (multiplierDelta < 0.0001) {
    return `Base ${formatNumber(base, { maximumFractionDigits: 2 })}`;
  }
  return `Base ${formatNumber(base, { maximumFractionDigits: 2 })} ×${formatNumber(multiplier, {
    maximumFractionDigits: 2,
  })}`;
};

export const buildUnitStatEntries = (
  blueprint: PlayerUnitBlueprintStats
): UnitStatEntry[] => {
  const entries: UnitStatEntry[] = [
    {
      label: "HP",
      value: formatNumber(blueprint.effective.maxHp),
      hint: formatBaseHint(blueprint.base.maxHp, blueprint.multipliers.maxHp),
    },
    {
      label: "Attack",
      value: `${formatNumber(blueprint.effective.attackDamage)} dmg`,
      hint: formatBaseHint(
        blueprint.base.attackDamage,
        blueprint.multipliers.attackDamage
      ),
    },
    {
      label: "Crit Chance",
      value: `${formatNumber(blueprint.critChance.effective * 100, {
        maximumFractionDigits: 1,
      })}%`,
      hint: formatCritChanceHint(
        blueprint.critChance.base,
        blueprint.critChance.bonus
      ),
    },
    {
      label: "Crit Multiplier",
      value: `${formatNumber(blueprint.critMultiplier.effective, {
        maximumFractionDigits: 2,
      })}×`,
      hint: formatCritMultiplierHint(
        blueprint.critMultiplier.base,
        blueprint.critMultiplier.multiplier
      ),
    },
    {
      label: "Armor",
      value: formatNumber(blueprint.armor, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    },
    {
      label: "HP Regen",
      value: `${formatNumber(blueprint.hpRegenPerSecond, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} HP/s`,
      hint: `${formatNumber(blueprint.hpRegenPercentage, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}% of max HP per second`,
    },
    {
      label: "Armor Penetration",
      value: formatNumber(blueprint.armorPenetration, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      hint: "Reduces brick armor before damage is applied.",
    },
    {
      label: "Range",
      value: `${formatNumber(blueprint.baseAttackDistance, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} units`,
    },
    {
      label: "Move Speed",
      value: `${formatNumber(blueprint.moveSpeed, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} u/s`,
    },
    {
      label: "Acceleration",
      value: `${formatNumber(blueprint.moveAcceleration, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} u/s²`,
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
