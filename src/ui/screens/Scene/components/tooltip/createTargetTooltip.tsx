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
import {
  getStatusEffectConfig,
  type StatusEffectId,
} from "@db/status-effects-db";
import { formatEffectApplicationStats } from "@db/status-effects-db.helpers";
import {
  getUnitModuleConfig,
  getUnitModuleEffects,
  UNIT_MODULE_IDS,
  type UnitModuleId,
  type ModuleAbilityType,
} from "@db/unit-modules-db";
import type { BrickRuntimeState } from "@logic/modules/active-map/bricks/bricks.types";
import type { EnemyRuntimeState } from "@logic/modules/active-map/enemies/enemies.types";
import { scaleStatusEffectApplicationOptionsByEnemyLevel } from "@logic/modules/active-map/enemies/enemies.helpers";
import type { PlayerUnitState } from "@logic/modules/active-map/player-units/units/UnitTypes";
import type { TargetSnapshot } from "@logic/modules/active-map/targeting/targeting.types";
import { ResourceIcon } from "@ui-shared/icons/ResourceIcon";
import { formatNumber } from "@ui-shared/format/number";
import type {
  SceneTooltipContent,
  SceneTooltipStat,
} from "./SceneTooltipPanel";

type Translate = (key: string, fallback?: string) => string;

const formatStatValue = (value: number): string =>
  formatNumber(value);

const formatHpValue = (current: number, max: number): string =>
  `${formatStatValue(current)} / ${formatStatValue(max)}`;

const formatSeconds = (value: number): string =>
  `${formatNumber(value, { maximumFractionDigits: 2 })}s`;

const formatDistance = (value: number): string =>
  `${formatNumber(value, { maximumFractionDigits: 0 })} units`;

const BASE_SOUL_DROP_CHANCE = 0.2;

const formatPercent = (value: number): string =>
  `${formatNumber(value * 100, { maximumFractionDigits: 2 })}%`;

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

const buildCommonStats = (
  target: TargetSnapshot,
  t: Translate,
): SceneTooltipStat[] => [
  {
    label: t("scene.targetTooltip.hp", "HP"),
    value: formatHpValue(target.hp, target.maxHp),
  },
  {
    label: t("scene.targetTooltip.attack", "Attack"),
    value: formatStatValue(target.effectiveDamage),
  },
  {
    label: t("scene.targetTooltip.armor", "Armor"),
    value: formatStatValue(target.armor),
  },
];

