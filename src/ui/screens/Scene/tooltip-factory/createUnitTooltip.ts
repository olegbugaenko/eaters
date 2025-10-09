import { PlayerUnitBlueprintStats } from "../../../../types/player-units";
import { formatNumber } from "../../../shared/format/number";
import { SceneTooltipContent } from "../SceneTooltipPanel";

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

export const createUnitTooltip = (
  blueprint: PlayerUnitBlueprintStats
): SceneTooltipContent => {
  const dps = blueprint.baseAttackInterval > 0
    ? blueprint.effective.attackDamage / blueprint.baseAttackInterval
    : blueprint.effective.attackDamage;

  return {
    title: blueprint.name,
    subtitle: "Includes current bonuses",
    stats: [
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
        label: "Attack Interval",
        value: `${formatNumber(blueprint.baseAttackInterval, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} s`,
      },
      {
        label: "Damage / Sec",
        value: `${formatNumber(dps, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} dmg/s`,
        hint: `Interval ${formatNumber(blueprint.baseAttackInterval, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} s`,
      },
      {
        label: "Armor",
        value: formatNumber(blueprint.armor, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
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
    ],
    footer: "Hover other elements to inspect their bonuses.",
  };
};
