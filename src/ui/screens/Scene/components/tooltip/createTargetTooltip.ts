import { getBrickConfig } from "@db/bricks-db";
import { getEnemyConfig } from "@db/enemies-db";
import type { BrickRuntimeState } from "@logic/modules/active-map/bricks/bricks.types";
import type { EnemyRuntimeState } from "@logic/modules/active-map/enemies/enemies.types";
import type { TargetSnapshot } from "@logic/modules/active-map/targeting/targeting.types";
import { formatNumber } from "@ui-shared/format/number";
import type { SceneTooltipContent, SceneTooltipStat } from "./SceneTooltipPanel";

const formatStatValue = (value: number): string =>
  formatNumber(value, { maximumFractionDigits: 0 });

const formatHpValue = (current: number, max: number): string =>
  `${formatStatValue(current)} / ${formatStatValue(max)}`;

const buildCommonStats = (target: TargetSnapshot): SceneTooltipStat[] => [
  { label: "HP", value: formatHpValue(target.hp, target.maxHp) },
  { label: "Attack", value: formatStatValue(target.baseDamage) },
  { label: "Armor", value: formatStatValue(target.armor) },
];

export const createTargetTooltip = (
  target: TargetSnapshot<"brick" | "enemy", BrickRuntimeState | EnemyRuntimeState>,
): SceneTooltipContent => {
  if (target.type === "brick") {
    const brick = target.data as BrickRuntimeState;
    const brickConfig = getBrickConfig(brick.type);
    const title = brickConfig.name ?? `Brick: ${brick.type}`;
    return {
      title,
      subtitle: `Level ${brick.level}`,
      stats: buildCommonStats(target),
    };
  }

  const enemy = target.data as EnemyRuntimeState;
  const enemyConfig = getEnemyConfig(enemy.type);
  return {
    title: enemyConfig.name,
    subtitle: `Level ${enemy.level}`,
    stats: buildCommonStats(target),
  };
};