const buildEnemyStats = (
  enemy: EnemyRuntimeState,
  enemyConfig: EnemyConfig,
  t: Translate,
  darkResearchUnlocked: boolean,
): SceneTooltipStat[] => {
  const stats: SceneTooltipStat[] = [];
  if (Number.isFinite(enemy.attackInterval)) {
    stats.push({
      label: t("scene.targetTooltip.attackCooldown", "Attack Cooldown"),
      value: formatSeconds(enemy.attackInterval),
    });
  }
  if (Number.isFinite(enemy.attackRange)) {
    stats.push({
      label: t("scene.targetTooltip.attackRange", "Attack Range"),
      value: formatDistance(enemy.attackRange),
    });
  }

  const soulReward = Math.max(enemy.soulReward ?? 0, 0);
  const baseSoulDropChance = darkResearchUnlocked && enemy.moveSpeed > 0 && soulReward > 0
    ? BASE_SOUL_DROP_CHANCE
    : 0;

  if (soulReward > 0) {
    stats.push({
      label: t("scene.targetTooltip.soulReward", "Soul Reward"),
      value: formatNumber(soulReward, { maximumFractionDigits: 2 }),
    });
    stats.push({
      label: t("scene.targetTooltip.soulDropBaseChance", "Base Soul Drop Chance"),
      value: formatPercent(baseSoulDropChance),
    });
    if (!darkResearchUnlocked && enemy.moveSpeed > 0) {
      stats.push({
        label: t("scene.targetTooltip.soulDropRequirement", "Soul drops"),
        value: t("scene.targetTooltip.soulDropRequirementValue", "Unlock Dark Research (Souls Harvest skill) to earn souls from kills."),
      });
    }
  }

  if (enemyConfig.explosionAttack?.radius) {
    stats.push({
      label: t("scene.targetTooltip.aoeRadius", "AoE Radius"),
      value: formatDistance(enemyConfig.explosionAttack.radius),
    });
  }

  // Show effect stats for any status effect the enemy can apply
  if (enemyConfig.projectile?.statusEffectId) {
    const scaledEffectOptions =
      scaleStatusEffectApplicationOptionsByEnemyLevel(
        enemyConfig.projectile.statusEffectOptions,
        enemy.level,
      ) ?? {};
    const effectConfig = getStatusEffectConfig(
      enemyConfig.projectile.statusEffectId,
    );
    const effectStats = formatEffectApplicationStats(
      enemyConfig.projectile.statusEffectId,
      scaledEffectOptions,
    );
    if (effectStats.length > 0) {
      stats.push({
        label: t("scene.targetTooltip.effect", "{{name}} Effect").replace(
          "{{name}}",
          effectConfig.displayName,
        ),
        value: "",
      });
      effectStats.forEach((stat) => {
        stats.push({ label: stat.label, value: stat.value, nested: true });
      });
    }
  }

  if (enemyConfig.arcAttack?.statusEffectId) {
    const scaledEffectOptions =
      scaleStatusEffectApplicationOptionsByEnemyLevel(
        enemyConfig.arcAttack.statusEffectOptions,
        enemy.level,
      ) ?? {};
    const effectConfig = getStatusEffectConfig(
      enemyConfig.arcAttack.statusEffectId,
    );
    const effectStats = formatEffectApplicationStats(
      enemyConfig.arcAttack.statusEffectId,
      scaledEffectOptions,
    );
    if (effectStats.length > 0) {
      // Add effect name as a header with nested stats underneath
      stats.push({
        label: t("scene.targetTooltip.effect", "{{name}} Effect").replace(
          "{{name}}",
          effectConfig.displayName,
        ),
        value: "",
      });
      effectStats.forEach((stat) => {
        stats.push({ label: stat.label, value: stat.value, nested: true });
      });
    }
  }
  return stats;
};

