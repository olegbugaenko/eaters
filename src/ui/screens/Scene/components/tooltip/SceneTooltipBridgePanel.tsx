import { useMemo } from "react";
import { MAP_INSPECTED_TARGET_BRIDGE_KEY } from "@logic/modules/active-map/map/map.const";
import type { BrickRuntimeState } from "@logic/modules/active-map/bricks/bricks.types";
import type { EnemyRuntimeState } from "@logic/modules/active-map/enemies/enemies.types";
import type { TargetSnapshot } from "@logic/modules/active-map/targeting/targeting.types";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { createTargetTooltip } from "./createTargetTooltip";
import { SceneTooltipContent, SceneTooltipPanel } from "./SceneTooltipPanel";

const EMPTY_TARGET: TargetSnapshot<
  "brick" | "enemy",
  BrickRuntimeState | EnemyRuntimeState
> | null = null;

interface SceneTooltipBridgePanelProps {
  contentOverride?: SceneTooltipContent | null;
}

export const SceneTooltipBridgePanel: React.FC<SceneTooltipBridgePanelProps> = ({
  contentOverride,
}) => {
  const { bridge } = useAppLogic();
  const target = useBridgeValue(bridge, MAP_INSPECTED_TARGET_BRIDGE_KEY, EMPTY_TARGET);
  const bridgeContent = useMemo(
    () => (target ? createTargetTooltip(target) : null),
    [target],
  );
  const content = contentOverride ?? bridgeContent;

  return <SceneTooltipPanel content={content} />;
};
