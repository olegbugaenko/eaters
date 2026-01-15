import React, { useCallback, useMemo } from "react";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import type { MapModuleUiApi } from "@logic/modules/active-map/map/map.types";
import {
  DEFAULT_MAP_CONTROL_HINTS_COLLAPSED,
  MAP_CONTROL_HINTS_COLLAPSED_BRIDGE_KEY,
} from "@logic/modules/active-map/map/map.const";
import "./SceneControlHintsPanel.css";

export const SceneControlHintsPanel: React.FC = React.memo(() => {
  const { uiApi, bridge } = useAppLogic();
  const map = useMemo(() => uiApi.map as MapModuleUiApi, [uiApi.map]);
  const collapsed = useBridgeValue(
    bridge,
    MAP_CONTROL_HINTS_COLLAPSED_BRIDGE_KEY,
    DEFAULT_MAP_CONTROL_HINTS_COLLAPSED
  );
  const handleToggle = useCallback(() => {
    map.setControlHintsCollapsed(!collapsed);
  }, [collapsed, map]);

  return (
    <div className="scene-control-hints" data-collapsed={collapsed}>
      <div className="scene-control-hints__content">
        <button
          type="button"
          className="scene-control-hints__toggle"
          aria-expanded={!collapsed}
          onClick={handleToggle}
        >
          <span className="scene-control-hints__toggle-text">Controls</span>
          <span className="scene-control-hints__toggle-icon" aria-hidden="true">
            {collapsed ? "▸" : "▾"}
          </span>
        </button>
        {!collapsed && (
          <ul className="scene-control-hints__list">
            <li>RMB + drag — pan</li>
            <li>Wheel — zoom</li>
            <li>RMB on object — details</li>
          </ul>
        )}
      </div>
    </div>
  );
});

SceneControlHintsPanel.displayName = "SceneControlHintsPanel";
