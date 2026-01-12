import { getBrickConfig } from "@db/bricks-db";
import { EnemyConfig, getEnemyConfig } from "@db/enemies-db";
import {
  getResourceConfig,
  hasAnyResources,
  normalizeResourceAmount,
  RESOURCE_IDS,
  ResourceAmount,
  ResourceStockpile,
} from "@db/resources-db";
import { getStatusEffectConfig } from "@db/status-effects-db";
import type { BrickRuntimeState } from "@logic/modules/active-map/bricks/bricks.types";
import type { EnemyRuntimeState } from "@logic/modules/active-map/enemies/enemies.types";
import type { TargetSnapshot } from "@logic/modules/active-map/targeting/targeting.types";
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

const formatRewards = (
  rewards?: ResourceStockpile | ResourceAmount | null,
): string | null => {
  if (!rewards) {
    return null;
  }
  const normalized = normalizeResourceAmount(rewards);
  if (!hasAnyResources(normalized)) {
    return null;
  }
  const rewardParts = RESOURCE_IDS.filter((id) => normalized[id] > 0).map(
    (id) =>
      `${getResourceConfig(id).name} ${formatNumber(normalized[id], {
        maximumFractionDigits: 0,
      })}`,
  );
  return rewardParts.join(", ");
};

const buildCommonStats = (target: TargetSnapshot): SceneTooltipStat[] => [
  { label: "HP", value: formatHpValue(target.hp, target.maxHp) },
  { label: "Attack", value: formatStatValue(target.baseDamage) },
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

  if (enemyConfig.arcAttack?.statusEffectId === "freeze") {
    const options = enemyConfig.arcAttack.statusEffectOptions;
    const speedMultiplier = options?.speedMultiplier ?? 1;
    if (speedMultiplier < 1) {
      stats.push({
        label: "Freeze Slowdown",
        value: `${formatNumber((1 - speedMultiplier) * 100, {
          maximumFractionDigits: 0,
        })}%`,
      });
    }
    const durationMs =
      options?.durationMs ?? getStatusEffectConfig("freeze").durationMs ?? 0;
    if (durationMs > 0) {
      stats.push({
        label: "Freeze Duration",
        value: formatSeconds(durationMs / 1000),
      });
    }
  }
  return stats;
};

export const createTargetTooltip = (
  target: TargetSnapshot<"brick" | "enemy", BrickRuntimeState | EnemyRuntimeState>,
): SceneTooltipContent => {
  if (target.type === "brick") {
    const brick = target.data as BrickRuntimeState;
    const brickConfig = getBrickConfig(brick.type);
    const title = brickConfig.name ?? `Brick: ${brick.type}`;
    const rewardLabel = formatRewards(brick.rewards);
    return {
      title,
      subtitle: `Level ${brick.level}`,
      stats: [
        ...buildCommonStats(target),
        ...(rewardLabel ? [{ label: "Reward", value: rewardLabel }] : []),
      ],
    };
  }

  const enemy = target.data as EnemyRuntimeState;
  const enemyConfig = getEnemyConfig(enemy.type);
  const rewardLabel = formatRewards(enemy.reward ?? enemyConfig.reward);
  return {
    title: enemyConfig.name,
    subtitle: `Level ${enemy.level}`,
    stats: [
      ...buildCommonStats(target),
      ...buildEnemyStats(enemy, enemyConfig),
      ...(rewardLabel ? [{ label: "Reward", value: rewardLabel }] : []),
    ],
  };
};
