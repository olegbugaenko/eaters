import type {
  ProjectileSpellOption,
  PersistentAoeSpellOption,
  SpellOption,
  WhirlSpellOption,
} from "@logic/modules/active-map/spellcasting/spellcasting.types";
import { SceneTooltipContent, SceneTooltipStat } from "../../tooltip/SceneTooltipPanel";
import { formatNumber } from "@ui-shared/format/number";

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

const appendProjectileStats = (
  spell: ProjectileSpellOption,
  stats: SceneTooltipStat[],
): void => {
  const effectiveMin = spell.damage.min * spell.spellPowerMultiplier;
  const effectiveMax = spell.damage.max * spell.spellPowerMultiplier;
  const baseDamageLabel = formatDamageRange(spell.damage.min, spell.damage.max);
  const multiplierLabel = formatNumber(spell.spellPowerMultiplier, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    compact: false,
  });

  stats.push({
    label: "Damage",
    value: formatDamageRange(effectiveMin, effectiveMax),
    hint: `Base ${baseDamageLabel} · Spell Power ${multiplierLabel}×`,
  });
};

const appendWhirlStats = (
  spell: WhirlSpellOption,
  stats: SceneTooltipStat[],
): void => {
  const multiplierLabel = formatNumber(spell.spellPowerMultiplier, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    compact: false,
  });
  const effectiveDps = spell.damagePerSecond * spell.spellPowerMultiplier;
  const totalCapacity = spell.maxHealth * spell.spellPowerMultiplier;

  stats.push({
    label: "Damage / s",
    value: formatNumber(effectiveDps, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      compact: false,
    }),
    hint: `Base ${formatNumber(spell.damagePerSecond, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      compact: false,
    })} · Spell Power ${multiplierLabel}×`,
  });

  stats.push({
    label: "Total Capacity",
    value: formatNumber(totalCapacity, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      compact: false,
    }),
    hint: `Storm dissipates after dealing ${formatNumber(spell.maxHealth, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      compact: false,
    })} base damage.`,
  });

  stats.push({
    label: "Radius",
    value: `${formatNumber(spell.radius, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      compact: false,
    })} u`,
  });

  stats.push({
    label: "Travel Speed",
    value: `${formatNumber(spell.speed, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      compact: false,
    })} u/s`,
  });
};

const appendPersistentAoeStats = (
  spell: PersistentAoeSpellOption,
  stats: SceneTooltipStat[],
): void => {
  const effectiveDps = spell.damagePerSecond * spell.spellPowerMultiplier;

  // Only show damage if it's > 0
  if (effectiveDps > 0) {
    stats.push({
      label: "Damage / s",
      value: formatNumber(effectiveDps, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        compact: false,
      }),
    });
  }

  // Show damage reduction if present
  if (spell.damageReduction && spell.damageReduction > 0) {
    const effectiveReduction = spell.damageReduction * spell.spellPowerMultiplier;
    stats.push({
      label: "Damage Reduction",
      value: formatNumber(effectiveReduction, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        compact: false,
      }),
    });
  }

  // Show effect duration if present, otherwise spell duration
  const durationSeconds = spell.effectDurationSeconds ?? spell.durationSeconds;
  if (durationSeconds > 0) {
    stats.push({
      label: "Effect Duration",
      value: `${formatNumber(durationSeconds, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        compact: false,
      })} s`,
    });
  }

  stats.push({
    label: "Radius",
    value: `${formatNumber(spell.endRadius, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      compact: false,
    })} u`,
  });
};

export const createSpellTooltip = (spell: SpellOption): SceneTooltipContent => {
  const stats: SceneTooltipStat[] = [];
  if (spell.type === "projectile") {
    appendProjectileStats(spell, stats);
  } else if (spell.type === "whirl") {
    appendWhirlStats(spell, stats);
  } else {
    appendPersistentAoeStats(spell, stats);
  }

  stats.push({
    label: "Cooldown",
    value: `${formatNumber(spell.cooldownSeconds, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      compact: false,
    })} s`,
  });

  return {
    title: spell.name,
    subtitle: spell.description,
    stats,
  };
};