const buildPlayerUnitStats = (
  unit: PlayerUnitState,
  effectiveDamage: number,
  t: Translate,
): SceneTooltipStat[] => {
  const stats: SceneTooltipStat[] = [
    {
      label: t("scene.targetTooltip.hp", "HP"),
      value: formatHpValue(unit.hp, unit.maxHp),
    },
    {
      label: t("scene.targetTooltip.attack", "Attack"),
      value: formatStatValue(effectiveDamage),
    },
    {
      label: t("scene.targetTooltip.armor", "Armor"),
      value: formatStatValue(unit.armor),
    },
  ];
  if (Number.isFinite(unit.baseAttackInterval)) {
    stats.push({
      label: t("scene.targetTooltip.attackCooldown", "Attack Cooldown"),
      value: formatSeconds(unit.baseAttackInterval),
    });
  }
  const displayedMoveSpeed =
    typeof unit.effectiveMaxMoveSpeed === "number" && Number.isFinite(unit.effectiveMaxMoveSpeed)
      ? unit.effectiveMaxMoveSpeed
      : unit.moveSpeed;
  if (Number.isFinite(displayedMoveSpeed)) {
    stats.push({
      label: t("scene.targetTooltip.moveSpeed", "Move Speed"),
      value: formatDistance(displayedMoveSpeed),
    });
  }
  if ((unit.soulDropChanceBonus ?? 0) > 0) {
    stats.push({
      label: t("scene.targetTooltip.soulDropBonus", "Soul Drop Chance Bonus"),
      value: `+${formatPercent(unit.soulDropChanceBonus)}`,
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
  t: Translate,
): { label: string; value: string }[] => {
  const stats: { label: string; value: string }[] = [];
  const ability = moduleConfig.providesAbility;
  if (!ability) return stats;

  const base = moduleConfig.baseBonusValue;
  const perLevel = moduleConfig.bonusPerLevel;
  const multiplier = base + perLevel * Math.max(level - 1, 0);

  switch (abilityType) {
    case "heal":
      stats.push({
        label: t("scene.targetTooltip.healAmount", "Heal Amount"),
        value: `${t("scene.targetTooltip.attack", "Attack")} × ${multiplier.toFixed(2)}`,
      });
      if (ability.cooldownSeconds) {
        stats.push({
          label: t("scene.targetTooltip.cooldown", "Cooldown"),
          value: `${ability.cooldownSeconds}s`,
        });
      }
      if (ability.maxCharges) {
        stats.push({
          label: t("scene.targetTooltip.charges", "Charges"),
          value: `${ability.maxCharges}/${t("scene.targetTooltip.perRun", "run")}`,
        });
      }
      break;
    case "frenzyBuff":
      stats.push({
        label: t("scene.targetTooltip.bonusDamage", "Bonus Damage"),
        value: `${t("scene.targetTooltip.attack", "Attack")} × ${multiplier.toFixed(2)}`,
      });
      if (ability.cooldownSeconds) {
        stats.push({
          label: t("scene.targetTooltip.cooldown", "Cooldown"),
          value: `${ability.cooldownSeconds}s`,
        });
      }
      break;
  }

  return stats;
};

/**
 * Builds stats for unit module effects and abilities.
 * Shows potential effects and abilities based on equipped modules.
 */
const buildUnitModuleEffectStats = (
  unit: PlayerUnitState,
  t: Translate,
): SceneTooltipStat[] => {
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

    const moduleEffects = getUnitModuleEffects(moduleId);

    moduleEffects.forEach((moduleEffect) => {
      if (moduleEffect.kind !== "status") {
        return;
      }
      const { effectId, durationMs } = moduleEffect;
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
          label: t("scene.targetTooltip.effect", "{{name}} Effect").replace(
            "{{name}}",
            effectConfig.displayName,
          ),
          value: "",
        });
        // Add nested stats
        effectStats.forEach((stat) => {
          stats.push({ label: stat.label, value: stat.value, nested: true });
        });
      }
    });

    moduleEffects.forEach((moduleEffect) => {
      if (moduleEffect.kind !== "ability") {
        return;
      }
      const ability = moduleEffect.ability;
      const abilityStats = formatAbilityStats(
        ability.type,
        moduleConfig,
        level,
        t,
      );

      if (abilityStats.length > 0) {
        stats.push({
          label: ability.label,
          value: "",
        });
        abilityStats.forEach((stat) => {
          stats.push({ label: stat.label, value: stat.value, nested: true });
        });
      }
    });
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
  activeEffects:
    | readonly {
        id: string;
        name: string;
        stacks: number;
        maxStacks?: number;
        remainingMs?: number;
        damagePerSecond?: number;
      }[]
    | undefined,
  t: Translate,
): SceneTooltipStat[] => {
  const stats: SceneTooltipStat[] = [];

  if (!activeEffects || activeEffects.length === 0) {
    return stats;
  }

  for (const effect of activeEffects) {
    const duration = formatEffectDuration(effect.remainingMs);

    // Add effect header
    stats.push({
      label: t("scene.targetTooltip.activeEffect", "{{name}} (Active)").replace(
        "{{name}}",
        effect.name,
      ),
      value: "",
    });

    // Format based on effect type
    const isPercentBonus = effect.id === "internalFurnace";

    if (isPercentBonus) {
      // Internal Furnace: show as attack bonus
      const current = effect.stacks;
      const max = effect.maxStacks ?? 0;
      stats.push({
        label: t("scene.targetTooltip.attackBonus", "Attack Bonus"),
        value: `+${current}%/${max}%`,
        nested: true,
      });
    } else if (effect.maxStacks !== undefined && effect.maxStacks > 0) {
      // Stack-based effects (like Bleeding)
      stats.push({
        label: t("scene.targetTooltip.stacks", "Stacks"),
        value: `${effect.stacks}/${effect.maxStacks}`,
        nested: true,
      });
    } else if (effect.stacks > 1) {
      stats.push({
        label: t("scene.targetTooltip.stacks", "Stacks"),
        value: `×${effect.stacks}`,
        nested: true,
      });
    }

    // Add damage for DoT effects
    if (effect.damagePerSecond !== undefined && effect.damagePerSecond > 0) {
      stats.push({
        label: t("scene.targetTooltip.damage", "Damage"),
        value: formatDamageValue(effect.damagePerSecond),
        nested: true,
      });
    }

    // Add duration if present
    if (duration) {
      stats.push({
        label: t("scene.targetTooltip.remaining", "Remaining"),
        value: duration,
        nested: true,
      });
    }
  }

  return stats;
};

