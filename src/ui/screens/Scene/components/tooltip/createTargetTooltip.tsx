import { getBrickConfig } from "@db/bricks-db";
import type { ReactNode } from "react";
import { EnemyConfig, getEnemyConfig } from "@db/enemies-db";
import { getPlayerUnitConfig } from "@db/player-units-db";
import {
  hasAnyResources,
  normalizeResourceAmount,
  RESOURCE_IDS,
  ResourceAmount,
  ResourceStockpile,
} from "@db/resources-db";
import { getStatusEffectConfig, type StatusEffectId } from "@db/status-effects-db";
import { formatEffectApplicationStats } from "@db/status-effects-db.helpers";
import { getUnitModuleConfig, UNIT_MODULE_IDS, type UnitModuleId, type ModuleAbilityType } from "@db/unit-modules-db";
import type { BrickRuntimeState } from "@logic/modules/active-map/bricks/bricks.types";
import type { EnemyRuntimeState } from "@logic/modules/active-map/enemies/enemies.types";
import type { PlayerUnitState } from "@logic/modules/active-map/player-units/units/UnitTypes";
import type { TargetSnapshot } from "@logic/modules/active-map/targeting/targeting.types";
import { ResourceIcon } from "@ui-shared/icons/ResourceIcon";
import { formatNumber } from "@ui-shared/format/number";
import type { SceneTooltipContent, SceneTooltipStat } from "./SceneTooltipPanel";

const formatStatValue = (value: number): string =>
  formatNumber(value, { maximumFractionDigits: 0 });

const formatHpValue = (current: number, max: number): string =>
  `${formatStatValue(current)} / ${formatStatValue(max)}`;

const formatSeconds = (value: number): string =>
  `${formatNumber(value, { maximumFractionDigits: 2 })}s`;

const formatDistance = (value: number): string =>
  `${formatNumber(value, { maximumFractionDigits: 0 })} units`;

const applyRewardMultiplier = (
  rewards: ResourceStockpile,
  multiplier: number,
): ResourceStockpile => {
  if (!Number.isFinite(multiplier) || Math.abs(multiplier - 1) < 1e-9) {
    return rewards;
  }
  const scaled = normalizeResourceAmount(rewards);
  RESOURCE_IDS.forEach((id) => {
    const base = scaled[id] ?? 0;
    const value = Math.round(base * Math.max(multiplier, 0) * 100) / 100;
    scaled[id] = value > 0 ? value : 0;
  });
  return scaled;
};

const formatRewards = (
  rewards?: ResourceStockpile | ResourceAmount | null,
  rewardMultiplier = 1,
): ReactNode[] | null => {
  if (!rewards) {
    return null;
  }
  const normalized = normalizeResourceAmount(rewards);
  const scaled = applyRewardMultiplier(normalized, rewardMultiplier);
  if (!hasAnyResources(scaled)) {
    return null;
  }
  return RESOURCE_IDS.filter((id) => scaled[id] > 0).map((id) => (
    <span key={id} className="scene-tooltip-panel__reward-item">
      <ResourceIcon resourceId={id} />
      {formatNumber(scaled[id], { maximumFractionDigits: 2 })}
    </span>
  ));
};

const buildCommonStats = (target: TargetSnapshot): SceneTooltipStat[] => [
  { label: "HP", value: formatHpValue(target.hp, target.maxHp) },
  { label: "Attack", value: formatStatValue(target.effectiveDamage) },
  { label: "Armor", value: formatStatValue(target.armor) },
];

const buildEnemyStats = (
  enemy: EnemyRuntimeState,
  enemyConfig: EnemyConfig,
): SceneTooltipStat[] => {
  const stats: SceneTooltipStat[] = [];
  if (Number.isFinite(enemy.attackInterval)) {
    stats.push({
      label: "Attack Cooldown",
      value: formatSeconds(enemy.attackInterval),
    });
  }
  if (Number.isFinite(enemy.attackRange)) {
    stats.push({
      label: "Attack Range",
      value: formatDistance(enemy.attackRange),
    });
  }

  if (enemyConfig.explosionAttack?.radius) {
    stats.push({
      label: "AoE Radius",
      value: formatDistance(enemyConfig.explosionAttack.radius),
    });
  }

  // Show effect stats for any status effect the enemy can apply
  if (enemyConfig.arcAttack?.statusEffectId) {
    const effectConfig = getStatusEffectConfig(enemyConfig.arcAttack.statusEffectId);
    const effectStats = formatEffectApplicationStats(
      enemyConfig.arcAttack.statusEffectId,
      enemyConfig.arcAttack.statusEffectOptions ?? {},
    );
    if (effectStats.length > 0) {
      // Add effect name as a header with nested stats underneath
      stats.push({
        label: `${effectConfig.displayName} Effect`,
        value: "",
      });
      effectStats.forEach((stat) => {
        stats.push({ label: stat.label, value: stat.value, nested: true });
      });
    }
  }
  return stats;
};

