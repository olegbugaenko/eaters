import { useMemo } from "react";
import { getPlayerUnitConfig } from "@db/player-units-db";
import { UNIT_DESIGNER_STATE_BRIDGE_KEY } from "@logic/modules/camp/unit-design/unit-design.const";
import type { UnitDesignerBridgeState } from "@logic/modules/camp/unit-design/unit-design.types";
import { MAP_INSPECTED_TARGET_BRIDGE_KEY } from "@logic/modules/active-map/map/map.const";
import type { BrickRuntimeState } from "@logic/modules/active-map/bricks/bricks.types";
import type { EnemyRuntimeState } from "@logic/modules/active-map/enemies/enemies.types";
import type { PlayerUnitState } from "@logic/modules/active-map/player-units/units/UnitTypes";
import type { TargetSnapshot } from "@logic/modules/active-map/targeting/targeting.types";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { createTargetTooltip } from "./createTargetTooltip";
import { SceneTooltipContent, SceneTooltipPanel } from "./SceneTooltipPanel";

const EMPTY_TARGET: TargetSnapshot<
  "brick" | "enemy" | "playerUnit",
  BrickRuntimeState | EnemyRuntimeState | PlayerUnitState
> | null = null;

const EMPTY_UNIT_DESIGNER_STATE: UnitDesignerBridgeState = {
  units: [],
  availableModules: [],
  maxModules: 3,
  activeRoster: [],
  maxActiveUnits: 3,
  targetingByUnit: {},
};

interface SceneTooltipBridgePanelProps {
  contentOverride?: SceneTooltipContent | null;
}

export const SceneTooltipBridgePanel: React.FC<SceneTooltipBridgePanelProps> = ({
  contentOverride,
}) => {
  const { bridge } = useAppLogic();
  const target = useBridgeValue(bridge, MAP_INSPECTED_TARGET_BRIDGE_KEY, EMPTY_TARGET);
  const unitDesignerState = useBridgeValue(
    bridge,
    UNIT_DESIGNER_STATE_BRIDGE_KEY,
    EMPTY_UNIT_DESIGNER_STATE,
  );
  const bridgeContent = useMemo(() => {
    if (!target) return null;
    let playerUnitDisplayName: string | null = null;
    if (target.type === "playerUnit" && target.data) {
      const unit = target.data as PlayerUnitState;
      const design = unit.designId
        ? unitDesignerState.units.find((u) => u.id === unit.designId)
        : null;
      playerUnitDisplayName = design?.name?.trim()
        ? design.name
        : getPlayerUnitConfig(unit.type).name;
    }
    return createTargetTooltip(target, playerUnitDisplayName);
  }, [target, unitDesignerState.units]);
  const content = contentOverride ?? bridgeContent;

  return <SceneTooltipPanel content={content} />;
};
