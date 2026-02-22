import { useEffect, useMemo, useRef } from "react";
import { DataBridge } from "@/core/logic/ui/DataBridge";
import {
  DEFAULT_RESOURCE_RUN_SUMMARY,
  RESOURCE_RUN_DURATION_BRIDGE_KEY,
  RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
} from "@logic/modules/shared/resources/resources.const";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { SceneRunResourcePanel } from "./SceneRunResourcePanel";
import { SceneRunSummaryModal } from "../modals/SceneRunSummaryModal";
import {
  DEFAULT_DARK_RESEARCH_STATE,
  DARK_RESEARCH_STATE_BRIDGE_KEY,
} from "@logic/modules/camp/dark-research/dark-research.const";
import type { MapAutoRestartState } from "@logic/modules/active-map/map/map.types";
import { useLocalization } from "@ui/shared/useLocalization";

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

export const SceneRunSummaryContainer: React.FC<
  SceneRunSummaryContainerProps
> = ({
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
  const { t } = useLocalization();
  const resourceSummary = useBridgeValue(
    bridge,
    RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
    DEFAULT_RESOURCE_RUN_SUMMARY,
  );
  const runDurationMs = useBridgeValue(
    bridge,
    RESOURCE_RUN_DURATION_BRIDGE_KEY,
    0,
  );
  const darkResearchState = useBridgeValue(
    bridge,
    DARK_RESEARCH_STATE_BRIDGE_KEY,
    DEFAULT_DARK_RESEARCH_STATE,
  );
  const runStartSoulsRef = useRef(darkResearchState.totalSouls);
  const lastCompletedRef = useRef(resourceSummary.completed);

  useEffect(() => {
    if (
      !resourceSummary.completed &&
      resourceSummary.bricksDestroyed === 0 &&
      runDurationMs <= 0
    ) {
      runStartSoulsRef.current = darkResearchState.totalSouls;
    }
  }, [
    darkResearchState.totalSouls,
    resourceSummary.bricksDestroyed,
    resourceSummary.completed,
    runDurationMs,
  ]);

  const soulsSummary = useMemo(() => {
    if (!darkResearchState.unlocked) {
      return undefined;
    }
    const gained = Math.max(
      0,
      darkResearchState.totalSouls - runStartSoulsRef.current,
    );
    const durationSeconds = Math.max(0, runDurationMs / 1000);
    return {
      name: t("voidCamp.darkResearch.souls", "Souls"),
      amount: darkResearchState.totalSouls,
      gained,
      ratePerSecond: durationSeconds > 0 ? gained / durationSeconds : 0,
    };
  }, [
    darkResearchState.totalSouls,
    darkResearchState.unlocked,
    runDurationMs,
    t,
  ]);

  useEffect(() => {
    if (lastCompletedRef.current !== resourceSummary.completed) {
      lastCompletedRef.current = resourceSummary.completed;
      onRunCompletionChange(resourceSummary.completed);
    }
  }, [onRunCompletionChange, resourceSummary.completed]);

  return (
    <>
      <SceneRunResourcePanel
        resources={resourceSummary.resources}
        souls={soulsSummary}
      />
      {resourceSummary.completed && (
        <SceneRunSummaryModal
          resources={resourceSummary.resources}
          souls={soulsSummary}
          bricksDestroyed={resourceSummary.bricksDestroyed}
          totalBricksDestroyed={resourceSummary.totalBricksDestroyed}
          title={
            resourceSummary.success === true
              ? "Map Complete"
              : resourceSummary.success === false
                ? "Run Ended"
                : undefined
          }
          primaryAction={{
            label: "Return to Void Lab",
            onClick: onLeaveToMapSelect,
          }}
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
          souls={soulsSummary}
          bricksDestroyed={resourceSummary.bricksDestroyed}
          totalBricksDestroyed={resourceSummary.totalBricksDestroyed}
          primaryAction={{ label: "Continue", onClick: onResume }}
          secondaryAction={{
            label: "Return to Void Lab",
            onClick: onLeaveToCamp,
          }}
        />
      )}
    </>
  );
};
