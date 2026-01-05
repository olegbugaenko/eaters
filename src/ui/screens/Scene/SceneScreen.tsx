import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpellId } from "@db/spells-db";
import { SpellOption } from "@logic/modules/active-map/spellcasting/spellcasting.types";
import { UnitDesignId } from "@logic/modules/camp/unit-design/unit-design.types";
import { SceneDebugPanel } from "./components/debug/SceneDebugPanel";
import { SceneRunSummaryModal } from "./components/modals/SceneRunSummaryModal";
import { SceneRunResourcePanel } from "./components/panels/SceneRunResourcePanel";
import { SceneSummoningPanel } from "./components/summoning/SceneSummoningPanel";
import { SceneToolbar } from "./components/toolbar/SceneToolbar";
import {
  SceneTooltipContent,
  SceneTooltipPanel,
} from "./components/tooltip/SceneTooltipPanel";
import {
  SceneTutorialConfig,
  SceneTutorialOverlay,
} from "./components/overlay/SceneTutorialOverlay";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import "./SceneScreen.css";
import { SceneTutorialActions } from "./hooks/tutorialSteps";
import { useSceneTutorial } from "./hooks/useSceneTutorial";
import { TutorialMonitorStatus } from "@logic/modules/active-map/tutorial-monitor/tutorial-monitor.types";
import {
  DEFAULT_TUTORIAL_MONITOR_STATUS,
  TUTORIAL_MONITOR_INPUT_BRIDGE_KEY,
  TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY,
} from "@logic/modules/active-map/tutorial-monitor/tutorial-monitor.const";
import { useSceneRunState } from "./hooks/useSceneRunState";
import { useSceneCameraInteraction } from "./hooks/useSceneCameraInteraction";
import { usePersistedSpellSelection } from "./hooks/usePersistedSpellSelection";

interface SceneScreenProps {
  onExit: () => void;
  onLeaveToMapSelect: () => void;
  tutorial: SceneTutorialConfig | null;
  onTutorialComplete?: () => void;
}

