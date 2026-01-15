import { MutableRefObject, useEffect, useRef } from "react";
import { DataBridge } from "@/core/logic/ui/DataBridge";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import {
  DEFAULT_TUTORIAL_MONITOR_STATUS,
  TUTORIAL_MONITOR_INPUT_BRIDGE_KEY,
  TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY,
} from "@logic/modules/active-map/tutorial-monitor/tutorial-monitor.const";
import { NECROMANCER_RESOURCES_BRIDGE_KEY } from "@logic/modules/active-map/necromancer/necromancer.const";
import type { NecromancerResourcesPayload } from "@logic/modules/active-map/necromancer/necromancer.types";

const DEFAULT_NECROMANCER_RESOURCES: NecromancerResourcesPayload = {
  mana: { current: 0, max: 0 },
  sanity: { current: 0, max: 0 },
};

interface SceneTutorialBridgeMonitorProps {
  bridge: DataBridge;
  showTutorial: boolean;
  activeTutorialStepId?: string;
  tutorialSummonDone: boolean;
  tutorialSpellCastDone: boolean;
  canAdvancePlayStep: boolean;
  onAdvanceStepRef: MutableRefObject<() => void>;
}

export const SceneTutorialBridgeMonitor: React.FC<SceneTutorialBridgeMonitorProps> = ({
  bridge,
  showTutorial,
  activeTutorialStepId,
  tutorialSummonDone,
  tutorialSpellCastDone,
  canAdvancePlayStep,
  onAdvanceStepRef,
}) => {
  const tutorialMonitorStatus = useBridgeValue(
    bridge,
    TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY,
    DEFAULT_TUTORIAL_MONITOR_STATUS
  );
  const necromancerResources = useBridgeValue(
    bridge,
    NECROMANCER_RESOURCES_BRIDGE_KEY,
    DEFAULT_NECROMANCER_RESOURCES
  );
  const tutorialMonitorVersionRef = useRef(0);

  useEffect(() => {
    const isSummonStep = showTutorial && activeTutorialStepId === "summon-blue-vanguard";

    if (!isSummonStep) {
      bridge.setValue(TUTORIAL_MONITOR_INPUT_BRIDGE_KEY, { active: false });
      return;
    }

    bridge.setValue(TUTORIAL_MONITOR_INPUT_BRIDGE_KEY, {
      active: true,
      stepId: "summon-blue-vanguard",
      actionCompleted: tutorialSummonDone,
      bricksRequired: 3,
    });

    if (
      tutorialMonitorStatus.ready &&
      tutorialMonitorStatus.stepId === "summon-blue-vanguard" &&
      tutorialMonitorVersionRef.current !== tutorialMonitorStatus.version
    ) {
      tutorialMonitorVersionRef.current = tutorialMonitorStatus.version;
      onAdvanceStepRef.current();
      return;
    }

    if (
      tutorialSummonDone &&
      !canAdvancePlayStep &&
      necromancerResources.sanity.current <= 2
    ) {
      onAdvanceStepRef.current();
    }
  }, [
    activeTutorialStepId,
    bridge,
    canAdvancePlayStep,
    necromancerResources.sanity.current,
    onAdvanceStepRef,
    showTutorial,
    tutorialMonitorStatus.ready,
    tutorialMonitorStatus.stepId,
    tutorialMonitorStatus.version,
    tutorialSummonDone,
  ]);

  useEffect(() => {
    const isSpellStep = showTutorial && activeTutorialStepId === "cast-magic-arrow";

    if (!isSpellStep || !tutorialSpellCastDone || canAdvancePlayStep) {
      return;
    }

    if (necromancerResources.sanity.current <= 1) {
      onAdvanceStepRef.current();
    }
  }, [
    activeTutorialStepId,
    canAdvancePlayStep,
    necromancerResources.sanity.current,
    onAdvanceStepRef,
    showTutorial,
    tutorialSpellCastDone,
  ]);

  return null;
};