export const createTargetTooltip = (
  target: TargetSnapshot<
    "brick" | "enemy" | "playerUnit",
    BrickRuntimeState | EnemyRuntimeState | PlayerUnitState
  >,
  t: Translate,
  playerUnitDisplayName?: string | null,
  options?: { darkResearchUnlocked?: boolean },
): SceneTooltipContent => {
  if (target.type === "brick") {
    const brick = target.data as BrickRuntimeState;
    const brickConfig = getBrickConfig(brick.type);
    const title = brickConfig.name ?? `Brick: ${brick.type}`;
    const rewardLabel = formatRewards(
      brick.rewards,
      target.rewardMultiplier ?? 1,
    );
    const activeEffectStats = buildActiveEffectStats(target.activeEffects, t);
    return {
      title,
      subtitle: `${t("voidCamp.common.level", "Level")} ${brick.level}`,
      stats: [
        ...buildCommonStats(target, t),
        ...(rewardLabel
          ? [
              {
                label: t("scene.targetTooltip.reward", "Reward"),
                value: rewardLabel,
              },
            ]
          : []),
        ...activeEffectStats,
      ],
    };
  }

  if (target.type === "playerUnit") {
    const unit = target.data as PlayerUnitState;
    const unitConfig = getPlayerUnitConfig(unit.type);
    const title = playerUnitDisplayName ?? unitConfig.name;
    const stats = buildPlayerUnitStats(unit, target.effectiveDamage, t);

    // Add module effect stats (potential effects the unit can apply)
    const moduleEffectStats = buildUnitModuleEffectStats(unit, t);
    stats.push(...moduleEffectStats);

    // Add active effects currently on this unit (in unified nested format)
    const activeEffectStats = buildActiveEffectStats(target.activeEffects, t);
    stats.push(...activeEffectStats);

    return {
      title,
      subtitle: t("scene.targetTooltip.yourUnit", "Your unit"),
      stats,
    };
  }

  const enemy = target.data as EnemyRuntimeState;
  const enemyConfig = getEnemyConfig(enemy.type);
  const rewardLabel = formatRewards(
    enemy.reward ?? enemyConfig.reward,
    target.rewardMultiplier ?? 1,
  );
  const activeEffectStats = buildActiveEffectStats(target.activeEffects, t);
  return {
    title: enemyConfig.name,
    subtitle: `${t("voidCamp.common.level", "Level")} ${enemy.level}`,
    stats: [
      ...buildCommonStats(target, t),
      ...buildEnemyStats(enemy, enemyConfig, t, Boolean(options?.darkResearchUnlocked)),
      ...(rewardLabel
        ? [
            {
              label: t("scene.targetTooltip.reward", "Reward"),
              value: rewardLabel,
            },
          ]
        : []),
      ...activeEffectStats,
    ],
  };
};
