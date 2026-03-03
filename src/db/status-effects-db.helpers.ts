import type { StatusEffectApplicationOptions } from "@/logic/modules/active-map/status-effects/status-effects.types";
import { type StatusEffectId, getStatusEffectConfig } from "./status-effects-db";

export interface FormattedEffectStat {
  readonly label: string;
  readonly value: string;
}

/**
 * Formats effect application options into displayable stats.
 * Used for showing "potential effects" (what enemy/turret can apply) in tooltips.
 */
export function formatEffectApplicationStats(
  effectId: StatusEffectId,
  options: StatusEffectApplicationOptions,
): FormattedEffectStat[] {
  const config = getStatusEffectConfig(effectId);
  const stats: FormattedEffectStat[] = [];

  if (!config.descriptionParams) {
    return stats;
  }

  for (const param of config.descriptionParams) {
    switch (param.type) {
      case "damage": {
        const dps = options.damagePerSecond;
        if (dps !== undefined && dps > 0) {
          stats.push({ label: param.label, value: `${formatDamage(dps)}/s` });
        }
        break;
      }
      case "duration": {
        const ms = options.durationMs ?? config.durationMs;
        if (ms !== undefined && ms > 0) {
          stats.push({ label: param.label, value: formatDuration(ms) });
        }
        break;
      }
      case "slowdown": {
        const mult = options.speedMultiplier;
        if (mult !== undefined && mult < 1) {
          const percent = Math.round((1 - mult) * 100);
          stats.push({ label: param.label, value: `${percent}%` });
        }
        break;
      }
      case "stacks": {
        const max = options.stacks ?? config.maxStacks;
        if (max !== undefined && max > 1) {
          stats.push({ label: param.label, value: `${max}` });
        }
        break;
      }
      case "armorReduction": {
        const reduction = options.armorReductionPerStack;
        if (reduction !== undefined && reduction > 0) {
          stats.push({ label: param.label, value: `${reduction}/stack` });
        }
        break;
      }
      case "incomingDamageBonus": {
        // multiplier > 1 means increased damage taken
        const mult = options.multiplier;
        if (mult !== undefined && mult > 1) {
          const percent = Math.round((mult - 1) * 100);
          stats.push({ label: param.label, value: `+${percent}%` });
        }
        break;
      }
      case "outgoingDamageReduction": {
        // divisor > 1 means reduced damage output (e.g., 1.5 = 33% reduction)
        const div = options.divisor;
        if (div !== undefined && div > 1) {
          const percent = Math.round((1 - 1 / div) * 100);
          stats.push({ label: param.label, value: `${percent}%` });
        }
        break;
      }
    }
  }

  return stats;
}

function formatDamage(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds >= 1) {
    return `${seconds.toFixed(1).replace(/\.0$/, "")}s`;
  }
  return `${ms}ms`;
}
