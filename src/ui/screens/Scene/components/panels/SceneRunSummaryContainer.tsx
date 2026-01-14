import { useEffect, useRef } from "react";
import { DataBridge } from "@/core/logic/ui/DataBridge";
import {
  DEFAULT_RESOURCE_RUN_SUMMARY,
  RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
} from "@logic/modules/shared/resources/resources.const";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { SceneRunResourcePanel } from "./SceneRunResourcePanel";
import { SceneRunSummaryModal } from "../modals/SceneRunSummaryModal";
import type { MapAutoRestartState } from "@logic/modules/active-map/map/map.types";

interface SceneRunSummaryContainerProps {
  bridge: DataBridge;
  autoRestartState: MapAutoRestartState;
  autoRestartCountdown: number;
  onToggleAutoRestart: (enabled: boolean) => void;
  onRestart: () => void;
  onLeaveToMapSelect: () => void;
  isPauseOpen: boolean;
  onResume: () => void;
  onLeaveToCamp: () => void;
  onRunCompletionChange: (completed: boolean) => void;
}

export const SceneRunSummaryContainer: React.FC<SceneRunSummaryContainerProps> = ({
  bridge,
  autoRestartState,
  autoRestartCountdown,
  onToggleAutoRestart,
  onRestart,
  onLeaveToMapSelect,
  isPauseOpen,
  onResume,
  onLeaveToCamp,
  onRunCompletionChange,
}) => {
  const resourceSummary = useBridgeValue(
    bridge,
    RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
    DEFAULT_RESOURCE_RUN_SUMMARY
  );
  const lastCompletedRef = useRef(resourceSummary.completed);

  useEffect(() => {
    if (lastCompletedRef.current !== resourceSummary.completed) {
      lastCompletedRef.current = resourceSummary.completed;
      onRunCompletionChange(resourceSummary.completed);
    }
  }, [onRunCompletionChange, resourceSummary.completed]);

  return (
    <>
      <SceneRunResourcePanel resources={resourceSummary.resources} />
      {resourceSummary.completed && (
        <SceneRunSummaryModal
          resources={resourceSummary.resources}
          bricksDestroyed={resourceSummary.bricksDestroyed}
          totalBricksDestroyed={resourceSummary.totalBricksDestroyed}
          title={
            resourceSummary.success === true
              ? "Map Complete"
              : resourceSummary.success === false
              ? "Run Ended"
              : undefined
          }
          primaryAction={{ label: "Return to Void Lab", onClick: onLeaveToMapSelect }}
          secondaryAction={{ label: "Restart Map", onClick: onRestart }}
          autoRestart={
            autoRestartState.unlocked
              ? {
                  enabled: autoRestartState.enabled,
                  countdown: autoRestartCountdown,
                  onToggle: onToggleAutoRestart,
                }
              : undefined
          }
        />
      )}
      {isPauseOpen && !resourceSummary.completed && (
        <SceneRunSummaryModal
          title="Run Paused"
          subtitle="Resources recovered so far:"
          resources={resourceSummary.resources}
          bricksDestroyed={resourceSummary.bricksDestroyed}
          totalBricksDestroyed={resourceSummary.totalBricksDestroyed}
          primaryAction={{ label: "Continue", onClick: onResume }}
          secondaryAction={{ label: "Return to Void Lab", onClick: onLeaveToCamp }}
        />
      )}
    </>
  );
};