export const SceneScreen: React.FC<SceneScreenProps> = ({
  onExit,
  onLeaveToMapSelect,
  tutorial,
  onTutorialComplete,
}) => {
  const { app, bridge, scene } = useAppLogic();
  const spellcasting = app.services.spellcasting;
  const gameLoop = useMemo(() => app.services.gameLoop, [app]);
  const necromancer = useMemo(() => app.services.necromancer, [app]);
  const unitAutomation = useMemo(() => app.services.unitAutomation, [app]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const summoningPanelRef = useRef<HTMLDivElement | null>(null);
  const pointerPressedRef = useRef(false);
  const lastPointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const initialCamera = useMemo(() => scene.getCamera(), [scene]);
  const cameraInfoRef = useRef(initialCamera);
  const scaleRef = useRef(initialCamera.scale);
  const spellOptionsRef = useRef<SpellOption[]>([]);
  const [hoverContent, setHoverContent] = useState<SceneTooltipContent | null>(null);
  const [isPauseOpen, setIsPauseOpen] = useState(false);
  const {
    toolbarState,
    summoningProps,
    resourceSummary,
    necromancerResources,
    autoRestartState,
    autoRestartCountdown,
    spellOptions,
    handleToggleAutomation,
    handleToggleAutoRestart,
    handleRestart,
    showRunSummary,
  } = useSceneRunState({
    bridge,
    app,
    necromancer,
    unitAutomation,
    cameraInfoRef,
    scaleRef,
    spellOptionsRef,
  });
  const tutorialMonitorStatus = useBridgeValue(
    bridge,
    TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY,
    DEFAULT_TUTORIAL_MONITOR_STATUS
  );
  const { selectedSpellId, selectedSpellIdRef, handleSelectSpell } =
    usePersistedSpellSelection(spellOptions);
  const tutorialMonitorVersionRef = useRef(0);
  const cleanupCalledRef = useRef(false);
  const [tutorialActions, setTutorialActions] = useState<SceneTutorialActions>();
  const [tutorialSummonDone, setTutorialSummonDone] = useState(false);
  const [canAdvancePlayStep, setCanAdvancePlayStep] = useState(false);
  const {
    tutorialSteps,
    tutorialStepIndex,
    showTutorial,
    handleTutorialAdvance,
    handleTutorialClose,
    registerTutorialAction,
  } = useSceneTutorial({
    tutorial,
    wrapperRef,
    onTutorialComplete,
    actions: tutorialActions,
    locks: { playStepLocked: !canAdvancePlayStep },
  });

  const activeTutorialStep = showTutorial ? tutorialSteps[tutorialStepIndex] : null;
  const allowTutorialGameplay = Boolean(activeTutorialStep?.allowGameplay);

  const { scale, cameraInfo, scaleRange, vboStats, particleStatsState, handleScaleChange } =
    useSceneCameraInteraction({
      scene,
      spellcasting,
      gameLoop,
      selectedSpellIdRef,
      spellOptionsRef,
      isPauseOpen,
      showTutorial,
      canvasRef,
      wrapperRef,
      summoningPanelRef,
      cameraInfoRef,
      scaleRef,
      pointerPressedRef,
      lastPointerPositionRef,
    });

  const handlePlayStepAdvance = useCallback(() => {
    setCanAdvancePlayStep(true);
    handleTutorialAdvance(tutorialStepIndex + 1);
  }, [handleTutorialAdvance, tutorialStepIndex]);

  // Clear UI overlays when modals/overlays become visible
  useEffect(() => {
    if (showRunSummary) {
      setHoverContent(null);
      setIsPauseOpen(false);
    }
    if (isPauseOpen) {
      setHoverContent(null);
    }
    if (showTutorial) {
      setHoverContent(null);
      setIsPauseOpen(false);
    }
  }, [showRunSummary, isPauseOpen, showTutorial]);

  useEffect(() => {
    if (!showTutorial) {
      setTutorialSummonDone(false);
      setCanAdvancePlayStep(false);
      return;
    }
    const currentStep = tutorialSteps[tutorialStepIndex];
    if (currentStep?.id === "summon-blue-vanguard" && currentStep.isLocked) {
      setCanAdvancePlayStep(false);
      setIsPauseOpen(false);
    }
  }, [showTutorial, tutorialStepIndex, tutorialSteps]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (showRunSummary) {
        return;
      }
      event.preventDefault();
      setIsPauseOpen((open) => !open);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showRunSummary]);

  useEffect(() => {
    const shouldPauseForTutorial = showTutorial && !allowTutorialGameplay;
    const shouldPause = isPauseOpen || shouldPauseForTutorial || showRunSummary;
    if (shouldPause) {
      app.pauseCurrentMap();
      gameLoop.stop();
      return () => {
        app.resumeCurrentMap();
        gameLoop.start();
      };
    }
    app.resumeCurrentMap();
    gameLoop.start();
    return undefined;
  }, [allowTutorialGameplay, app, gameLoop, isPauseOpen, showRunSummary, showTutorial]);

  const handleSummonDesign = useCallback(
    (designId: UnitDesignId) => {
      const wasSummoned = necromancer.trySpawnDesign(designId);
      if (wasSummoned) {
        const option = summoningProps.spawnOptions.find((entry) => entry.designId === designId);
        if (option?.type === "bluePentagon") {
          registerTutorialAction("summon-blue-vanguard");
          setTutorialSummonDone(true);
        }
      }
    },
    [necromancer, registerTutorialAction, summoningProps.spawnOptions]
  );

  useEffect(() => {
    setTutorialActions({
      summonBlueVanguard: () => handleSummonDesign("bluePentagon"),
    });
  }, [handleSummonDesign]);

  // Tutorial monitor: input bridge, status response, and sanity fallback
  useEffect(() => {
    const isSummonStep = showTutorial && activeTutorialStep?.id === "summon-blue-vanguard";
    
    // Update bridge input
    if (!isSummonStep) {
      bridge.setValue(TUTORIAL_MONITOR_INPUT_BRIDGE_KEY, { active: false });
    } else {
      bridge.setValue(TUTORIAL_MONITOR_INPUT_BRIDGE_KEY, {
        active: true,
        stepId: "summon-blue-vanguard",
        actionCompleted: tutorialSummonDone,
        bricksRequired: 3,
      });
    }
    
    // Skip advancement logic if not on summon step
    if (!isSummonStep) {
      return;
    }
    
    // Check if monitor signaled completion (version changed)
    if (
      tutorialMonitorStatus.ready &&
      tutorialMonitorStatus.stepId === "summon-blue-vanguard" &&
      tutorialMonitorVersionRef.current !== tutorialMonitorStatus.version
    ) {
      tutorialMonitorVersionRef.current = tutorialMonitorStatus.version;
      handlePlayStepAdvance();
      return;
    }
    
    // Fallback: advance when sanity runs out after summoning
    if (tutorialSummonDone && !canAdvancePlayStep && necromancerResources.sanity.current <= 1) {
      handlePlayStepAdvance();
    }
  }, [
    activeTutorialStep?.id,
    bridge,
    canAdvancePlayStep,
    handlePlayStepAdvance,
    necromancerResources.sanity.current,
    showTutorial,
    tutorialMonitorStatus.ready,
    tutorialMonitorStatus.stepId,
    tutorialMonitorStatus.version,
    tutorialSummonDone,
  ]);

  const handleResume = useCallback(() => {
    setIsPauseOpen(false);
  }, []);

  // Wrapper for onLeaveToMapSelect that properly cleans up the map before leaving
  const handleLeaveToMapSelect = useCallback(() => {
    cleanupCalledRef.current = true;
    app.leaveCurrentMap();
    onLeaveToMapSelect();
  }, [app, onLeaveToMapSelect]);

  const handleLeaveToCamp = useCallback(() => {
    setIsPauseOpen(false);
    handleLeaveToMapSelect();
  }, [handleLeaveToMapSelect]);

  // Handle page unload (refresh/close) - cleanup logic modules
  // NOTE: We use beforeunload instead of useEffect cleanup because React StrictMode
  // in dev mode double-invokes effects, which would incorrectly call leaveCurrentMap
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!cleanupCalledRef.current) {
        try {
          app.leaveCurrentMap();
        } catch {
          // Ignore errors during cleanup
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [app]);

  return (
    <div className="scene-screen">
      <SceneToolbar
        onExit={onExit}
        brickTotalHp={toolbarState.brickTotalHp}
        brickInitialHp={toolbarState.brickInitialHp}
        unitCount={toolbarState.unitCount}
        unitTotalHp={toolbarState.unitTotalHp}
        scale={toolbarState.scale}
        scaleRange={scaleRange}
        onScaleChange={handleScaleChange}
        cameraPosition={toolbarState.cameraPosition}
      />
      <SceneRunResourcePanel resources={resourceSummary.resources} />
      <SceneTooltipPanel content={hoverContent} />
      <SceneDebugPanel
        bridge={bridge}
        dynamicBytes={vboStats.bytes}
        dynamicReallocs={vboStats.reallocs}
        particleActive={particleStatsState.active}
        particleCapacity={particleStatsState.capacity}
        particleEmitters={particleStatsState.emitters}
      />
      <SceneSummoningPanel
        ref={summoningPanelRef}
        resources={summoningProps.resources}
        spawnOptions={summoningProps.spawnOptions}
        spells={summoningProps.spells}
        selectedSpellId={selectedSpellId}
        onSelectSpell={handleSelectSpell}
        onSummon={handleSummonDesign}
        onHoverInfoChange={setHoverContent}
        automation={summoningProps.automation}
        onToggleAutomation={handleToggleAutomation}
        unitCount={summoningProps.unitCount}
      />
      <div className="scene-canvas-wrapper" ref={wrapperRef}>
        <canvas ref={canvasRef} width={512} height={512} className="scene-canvas" />
      </div>
      {showRunSummary && (
        <SceneRunSummaryModal
          resources={resourceSummary.resources}
          bricksDestroyed={resourceSummary.bricksDestroyed}
          totalBricksDestroyed={resourceSummary.totalBricksDestroyed}
          primaryAction={{ label: "Return to Void Lab", onClick: handleLeaveToMapSelect }}
          secondaryAction={{ label: "Restart Map", onClick: handleRestart }}
          autoRestart={
            autoRestartState.unlocked
              ? {
                  enabled: autoRestartState.enabled,
                  countdown: autoRestartCountdown,
                  onToggle: handleToggleAutoRestart,
                }
              : undefined
          }
        />
      )}
      {isPauseOpen && !showRunSummary && (
        <SceneRunSummaryModal
          title="Run Paused"
          subtitle="Resources recovered so far:"
          resources={resourceSummary.resources}
          bricksDestroyed={resourceSummary.bricksDestroyed}
          totalBricksDestroyed={resourceSummary.totalBricksDestroyed}
          primaryAction={{ label: "Continue", onClick: handleResume }}
          secondaryAction={{ label: "Return to Void Lab", onClick: handleLeaveToCamp }}
        />
      )}
      {showTutorial && (
        <SceneTutorialOverlay
          steps={tutorialSteps}
          activeIndex={tutorialStepIndex}
          onAdvance={handleTutorialAdvance}
          onClose={handleTutorialClose}
        />
      )}
    </div>
  );
};
