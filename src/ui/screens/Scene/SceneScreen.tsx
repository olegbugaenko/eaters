import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpellId } from "@db/spells-db";
import { UnitDesignId } from "@logic/modules/camp/unit-design/unit-design.types";
import { SceneDebugPanel } from "./components/debug/SceneDebugPanel";
import { SceneControlHintsPanel } from "./components/panels/SceneControlHintsPanel";
import { SceneRunSummaryContainer } from "./components/panels/SceneRunSummaryContainer";
import { SceneToolbarContainer } from "./components/toolbar/SceneToolbarContainer";
import { SceneTooltipBridgePanel } from "./components/tooltip/SceneTooltipBridgePanel";
import type { SceneTooltipContent } from "./components/tooltip/SceneTooltipPanel";
import {
  SceneTutorialConfig,
  SceneTutorialOverlay,
} from "./components/overlay/SceneTutorialOverlay";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeRef } from "@ui-shared/useBridgeRef";
import "./SceneScreen.css";
import { SceneTutorialActions } from "./hooks/tutorialSteps";
import { useSceneTutorial } from "./hooks/useSceneTutorial";
import {
  DEFAULT_SPELL_OPTIONS,
  SPELL_OPTIONS_BRIDGE_KEY,
} from "@logic/modules/active-map/spellcasting/spellcasting.const";
import { NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY } from "@logic/modules/active-map/necromancer/necromancer.const";
import { useSceneRunState } from "./hooks/useSceneRunState";
import { useSceneCameraInteraction } from "./hooks/useSceneCameraInteraction";
import type {
  NecromancerModuleUiApi,
  NecromancerSpawnOption,
} from "@logic/modules/active-map/necromancer/necromancer.types";
import type { UnitAutomationModuleUiApi } from "@logic/modules/active-map/unit-automation/unit-automation.types";
import type { SpellcastingModuleUiApi } from "@logic/modules/active-map/spellcasting/spellcasting.types";
import type { MapModuleUiApi } from "@logic/modules/active-map/map/map.types";
import type { SceneUiApi, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { GameLoopUiApi } from "@core/logic/provided/services/game-loop/game-loop.types";
import { SceneTutorialBridgeMonitor } from "./components/tutorial/SceneTutorialBridgeMonitor";
import { SceneSummoningPanelContainer } from "./components/summoning/SceneSummoningPanelContainer";

const EMPTY_SPAWN_OPTIONS: NecromancerSpawnOption[] = [];

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
  const spellOptionsRef = useBridgeRef(
    bridge,
    SPELL_OPTIONS_BRIDGE_KEY,
    DEFAULT_SPELL_OPTIONS
  );
  const [summoningTooltipContent, setSummoningTooltipContent] =
    useState<SceneTooltipContent | null>(null);
  const [isPauseOpen, setIsPauseOpen] = useState(false);
  const [runCompleted, setRunCompleted] = useState(false);
  const {
    autoRestartState,
    autoRestartCountdown,
    handleToggleAutomation,
    handleToggleAutoRestart,
    handleRestart,
  } = useSceneRunState({
    bridge,
    map,
    unitAutomation,
    runCompleted,
  });
  const spawnOptionsRef = useBridgeRef(
    bridge,
    NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY,
    EMPTY_SPAWN_OPTIONS
  );
  const selectedSpellIdRef = useRef<SpellId | null>(null);
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
  const activeTutorialStepId = activeTutorialStep?.id;
  // For cast-magic-arrow step: allow gameplay after spell is cast
  const isSpellStepAfterCast = activeTutorialStepId === "cast-magic-arrow" && tutorialSpellCastDone;
  const allowTutorialGameplay = isSpellStepAfterCast || Boolean(activeTutorialStep?.allowGameplay);

  const handlePlayStepAdvance = useCallback(() => {
    setCanAdvancePlayStep(true);
    // Register action for cast-magic-arrow before advancing
    if (activeTutorialStepId === "cast-magic-arrow" && tutorialSpellCastDone) {
      registerTutorialAction("cast-magic-arrow");
    }
    handleTutorialAdvance(tutorialStepIndex + 1);
  }, [activeTutorialStepId, handleTutorialAdvance, registerTutorialAction, tutorialStepIndex, tutorialSpellCastDone]);

  // Ref to avoid timer reset when callback reference changes
  const handlePlayStepAdvanceRef = useRef(handlePlayStepAdvance);
  useEffect(() => {
    handlePlayStepAdvanceRef.current = handlePlayStepAdvance;
  }, [handlePlayStepAdvance]);

  const handleSpellCast = useCallback(
    (spellId: SpellId) => {
      console.log('[handleSpellCast] called:', { spellId, showTutorial, stepId: activeTutorialStepId });
      const isSpellStep = showTutorial && activeTutorialStepId === "cast-magic-arrow";
      if (isSpellStep && spellId === "magic-arrow") {
        console.log('[handleSpellCast] Setting tutorialSpellCastDone to true');
        // Don't register action immediately to prevent auto-advance
        // We'll register it when handlePlayStepAdvance is called
        setTutorialSpellCastDone(true);
      }
    },
    [activeTutorialStepId, showTutorial]
  );

  const handleInspectTarget = useCallback(
    (position: SceneVector2) => {
      map.setInspectedTargetAtPosition(position);
    },
    [map],
  );

  const { cameraUiStore, handleScaleChange } = useSceneCameraInteraction({
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
    if (runCompleted) {
      map.clearInspectedTarget();
      setSummoningTooltipContent(null);
      setIsPauseOpen(false);
    }
    if (isPauseOpen) {
      map.clearInspectedTarget();
      setSummoningTooltipContent(null);
    }
    if (showTutorial) {
      map.clearInspectedTarget();
      setSummoningTooltipContent(null);
      setIsPauseOpen(false);
    }
  }, [map, runCompleted, isPauseOpen, showTutorial]);

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
      if (runCompleted) {
        return;
      }
      event.preventDefault();
      setIsPauseOpen((open) => !open);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [runCompleted]);

  useEffect(() => {
    const shouldPauseForTutorial = showTutorial && !allowTutorialGameplay;
    const shouldPause = isPauseOpen || shouldPauseForTutorial || runCompleted;
    // For cast-magic-arrow step before cast, don't pause the map (to allow spell casting)
    const isSpellStepWaitingForCast = 
      showTutorial && 
      activeTutorialStepId === "cast-magic-arrow" && 
      !tutorialSpellCastDone;
    
    console.log('[PauseEffect]', {
      shouldPause,
      shouldPauseForTutorial,
      allowTutorialGameplay,
      isSpellStepWaitingForCast,
      tutorialSpellCastDone,
      stepId: activeTutorialStepId,
      isPauseOpen,
      showRunSummary: runCompleted,
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
  }, [
    activeTutorialStepId,
    allowTutorialGameplay,
    gameLoop,
    isPauseOpen,
    map,
    runCompleted,
    showTutorial,
    tutorialSpellCastDone,
  ]);

  const handleSummonDesign = useCallback(
    (designId: UnitDesignId) => {
      const wasSummoned = necromancer.trySpawnDesign(designId);
      if (wasSummoned) {
        const option = spawnOptionsRef.current.find((entry) => entry.designId === designId);
        if (option?.type === "bluePentagon") {
          registerTutorialAction("summon-blue-vanguard");
          setTutorialSummonDone(true);
        }
      }
    },
    [necromancer, registerTutorialAction, spawnOptionsRef]
  );

  useEffect(() => {
    setTutorialActions({
      summonBlueVanguard: () => handleSummonDesign("bluePentagon"),
    });
  }, [handleSummonDesign]);

  const handleRunCompletionChange = useCallback((completed: boolean) => {
    setRunCompleted(completed);
  }, []);


  // Tutorial spell step: advance after 3 seconds (primary condition)
  useEffect(() => {
    const isSpellStep = showTutorial && activeTutorialStepId === "cast-magic-arrow";
    
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
    activeTutorialStepId,
    canAdvancePlayStep,
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
      <SceneToolbarContainer
        bridge={bridge}
        onExit={() => setIsPauseOpen((open) => !open)}
        cameraUiStore={cameraUiStore}
        onScaleChange={handleScaleChange}
      />
      <SceneRunSummaryContainer
        bridge={bridge}
        autoRestartState={autoRestartState}
        autoRestartCountdown={autoRestartCountdown}
        onToggleAutoRestart={handleToggleAutoRestart}
        onRestart={handleRestart}
        onLeaveToMapSelect={handleLeaveToMapSelect}
        isPauseOpen={isPauseOpen}
        onResume={handleResume}
        onLeaveToCamp={handleLeaveToCamp}
        onRunCompletionChange={handleRunCompletionChange}
      />
      <SceneControlHintsPanel />
      <SceneTooltipBridgePanel contentOverride={summoningTooltipContent} />
      <SceneDebugPanel bridge={bridge} />
      <SceneTutorialBridgeMonitor
        bridge={bridge}
        showTutorial={showTutorial}
        activeTutorialStepId={activeTutorialStepId}
        tutorialSummonDone={tutorialSummonDone}
        tutorialSpellCastDone={tutorialSpellCastDone}
        canAdvancePlayStep={canAdvancePlayStep}
        onAdvanceStepRef={handlePlayStepAdvanceRef}
      />
      <SceneSummoningPanelContainer
        panelRef={summoningPanelRef}
        selectedSpellIdRef={selectedSpellIdRef}
        onSummon={handleSummonDesign}
        onHoverInfoChange={setSummoningTooltipContent}
        onToggleAutomation={handleToggleAutomation}
      />
      <div className="scene-canvas-wrapper" ref={wrapperRef}>
        <canvas ref={canvasRef} width={512} height={512} className="scene-canvas" />
      </div>
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
