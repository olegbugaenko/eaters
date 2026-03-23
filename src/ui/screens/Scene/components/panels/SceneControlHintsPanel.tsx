import React, { useCallback, useMemo } from "react";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import type { MapModuleUiApi } from "@logic/modules/active-map/map/map.types";
import {
  DEFAULT_MAP_CONTROL_HINTS_COLLAPSED,
  DEFAULT_MAP_SUMMONING_PANEL_HIDDEN,
  MAP_CONTROL_HINTS_COLLAPSED_BRIDGE_KEY,
  MAP_SUMMONING_PANEL_HIDDEN_BRIDGE_KEY,
} from "@logic/modules/active-map/map/map.const";
import { useLocalization } from "@ui/shared/useLocalization";
import "./SceneControlHintsPanel.css";

const VIDEO_RECORD = typeof process !== "undefined" && process.env.IS_VIDEO_RECORD === "1";

export const SceneControlHintsPanel: React.FC = React.memo(() => {
  const { uiApi, bridge } = useAppLogic();
  const map = useMemo(() => uiApi.map as MapModuleUiApi, [uiApi.map]);
  const collapsed = useBridgeValue(
    bridge,
    MAP_CONTROL_HINTS_COLLAPSED_BRIDGE_KEY,
    DEFAULT_MAP_CONTROL_HINTS_COLLAPSED
  );
  const summoningPanelHidden = useBridgeValue(
    bridge,
    MAP_SUMMONING_PANEL_HIDDEN_BRIDGE_KEY,
    DEFAULT_MAP_SUMMONING_PANEL_HIDDEN
  );
  const { t } = useLocalization();
  const handleToggle = useCallback(() => {
    map.setControlHintsCollapsed(!collapsed);
  }, [collapsed, map]);
  const handleToggleSummoningPanel = useCallback(() => {
    map.setSummoningPanelHidden(!summoningPanelHidden);
  }, [summoningPanelHidden, map]);

  return (
    <div className="scene-control-hints" data-collapsed={collapsed}>
      <div className="scene-control-hints__content">
        <button
          type="button"
          className="scene-control-hints__toggle"
          aria-expanded={!collapsed}
          onClick={handleToggle}
        >
          <span className="scene-control-hints__toggle-text">{t("scene.controls.title", "Controls")}</span>
          <span className="scene-control-hints__toggle-icon" aria-hidden="true">
            {collapsed ? "▸" : "▾"}
          </span>
        </button>
        {!collapsed && (
          <ul className="scene-control-hints__list">
            <li>{t("scene.controls.pan", "RMB + drag — pan")}</li>
            <li>{t("scene.controls.zoom", "Wheel — zoom")}</li>
            <li>{t("scene.controls.details", "RMB on object — details")}</li>
          </ul>
        )}
      </div>
      {VIDEO_RECORD && (
        <button
          type="button"
          className="scene-control-hints__magic-toggle"
          onClick={handleToggleSummoningPanel}
          title={
            summoningPanelHidden
              ? t("scene.controls.showPanels", "Show summoning & cast panels")
              : t("scene.controls.hidePanels", "Hide summoning & cast panels")
          }
          aria-label={
            summoningPanelHidden
              ? t("scene.controls.showPanels", "Show summoning & cast panels")
              : t("scene.controls.hidePanels", "Hide summoning & cast panels")
          }
        >
          <span className="scene-control-hints__magic-icon" aria-hidden="true">
            ✦
          </span>
        </button>
      )}
    </div>
  );
});

SceneControlHintsPanel.displayName = "SceneControlHintsPanel";