const buildPlayerUnitStats = (unit: PlayerUnitState, effectiveDamage: number): SceneTooltipStat[] => {
  const stats: SceneTooltipStat[] = [
    { label: "HP", value: formatHpValue(unit.hp, unit.maxHp) },
    { label: "Attack", value: formatStatValue(effectiveDamage) },
    { label: "Armor", value: formatStatValue(unit.armor) },
  ];
  if (Number.isFinite(unit.baseAttackInterval)) {
    stats.push({
      label: "Attack Cooldown",
      value: formatSeconds(unit.baseAttackInterval),
    });
  }
  if (Number.isFinite(unit.moveSpeed)) {
    stats.push({
      label: "Move Speed",
      value: formatDistance(unit.moveSpeed),
    });
  }
  return stats;
};

/**
 * Formats ability stats based on ability type.
 */
const formatAbilityStats = (
  abilityType: ModuleAbilityType,
  moduleConfig: ReturnType<typeof getUnitModuleConfig>,
  level: number,
): { label: string; value: string }[] => {
  const stats: { label: string; value: string }[] = [];
  const ability = moduleConfig.providesAbility;
  if (!ability) return stats;
  
  const base = moduleConfig.baseBonusValue;
  const perLevel = moduleConfig.bonusPerLevel;
  const multiplier = base + perLevel * Math.max(level - 1, 0);
  
  switch (abilityType) {
    case "heal":
      stats.push({ label: "Heal Amount", value: `Attack × ${multiplier.toFixed(2)}` });
      if (ability.cooldownSeconds) {
        stats.push({ label: "Cooldown", value: `${ability.cooldownSeconds}s` });
      }
      if (ability.maxCharges) {
        stats.push({ label: "Charges", value: `${ability.maxCharges}/run` });
      }
      break;
    case "frenzyBuff":
      stats.push({ label: "Bonus Damage", value: `Attack × ${multiplier.toFixed(2)}` });
      if (ability.cooldownSeconds) {
        stats.push({ label: "Cooldown", value: `${ability.cooldownSeconds}s` });
      }
      break;
  }
  
  return stats;
};

/**
 * Builds stats for unit module effects and abilities.
 * Shows potential effects and abilities based on equipped modules.
 */
const buildUnitModuleEffectStats = (unit: PlayerUnitState): SceneTooltipStat[] => {
  const stats: SceneTooltipStat[] = [];
  
  if (!unit.moduleLevels) {
    return stats;
  }
  
  for (const moduleId of UNIT_MODULE_IDS) {
    const level = unit.moduleLevels[moduleId as UnitModuleId];
    if (!level || level <= 0) {
      continue;
    }
    
    const moduleConfig = getUnitModuleConfig(moduleId);
    
    // Handle status effects the module can apply
    if (moduleConfig.appliesEffect) {
      const { effectId, durationMs } = moduleConfig.appliesEffect;
      const effectConfig = getStatusEffectConfig(effectId);
      
      // Calculate the effect bonus based on module level
      const base = moduleConfig.baseBonusValue;
      const perLevel = moduleConfig.bonusPerLevel;
      const effectValue = base + perLevel * Math.max(level - 1, 0);
      
      // Build application options for formatting based on effect type
      const effectStats = formatEffectApplicationStats(effectId, {
        durationMs,
        // For meltingTail: multiplier increases incoming damage
        multiplier: effectId === "meltingTail" ? effectValue : undefined,
        // For freezingTail: divisor reduces outgoing damage
        divisor: effectId === "freezingTail" ? effectValue : undefined,
      });
      
      if (effectStats.length > 0) {
        // Add effect name as a header
        stats.push({
          label: `${effectConfig.displayName} Effect`,
          value: "",
        });
        // Add nested stats
        effectStats.forEach((stat) => {
          stats.push({ label: stat.label, value: stat.value, nested: true });
        });
      }
    }
    
    // Handle abilities the module provides (like healing)
    if (moduleConfig.providesAbility) {
      const ability = moduleConfig.providesAbility;
      const abilityStats = formatAbilityStats(ability.type, moduleConfig, level);
      
      if (abilityStats.length > 0) {
        stats.push({
          label: ability.label,
          value: "",
        });
        abilityStats.forEach((stat) => {
          stats.push({ label: stat.label, value: stat.value, nested: true });
        });
      }
    }
  }
  
  return stats;
};

const formatEffectDuration = (remainingMs?: number): string | null => {
  if (remainingMs === undefined || !Number.isFinite(remainingMs)) {
    return null;
  }
  return formatSeconds(remainingMs / 1000);
};

