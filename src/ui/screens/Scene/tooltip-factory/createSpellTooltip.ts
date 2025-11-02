import { SpellOption } from "../../../../logic/modules/active-map/SpellcastingModule";
import { SceneTooltipContent } from "../SceneTooltipPanel";
import { formatNumber } from "../../../shared/format/number";

const formatDamageRange = (min: number, max: number): string => {
  const clampedMin = Math.max(min, 0);
  const clampedMax = Math.max(max, clampedMin);
  const formattedMin = formatNumber(clampedMin, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
    compact: false,
  });
  const formattedMax = formatNumber(clampedMax, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
    compact: false,
  });
  if (clampedMin === clampedMax) {
    return formattedMin;
  }
  return `${formattedMin} – ${formattedMax}`;
};

const formatSpellCost = (cost: SpellOption["cost"]): string => {
  const parts: string[] = [];

  const appendCost = (key: string, label: string) => {
    const value = cost[key];
    if (typeof value !== "number" || value <= 0) {
      return;
    }
    parts.push(
      `${formatNumber(value, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
        compact: false,
      })} ${label}`,
    );
  };

  appendCost("mana", "Mana");
  appendCost("sanity", "Sanity");

  Object.keys(cost).forEach((key) => {
    if (key === "mana" || key === "sanity") {
      return;
    }
    appendCost(
      key,
      key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    );
  });

  if (parts.length === 0) {
    return "None";
  }

  return parts.join(", ");
};

export const createSpellTooltip = (spell: SpellOption): SceneTooltipContent => {
  const effectiveMin = spell.damage.min * spell.spellPowerMultiplier;
  const effectiveMax = spell.damage.max * spell.spellPowerMultiplier;
  const baseDamageLabel = formatDamageRange(spell.damage.min, spell.damage.max);
  const multiplierLabel = formatNumber(spell.spellPowerMultiplier, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    compact: false,
  });

  const stats = [
    {
      label: "Damage",
      value: formatDamageRange(effectiveMin, effectiveMax),
      hint: `Base ${baseDamageLabel} · Spell Power ${multiplierLabel}×`,
    },
    {
      label: "Cooldown",
      value: `${formatNumber(spell.cooldownSeconds, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        compact: false,
      })} s`,
    },
    {
      label: "Cost",
      value: formatSpellCost(spell.cost),
    },
  ];

  if (spell.spellPowerMultiplier > 0) {
    stats.push({
      label: "Spell Power",
      value: `${multiplierLabel}×`,
      hint: "Applies to all spells.",
    });
  }

  return {
    title: spell.name,
    subtitle: spell.description,
    stats,
    footer: "Spell stats include current bonuses.",
  };
};
