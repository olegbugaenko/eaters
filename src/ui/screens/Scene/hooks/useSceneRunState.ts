import { useCallback, useEffect, useRef, useState } from "react";
import { DataBridge } from "@/core/logic/ui/DataBridge";
import type { MapAutoRestartState, MapModuleUiApi } from "@logic/modules/active-map/map/map.types";
import {
  DEFAULT_MAP_AUTO_RESTART_STATE,
  MAP_AUTO_RESTART_BRIDGE_KEY,
} from "@logic/modules/active-map/map/map.const";
import type { UnitAutomationModuleUiApi } from "@logic/modules/active-map/unit-automation/unit-automation.types";
import { UnitDesignId } from "@logic/modules/camp/unit-design/unit-design.types";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { clearAllAuraSlots } from "@ui/renderers/objects";
import { petalAuraGpuRenderer } from "@ui/renderers/primitives/gpu/petal-aura";

const AUTO_RESTART_SECONDS = 5;
interface UseSceneRunStateArgs {
  bridge: DataBridge;
  map: MapModuleUiApi;
  unitAutomation: UnitAutomationModuleUiApi;
  runCompleted: boolean;
}

interface UseSceneRunStateResult {
  autoRestartState: MapAutoRestartState;
  autoRestartCountdown: number;
  handleToggleAutomation: (designId: UnitDesignId, enabled: boolean) => void;
  handleToggleAutoRestart: (enabled: boolean) => void;
  handleRestart: () => void;
}

export const useSceneRunState = ({
  bridge,
  map,
  unitAutomation,
  runCompleted,
}: UseSceneRunStateArgs): UseSceneRunStateResult => {
  const autoRestartState = useBridgeValue(
    bridge,
    MAP_AUTO_RESTART_BRIDGE_KEY,
    DEFAULT_MAP_AUTO_RESTART_STATE
  );
  const [autoRestartCountdown, setAutoRestartCountdown] = useState(AUTO_RESTART_SECONDS);
  const autoRestartHandledRef = useRef(false);
  const restartMap = useCallback(() => {
    clearAllAuraSlots();
    petalAuraGpuRenderer.clearInstances();
    map.restartSelectedMap();
  }, [map]);

  const handleToggleAutoRestart = useCallback(
    (enabled: boolean) => {
      map.setAutoRestartEnabled(enabled);
    },
    [map]
  );

  const handleRestart = useCallback(() => {
    autoRestartHandledRef.current = true;
    restartMap();
  }, [restartMap]);

  const handleToggleAutomation = useCallback(
    (designId: UnitDesignId, enabled: boolean) => {
      unitAutomation.setAutomationEnabled(designId, enabled);
    },
    [unitAutomation]
  );

  useEffect(() => {
    if (!runCompleted) {
      autoRestartHandledRef.current = false;
      setAutoRestartCountdown(AUTO_RESTART_SECONDS);
      return;
    }
    if (!autoRestartState.unlocked || !autoRestartState.enabled) {
      autoRestartHandledRef.current = false;
      setAutoRestartCountdown(AUTO_RESTART_SECONDS);
      return;
    }
    autoRestartHandledRef.current = false;
    setAutoRestartCountdown(AUTO_RESTART_SECONDS);
    let remaining = AUTO_RESTART_SECONDS;
    const interval = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(interval);
        setAutoRestartCountdown(0);
        if (!autoRestartHandledRef.current) {
          autoRestartHandledRef.current = true;
          restartMap();
        }
        return;
      }
      setAutoRestartCountdown(remaining);
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [autoRestartState.enabled, autoRestartState.unlocked, restartMap, runCompleted]);

  return {
    autoRestartState,
    autoRestartCountdown,
    handleToggleAutomation,
    handleToggleAutoRestart,
    handleRestart,
  };
};