/**
 * Formats damage value for display
 */
const formatDamageValue = (dps: number): string => {
  if (dps >= 1000) {
    return `${(dps / 1000).toFixed(1)}K/s`;
  }
  return `${dps.toFixed(0)}/s`;
};

/**
 * Builds stats for active effects on a target (like Internal Furnace, Bleeding, etc).
 * Uses unified nested format for consistency with potential effects.
 */
const buildActiveEffectStats = (
  activeEffects: readonly { id: string; name: string; stacks: number; maxStacks?: number; remainingMs?: number; damagePerSecond?: number }[] | undefined,
): SceneTooltipStat[] => {
  const stats: SceneTooltipStat[] = [];
  
  if (!activeEffects || activeEffects.length === 0) {
    return stats;
  }
  
  for (const effect of activeEffects) {
    const effectConfig = getStatusEffectConfig(effect.id as StatusEffectId);
    const duration = formatEffectDuration(effect.remainingMs);
    
    // Add effect header
    stats.push({
      label: `${effect.name} (Active)`,
      value: "",
    });
    
    // Format based on effect type
    const isPercentBonus = effect.id === "internalFurnace";
    
    if (isPercentBonus) {
      // Internal Furnace: show as attack bonus
      const current = effect.stacks;
      const max = effect.maxStacks ?? 0;
      stats.push({
        label: "Attack Bonus",
        value: `+${current}%/${max}%`,
        nested: true,
      });
    } else if (effect.maxStacks !== undefined && effect.maxStacks > 0) {
      // Stack-based effects (like Bleeding)
      stats.push({
        label: "Stacks",
        value: `${effect.stacks}/${effect.maxStacks}`,
        nested: true,
      });
    } else if (effect.stacks > 1) {
      stats.push({
        label: "Stacks",
        value: `×${effect.stacks}`,
        nested: true,
      });
    }
    
    // Add damage for DoT effects
    if (effect.damagePerSecond !== undefined && effect.damagePerSecond > 0) {
      stats.push({
        label: "Damage",
        value: formatDamageValue(effect.damagePerSecond),
        nested: true,
      });
    }
    
    // Add duration if present
    if (duration) {
      stats.push({
        label: "Remaining",
        value: duration,
        nested: true,
      });
    }
  }
  
  return stats;
};

export const createTargetTooltip = (
  target: TargetSnapshot<"brick" | "enemy" | "playerUnit", BrickRuntimeState | EnemyRuntimeState | PlayerUnitState>,
  playerUnitDisplayName?: string | null,
): SceneTooltipContent => {
  if (target.type === "brick") {
    const brick = target.data as BrickRuntimeState;
    const brickConfig = getBrickConfig(brick.type);
    const title = brickConfig.name ?? `Brick: ${brick.type}`;
    const rewardLabel = formatRewards(brick.rewards, target.rewardMultiplier ?? 1);
    const activeEffectStats = buildActiveEffectStats(target.activeEffects);
    return {
      title,
      subtitle: `Level ${brick.level}`,
      stats: [
        ...buildCommonStats(target),
        ...(rewardLabel ? [{ label: "Reward", value: rewardLabel }] : []),
        ...activeEffectStats,
      ],
    };
  }

  if (target.type === "playerUnit") {
    const unit = target.data as PlayerUnitState;
    const unitConfig = getPlayerUnitConfig(unit.type);
    const title = playerUnitDisplayName ?? unitConfig.name;
    const stats = buildPlayerUnitStats(unit, target.effectiveDamage);
    
    // Add module effect stats (potential effects the unit can apply)
    const moduleEffectStats = buildUnitModuleEffectStats(unit);
    stats.push(...moduleEffectStats);
    
    // Add active effects currently on this unit (in unified nested format)
    const activeEffectStats = buildActiveEffectStats(target.activeEffects);
    stats.push(...activeEffectStats);
    
    return {
      title,
      subtitle: "Your unit",
      stats,
    };
  }

  const enemy = target.data as EnemyRuntimeState;
  const enemyConfig = getEnemyConfig(enemy.type);
  const rewardLabel = formatRewards(
    enemy.reward ?? enemyConfig.reward,
    target.rewardMultiplier ?? 1,
  );
  const activeEffectStats = buildActiveEffectStats(target.activeEffects);
  return {
    title: enemyConfig.name,
    subtitle: `Level ${enemy.level}`,
    stats: [
      ...buildCommonStats(target),
      ...buildEnemyStats(enemy, enemyConfig),
      ...(rewardLabel ? [{ label: "Reward", value: rewardLabel }] : []),
      ...activeEffectStats,
    ],
  };
};
