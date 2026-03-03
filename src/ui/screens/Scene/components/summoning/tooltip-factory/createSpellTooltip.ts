import type {
  ProjectileSpellOption,
  PersistentAoeSpellOption,
  ProjectilesRainSpellOption,
  SpellOption,
  WhirlSpellOption,
} from "@logic/modules/active-map/spellcasting/spellcasting.types";
import {
  SceneTooltipContent,
  SceneTooltipStat,
} from "../../tooltip/SceneTooltipPanel";
import { formatNumber } from "@ui-shared/format/number";

type Translate = (key: string, fallback?: string) => string;

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
      key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
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
  t: Translate,
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
    hint: `${t("scene.summoning.spellTooltip.base", "Base")} ${baseDamageLabel} · ${t("scene.summoning.spellTooltip.spellPower", "Spell Power")} ${multiplierLabel}×`,
  });
};

const appendWhirlStats = (
  spell: WhirlSpellOption,
  stats: SceneTooltipStat[],
  t: Translate,
): void => {
  const multiplierLabel = formatNumber(spell.spellPowerMultiplier, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    compact: false,
  });
  const effectiveDps = spell.damagePerSecond * spell.spellPowerMultiplier;
  const totalCapacity = spell.maxHealth * spell.spellPowerMultiplier;

  stats.push({
    label: t("scene.summoning.spellTooltip.damagePerSecond", "Damage / s"),
    value: formatNumber(effectiveDps, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      compact: false,
    }),
    hint: `${t("scene.summoning.spellTooltip.base", "Base")} ${formatNumber(
      spell.damagePerSecond,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        compact: false,
      },
    )} · ${t("scene.summoning.spellTooltip.spellPower", "Spell Power")} ${multiplierLabel}×`,
  });

  stats.push({
    label: t("scene.summoning.spellTooltip.totalCapacity", "Total Capacity"),
    value: formatNumber(totalCapacity, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      compact: false,
    }),
    hint: `${t(
      "scene.summoning.spellTooltip.totalCapacityHint",
      "Storm dissipates after dealing {{value}} base damage.",
    ).replace(
      "{{value}}",
      formatNumber(spell.maxHealth, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        compact: false,
      }),
    )}`,
  });

  stats.push({
    label: t("scene.summoning.spellTooltip.radius", "Radius"),
    value: `${formatNumber(spell.radius, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      compact: false,
    })} u`,
  });

  stats.push({
    label: t("scene.summoning.spellTooltip.travelSpeed", "Travel Speed"),
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
  t: Translate,
): void => {
  const effectiveDps = spell.damagePerSecond * spell.spellPowerMultiplier;

  // Only show damage if it's > 0
  if (effectiveDps > 0) {
    stats.push({
      label: t("scene.summoning.spellTooltip.damagePerSecond", "Damage / s"),
      value: formatNumber(effectiveDps, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        compact: false,
      }),
    });
  }

  // Show damage reduction if present
  if (spell.damageReduction && spell.damageReduction > 0) {
    const effectiveReduction =
      spell.damageReduction * spell.spellPowerMultiplier;
    stats.push({
      label: t(
        "scene.summoning.spellTooltip.damageReduction",
        "Damage Reduction",
      ),
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
      label: t(
        "scene.summoning.spellTooltip.effectDuration",
        "Effect Duration",
      ),
      value: `${formatNumber(durationSeconds, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        compact: false,
      })} s`,
    });
  }

  stats.push({
    label: t("scene.summoning.spellTooltip.radius", "Radius"),
    value: `${formatNumber(spell.endRadius, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      compact: false,
    })} u`,
  });
};

const appendProjectilesRainStats = (
  spell: ProjectilesRainSpellOption,
  stats: SceneTooltipStat[],
  t: Translate,
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
    label: t("scene.summoning.spellTooltip.impactDamage", "Impact Damage"),
    value: formatDamageRange(effectiveMin, effectiveMax),
    hint: `${t("scene.summoning.spellTooltip.base", "Base")} ${baseDamageLabel} · ${t("scene.summoning.spellTooltip.spellPower", "Spell Power")} ${multiplierLabel}×`,
  });

  stats.push({
    label: t("scene.summoning.spellTooltip.duration", "Duration"),
    value: `${formatNumber(spell.durationSeconds, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      compact: false,
    })} s`,
  });

  stats.push({
    label: t("scene.summoning.spellTooltip.spawnInterval", "Spawn Interval"),
    value: `${formatNumber(spell.spawnIntervalMs, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      compact: false,
    })} ms`,
  });

  stats.push({
    label: t("scene.summoning.spellTooltip.rainRadius", "Rain Radius"),
    value: `${formatNumber(spell.radius, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      compact: false,
    })} u`,
  });
};

export const createSpellTooltip = (
  spell: SpellOption,
  t: Translate,
): SceneTooltipContent => {
  const stats: SceneTooltipStat[] = [];
  if (spell.type === "projectile") {
    appendProjectileStats(spell, stats, t);
  } else if (spell.type === "whirl") {
    appendWhirlStats(spell, stats, t);
  } else if (spell.type === "projectiles_rain") {
    appendProjectilesRainStats(spell, stats, t);
  } else {
    appendPersistentAoeStats(spell, stats, t);
  }

  stats.push({
    label: t("scene.summoning.spellTooltip.cooldown", "Cooldown"),
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
