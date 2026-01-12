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
import { createTargetTooltip } from "./components/tooltip/createTargetTooltip";
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
import type { NecromancerModuleUiApi } from "@logic/modules/active-map/necromancer/necromancer.types";
import type { UnitAutomationModuleUiApi } from "@logic/modules/active-map/unit-automation/unit-automation.types";
import type { SpellcastingModuleUiApi } from "@logic/modules/active-map/spellcasting/spellcasting.types";
import type { MapModuleUiApi } from "@logic/modules/active-map/map/map.types";
import type { SceneUiApi, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { GameLoopUiApi } from "@core/logic/provided/services/game-loop/game-loop.types";

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
  const { uiApi, bridge } = useAppLogic();
  const scene = uiApi.scene as SceneUiApi;
  const spellcasting = uiApi.spellcasting as SpellcastingModuleUiApi;
  const gameLoop = useMemo(() => uiApi.gameLoop as GameLoopUiApi, [uiApi.gameLoop]);
  const necromancer = useMemo(() => uiApi.necromancer as NecromancerModuleUiApi, [uiApi.necromancer]);
  const unitAutomation = useMemo(
    () => uiApi.unitAutomation as UnitAutomationModuleUiApi,
    [uiApi.unitAutomation]
  );
  const map = uiApi.map as MapModuleUiApi;
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
    map,
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
  const [tutorialSpellCastDone, setTutorialSpellCastDone] = useState(false);
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
  // For cast-magic-arrow step: allow gameplay after spell is cast
  const isSpellStepAfterCast = activeTutorialStep?.id === "cast-magic-arrow" && tutorialSpellCastDone;
  const allowTutorialGameplay = isSpellStepAfterCast || Boolean(activeTutorialStep?.allowGameplay);

  const handlePlayStepAdvance = useCallback(() => {
    setCanAdvancePlayStep(true);
    // Register action for cast-magic-arrow before advancing
    if (activeTutorialStep?.id === "cast-magic-arrow" && tutorialSpellCastDone) {
      registerTutorialAction("cast-magic-arrow");
    }
    handleTutorialAdvance(tutorialStepIndex + 1);
  }, [activeTutorialStep?.id, handleTutorialAdvance, registerTutorialAction, tutorialStepIndex, tutorialSpellCastDone]);

  // Ref to avoid timer reset when callback reference changes
  const handlePlayStepAdvanceRef = useRef(handlePlayStepAdvance);
  useEffect(() => {
    handlePlayStepAdvanceRef.current = handlePlayStepAdvance;
  }, [handlePlayStepAdvance]);

  const handleSpellCast = useCallback(
    (spellId: SpellId) => {
      console.log('[handleSpellCast] called:', { spellId, showTutorial, stepId: activeTutorialStep?.id });
      const isSpellStep = showTutorial && activeTutorialStep?.id === "cast-magic-arrow";
      if (isSpellStep && spellId === "magic-arrow") {
        console.log('[handleSpellCast] Setting tutorialSpellCastDone to true');
        // Don't register action immediately to prevent auto-advance
        // We'll register it when handlePlayStepAdvance is called
        setTutorialSpellCastDone(true);
      }
    },
    [activeTutorialStep?.id, showTutorial]
  );

  const handleInspectTarget = useCallback(
    (position: SceneVector2) => {
      const target = map.inspectTargetAtPosition(position);
      if (!target) {
        setHoverContent(null);
        return;
      }
      setHoverContent(createTargetTooltip(target));
    },
    [map],
  );

  const { scale, cameraInfo, scaleRange, handleScaleChange } =
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
      onSpellCast: handleSpellCast,
      onInspectTarget: handleInspectTarget,
    });

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
      setTutorialSpellCastDone(false);
      setCanAdvancePlayStep(false);
      return;
    }
    const currentStep = tutorialSteps[tutorialStepIndex];
    if (currentStep?.id === "summon-blue-vanguard" && currentStep.isLocked) {
      setCanAdvancePlayStep(false);
      setIsPauseOpen(false);
    }
    if (currentStep?.id === "cast-magic-arrow" && currentStep.isLocked) {
      setCanAdvancePlayStep(false);
      // Ensure player has enough mana to cast the spell (costs 1 mana)
      necromancer.ensureMinMana(1.1);
    }
  }, [necromancer, showTutorial, tutorialStepIndex, tutorialSteps]);

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
    // For cast-magic-arrow step before cast, don't pause the map (to allow spell casting)
    const isSpellStepWaitingForCast = 
      showTutorial && 
      activeTutorialStep?.id === "cast-magic-arrow" && 
      !tutorialSpellCastDone;
    
    console.log('[PauseEffect]', {
      shouldPause,
      shouldPauseForTutorial,
      allowTutorialGameplay,
      isSpellStepWaitingForCast,
      tutorialSpellCastDone,
      stepId: activeTutorialStep?.id,
      isPauseOpen,
      showRunSummary,
      showTutorial,
    });
    
    if (shouldPause) {
      // Stop gameLoop
      gameLoop.stop();
      // Only pause map if NOT waiting for spell cast
      if (!isSpellStepWaitingForCast) {
        console.log('[PauseEffect] Pausing map');
        map.pauseActiveMap();
      } else {
        // Map was likely paused by previous step - RESUME it for spell casting!
        console.log('[PauseEffect] RESUMING map for spell cast');
        map.resumeActiveMap();
      }
    } else {
      // Resume everything
      console.log('[PauseEffect] Resuming map and gameLoop');
      map.resumeActiveMap();
      gameLoop.start();
    }
    
    return undefined;
  }, [activeTutorialStep?.id, allowTutorialGameplay, gameLoop, isPauseOpen, map, showRunSummary, showTutorial, tutorialSpellCastDone]);

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
    if (tutorialSummonDone && !canAdvancePlayStep && necromancerResources.sanity.current <= 2) {
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

  // Tutorial spell step: advance after 3 seconds (primary condition)
  useEffect(() => {
    const isSpellStep = showTutorial && activeTutorialStep?.id === "cast-magic-arrow";
    
    if (!isSpellStep || !tutorialSpellCastDone || canAdvancePlayStep) {
      return;
    }

    // Primary: advance after 3 seconds
    const timeoutId = setTimeout(() => {
      handlePlayStepAdvanceRef.current();
    }, 3000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    activeTutorialStep?.id,
    canAdvancePlayStep,
    showTutorial,
    tutorialSpellCastDone,
  ]);

  // Tutorial spell step: sanity fallback - advance early if sanity drops too low
  useEffect(() => {
    const isSpellStep = showTutorial && activeTutorialStep?.id === "cast-magic-arrow";
    
    if (!isSpellStep || !tutorialSpellCastDone || canAdvancePlayStep) {
      return;
    }

    // Fallback: advance immediately if sanity is critical
    if (necromancerResources.sanity.current <= 1) {
      handlePlayStepAdvanceRef.current();
    }
  }, [
    activeTutorialStep?.id,
    canAdvancePlayStep,
    necromancerResources.sanity.current,
    showTutorial,
    tutorialSpellCastDone,
  ]);

  const handleResume = useCallback(() => {
    setIsPauseOpen(false);
  }, []);

  // Wrapper for onLeaveToMapSelect that properly cleans up the map before leaving
  const handleLeaveToMapSelect = useCallback(() => {
    cleanupCalledRef.current = true;
    map.leaveCurrentMap();
    onLeaveToMapSelect();
  }, [map, onLeaveToMapSelect]);

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
          map.leaveCurrentMap();
        } catch {
          // Ignore errors during cleanup
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [map]);

  return (
    <div className="scene-screen">
      <SceneToolbar
        onExit={() => setIsPauseOpen((open) => !open)}
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
      <SceneDebugPanel bridge={bridge} />
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
          title={
            resourceSummary.success === true
              ? "Map Complete"
              : resourceSummary.success === false
              ? "Run Ended"
              : undefined
          }
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
