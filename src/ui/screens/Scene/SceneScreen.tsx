import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpellId, SPELL_IDS } from "@db/spells-db";
import {
  DEFAULT_MAP_AUTO_RESTART_STATE,
  MAP_AUTO_RESTART_BRIDGE_KEY,
  MapAutoRestartState,
} from "@logic/modules/active-map/MapModule";
import {
  NECROMANCER_RESOURCES_BRIDGE_KEY,
  NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY,
  NecromancerResourcesPayload,
  NecromancerSpawnOption,
} from "@logic/modules/active-map/NecromancerModule";
import {
  DEFAULT_SPELL_OPTIONS,
  SPELL_OPTIONS_BRIDGE_KEY,
  SpellOption,
} from "@logic/modules/active-map/spells/SpellcastingModule";
import {
  DEFAULT_UNIT_AUTOMATION_STATE,
  UNIT_AUTOMATION_STATE_BRIDGE_KEY,
  UnitAutomationBridgeState,
} from "@logic/modules/active-map/UnitAutomationModule";
import {
  BRICK_COUNT_BRIDGE_KEY,
  BRICK_TOTAL_HP_BRIDGE_KEY,
} from "@logic/modules/active-map/BricksModule";
import {
  PLAYER_UNIT_COUNT_BRIDGE_KEY,
  PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY,
} from "@logic/modules/active-map/units/PlayerUnitsModule";
import { UnitDesignId } from "@logic/modules/camp/UnitDesignModule";
import {
  DEFAULT_RESOURCE_RUN_SUMMARY,
  RESOURCE_RUN_DURATION_BRIDGE_KEY,
  RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
  ResourceRunSummaryPayload,
} from "@logic/modules/shared/ResourcesModule";
import { SceneCameraState } from "@logic/services/SceneObjectManager";
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
import { clearAllAuraSlots } from "@ui/renderers/objects/PlayerUnitObjectRenderer";
import {
  clearPetalAuraInstances,
  petalAuraEffect,
} from "@ui/renderers/primitives/gpu/PetalAuraGpuRenderer";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@shared/useBridgeValue";
import "./SceneScreen.css";
import {
  BufferStats,
  ParticleStatsState,
  useSceneCanvas,
} from "./hooks/useSceneCanvas";
import { SceneTutorialActions } from "./hooks/tutorialSteps";
import { useSceneTutorial } from "./hooks/useSceneTutorial";
import {
  DEFAULT_TUTORIAL_MONITOR_STATUS,
  TUTORIAL_MONITOR_INPUT_BRIDGE_KEY,
  TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY,
  TutorialMonitorStatus,
} from "@logic/modules/active-map/TutorialMonitorModule";

const AUTO_RESTART_SECONDS = 5;

const DEFAULT_NECROMANCER_RESOURCES: NecromancerResourcesPayload = Object.freeze({
  mana: { current: 0, max: 0 },
  sanity: { current: 0, max: 0 },
});

const DEFAULT_NECROMANCER_SPAWN_OPTIONS: NecromancerSpawnOption[] = [];

interface SceneScreenProps {
  onExit: () => void;
  onLeaveToMapSelect: () => void;
  tutorial: SceneTutorialConfig | null;
  onTutorialComplete?: () => void;
}

const cameraEquals = (
  a: SceneCameraState,
  b: SceneCameraState | undefined,
  epsilon = 0.01
): boolean => {
  if (a === b) {
    return true;
  }
  if (!b) {
    return false;
  }
  return (
    Math.abs(a.position.x - b.position.x) <= epsilon &&
    Math.abs(a.position.y - b.position.y) <= epsilon &&
    Math.abs(a.scale - b.scale) <= epsilon &&
    Math.abs(a.viewportSize.width - b.viewportSize.width) <= epsilon &&
    Math.abs(a.viewportSize.height - b.viewportSize.height) <= epsilon
  );
};

export const SceneScreen: React.FC<SceneScreenProps> = ({
  onExit,
  onLeaveToMapSelect,
  tutorial,
  onTutorialComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const summoningPanelRef = useRef<HTMLDivElement | null>(null);
  const { app, bridge, scene } = useAppLogic();
  const spellcasting = app.getSpellcasting();
  // moved high-frequency debug subscriptions into SceneDebugPanel to avoid rerendering SceneScreen every tick
  const brickTotalHp = useBridgeValue<number>(bridge, BRICK_TOTAL_HP_BRIDGE_KEY, 0);
  const unitCount = useBridgeValue<number>(bridge, PLAYER_UNIT_COUNT_BRIDGE_KEY, 0);
  const unitTotalHp = useBridgeValue<number>(bridge, PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY, 0);
  const necromancerResources = useBridgeValue<NecromancerResourcesPayload>(
    bridge,
    NECROMANCER_RESOURCES_BRIDGE_KEY,
    DEFAULT_NECROMANCER_RESOURCES
  );
  const necromancerOptions = useBridgeValue<NecromancerSpawnOption[]>(
    bridge,
    NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY,
    DEFAULT_NECROMANCER_SPAWN_OPTIONS
  );
  const spellOptions = useBridgeValue<SpellOption[]>(
    bridge,
    SPELL_OPTIONS_BRIDGE_KEY,
    DEFAULT_SPELL_OPTIONS
  );
  const resourceSummary = useBridgeValue<ResourceRunSummaryPayload>(
    bridge,
    RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
    DEFAULT_RESOURCE_RUN_SUMMARY
  );
  const automationState = useBridgeValue<UnitAutomationBridgeState>(
    bridge,
    UNIT_AUTOMATION_STATE_BRIDGE_KEY,
    DEFAULT_UNIT_AUTOMATION_STATE
  );
  const tutorialMonitorStatus = useBridgeValue<TutorialMonitorStatus>(
    bridge,
    TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY,
    DEFAULT_TUTORIAL_MONITOR_STATUS
  );
  const autoRestartState = useBridgeValue<MapAutoRestartState>(
    bridge,
    MAP_AUTO_RESTART_BRIDGE_KEY,
    DEFAULT_MAP_AUTO_RESTART_STATE
  );
  const [scale, setScale] = useState(() => scene.getCamera().scale);
  const [cameraInfo, setCameraInfo] = useState(() => scene.getCamera());
  const cameraInfoRef = useRef(cameraInfo);
  const scaleRef = useRef(scale);
  const unitCountRef = useRef(0);
  const unitTotalHpRef = useRef(0);
  const brickTotalHpRef2 = useRef(0);
  const necromancerResourcesRef = useRef<NecromancerResourcesPayload>(DEFAULT_NECROMANCER_RESOURCES);
  const necromancerOptionsRef = useRef<NecromancerSpawnOption[]>(DEFAULT_NECROMANCER_SPAWN_OPTIONS);
  const spellOptionsRef = useRef<SpellOption[]>(DEFAULT_SPELL_OPTIONS);
  const automationStateRef = useRef<UnitAutomationBridgeState>(DEFAULT_UNIT_AUTOMATION_STATE);
  const scaleRange = useMemo(() => scene.getScaleRange(), [scene]);
  const brickInitialHpRef = useRef(0);
  const necromancer = useMemo(() => app.getNecromancer(), [app]);
  const unitAutomation = useMemo(() => app.getUnitAutomation(), [app]);
  const showRunSummary = resourceSummary.completed;
  const [hoverContent, setHoverContent] = useState<SceneTooltipContent | null>(null);
  const [isPauseOpen, setIsPauseOpen] = useState(false);
  const [selectedSpellId, setSelectedSpellId] = useState<SpellId | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      const stored = localStorage.getItem("selectedSpellId");
      if (stored && SPELL_IDS.includes(stored as SpellId)) {
        return stored as SpellId;
      }
    } catch {
      // Ігноруємо помилки localStorage
    }
    return null;
  });
  const selectedSpellIdRef = useRef<SpellId | null>(null);
  const pointerPressedRef = useRef(false);
  const lastPointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const [autoRestartCountdown, setAutoRestartCountdown] = useState(AUTO_RESTART_SECONDS);
  const autoRestartHandledRef = useRef(false);
  const tutorialMonitorVersionRef = useRef(0);
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

  const handlePlayStepAdvance = useCallback(() => {
    setCanAdvancePlayStep(true);
    handleTutorialAdvance(tutorialStepIndex + 1);
  }, [handleTutorialAdvance, tutorialStepIndex]);

  useEffect(() => {
    if (showRunSummary) {
      setHoverContent(null);
    }
  }, [showRunSummary]);

  useEffect(() => {
    if (showRunSummary) {
      setIsPauseOpen(false);
    }
  }, [showRunSummary]);

  useEffect(() => {
    if (isPauseOpen) {
      setHoverContent(null);
    }
  }, [isPauseOpen]);

  useEffect(() => {
    if (showTutorial) {
      setHoverContent(null);
      setIsPauseOpen(false);
    }
  }, [showTutorial]);

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
    if (brickTotalHp > brickInitialHpRef.current) {
      brickInitialHpRef.current = brickTotalHp;
    } else if (brickInitialHpRef.current === 0 && brickTotalHp > 0) {
      brickInitialHpRef.current = brickTotalHp;
    }
  }, [brickTotalHp]);

  useEffect(() => {
    cameraInfoRef.current = cameraInfo;
  }, [cameraInfo]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    unitCountRef.current = unitCount;
  }, [unitCount]);

  useEffect(() => {
    unitTotalHpRef.current = unitTotalHp;
  }, [unitTotalHp]);

  useEffect(() => {
    brickTotalHpRef2.current = brickTotalHp;
  }, [brickTotalHp]);

  useEffect(() => {
    necromancerResourcesRef.current = necromancerResources;
  }, [necromancerResources]);

  useEffect(() => {
    necromancerOptionsRef.current = necromancerOptions;
  }, [necromancerOptions]);

  useEffect(() => {
    spellOptionsRef.current = spellOptions;
  }, [spellOptions]);

  // Періодична перевірка для касту спелів при затиснутій миші (навіть без руху)
  useEffect(() => {
    if (isPauseOpen || showTutorial) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const interval = window.setInterval(() => {
      if (!pointerPressedRef.current || !lastPointerPositionRef.current) {
        return;
      }

      const spellId = selectedSpellIdRef.current;
      if (!spellId) {
        return;
      }

      const spell = spellOptionsRef.current.find((option) => option.id === spellId);
      if (!spell || spell.remainingCooldownMs > 0) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      // Конвертуємо canvas координати назад в viewport координати
      const viewportX = (lastPointerPositionRef.current.x / canvas.width) * rect.width;
      const viewportY = (lastPointerPositionRef.current.y / canvas.height) * rect.height;
      
      // Обчислюємо world position напряму
      const rawX = viewportX / rect.width;
      const rawY = viewportY / rect.height;
      if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
        return;
      }
      
      const cameraState = scene.getCamera();
      const normalizedX = Math.min(Math.max(rawX, 0), 1);
      const normalizedY = Math.min(Math.max(rawY, 0), 1);
      const worldPosition = {
        x: cameraState.position.x + normalizedX * cameraState.viewportSize.width,
        y: cameraState.position.y + normalizedY * cameraState.viewportSize.height,
      };

      spellcasting.tryCastSpell(spellId, worldPosition);
    }, 250); // Перевіряємо кожні 250ms

    return () => {
      window.clearInterval(interval);
    };
  }, [isPauseOpen, showTutorial, spellcasting, scene]);

  useEffect(() => {
    selectedSpellIdRef.current = selectedSpellId;
    if (typeof window !== "undefined") {
      if (selectedSpellId) {
        localStorage.setItem("selectedSpellId", selectedSpellId);
      } else {
        localStorage.removeItem("selectedSpellId");
      }
    }
  }, [selectedSpellId]);

  useEffect(() => {
    // Перевіряємо тільки якщо є доступні спели
    if (spellOptions.length === 0) {
      return;
    }
    
    if (!selectedSpellId) {
      // Якщо немає вибраного спела, вибираємо перший доступний
      setSelectedSpellId(spellOptions[0]!.id);
      return;
    }
    
    // Перевіряємо, чи вибраний спел ще є в списку доступних
    // (навіть якщо не вистачає ресурсів, спел має залишатися вибраним)
    const stillAvailable = spellOptions.some((spell) => spell.id === selectedSpellId);
    if (!stillAvailable) {
      // Якщо вибраний спел більше не існує в списку, вибираємо перший доступний
      setSelectedSpellId(spellOptions[0]!.id);
    }
  }, [selectedSpellId, spellOptions]);

  useEffect(() => {
    automationStateRef.current = automationState;
  }, [automationState]);

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
    const gameLoop = app.getGameLoop();
    const shouldPauseForTutorial = showTutorial && !allowTutorialGameplay;
    if (isPauseOpen || shouldPauseForTutorial) {
      gameLoop.stop();
      return () => {
        gameLoop.start();
      };
    }
    gameLoop.start();
    return undefined;
  }, [allowTutorialGameplay, app, isPauseOpen, showTutorial]);

  const handleScaleChange = (nextScale: number) => {
    scene.setScale(nextScale);
    const current = scene.getCamera();
    setScale(current.scale);
    setCameraInfo(current);
  };

  const handleSummonDesign = useCallback(
    (designId: UnitDesignId) => {
      const wasSummoned = necromancer.trySpawnDesign(designId);
      if (wasSummoned) {
        const option = necromancerOptionsRef.current.find((entry) => entry.designId === designId);
        if (option?.type === "bluePentagon") {
          registerTutorialAction("summon-blue-vanguard");
          setTutorialSummonDone(true);
        }
      }
    },
    [necromancer, registerTutorialAction]
  );

  useEffect(() => {
    setTutorialActions({
      summonBlueVanguard: () => handleSummonDesign("bluePentagon"),
    });
  }, [handleSummonDesign]);

  useEffect(() => {
    if (!showTutorial || activeTutorialStep?.id !== "summon-blue-vanguard") {
      bridge.setValue(TUTORIAL_MONITOR_INPUT_BRIDGE_KEY, { active: false });
      return;
    }
    bridge.setValue(TUTORIAL_MONITOR_INPUT_BRIDGE_KEY, {
      active: true,
      stepId: "summon-blue-vanguard",
      actionCompleted: tutorialSummonDone,
      bricksRequired: 3,
    });
  }, [activeTutorialStep?.id, bridge, showTutorial, tutorialSummonDone]);

  useEffect(() => {
    if (!showTutorial) {
      return;
    }
    if (activeTutorialStep?.id !== "summon-blue-vanguard") {
      return;
    }
    if (!tutorialMonitorStatus.ready) {
      return;
    }
    if (tutorialMonitorStatus.stepId !== "summon-blue-vanguard") {
      return;
    }
    if (tutorialMonitorVersionRef.current === tutorialMonitorStatus.version) {
      return;
    }
    tutorialMonitorVersionRef.current = tutorialMonitorStatus.version;
    handlePlayStepAdvance();
  }, [
    activeTutorialStep?.id,
    handlePlayStepAdvance,
    handleTutorialAdvance,
    showTutorial,
    tutorialMonitorStatus.ready,
    tutorialMonitorStatus.stepId,
    tutorialMonitorStatus.version,
    tutorialStepIndex,
  ]);

  useEffect(() => {
    if (!showTutorial) {
      return;
    }
    if (activeTutorialStep?.id !== "summon-blue-vanguard") {
      return;
    }
    if (!tutorialSummonDone || canAdvancePlayStep) {
      return;
    }
    if (necromancerResources.sanity.current > 1) {
      return;
    }
    handlePlayStepAdvance();
  }, [
    activeTutorialStep?.id,
    canAdvancePlayStep,
    handlePlayStepAdvance,
    necromancerResources.sanity.current,
    showTutorial,
    tutorialSummonDone,
  ]);

  const handleSelectSpell = useCallback((spellId: SpellId) => {
    setSelectedSpellId((current) => (current === spellId ? null : spellId));
  }, []);

  const handleToggleAutomation = useCallback(
    (designId: UnitDesignId, enabled: boolean) => {
      unitAutomation.setAutomationEnabled(designId, enabled);
    },
    [unitAutomation]
  );

  const restartMap = useCallback(() => {
    clearAllAuraSlots();
    const auraContext = petalAuraEffect.getPrimaryContext();
    if (auraContext) {
      clearPetalAuraInstances(auraContext);
    } else {
      clearPetalAuraInstances();
    }
    app.restartCurrentMap();
  }, [app, clearAllAuraSlots, clearPetalAuraInstances]);

  const handleToggleAutoRestart = useCallback(
    (enabled: boolean) => {
      app.setAutoRestartEnabled(enabled);
    },
    [app]
  );

  const handleRestart = useCallback(() => {
    autoRestartHandledRef.current = true;
    restartMap();
  }, [restartMap]);

  const handleResume = useCallback(() => {
    setIsPauseOpen(false);
  }, []);

  const handleLeaveToCamp = useCallback(() => {
    setIsPauseOpen(false);
    onLeaveToMapSelect();
  }, [onLeaveToMapSelect]);

  useEffect(() => {
    if (!showRunSummary) {
      autoRestartHandledRef.current = false;
      setAutoRestartCountdown(AUTO_RESTART_SECONDS);
      return;
    }
    if (!autoRestartState.unlocked) {
      autoRestartHandledRef.current = false;
      setAutoRestartCountdown(AUTO_RESTART_SECONDS);
      return;
    }
    if (!autoRestartState.enabled) {
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
  }, [
    autoRestartState.enabled,
    autoRestartState.unlocked,
    restartMap,
    showRunSummary,
  ]);




  const brickInitialHp = brickInitialHpRef.current;
  const [toolbarState, setToolbarState] = useState(() => ({
    brickTotalHp,
    brickInitialHp,
    unitCount,
    unitTotalHp,
    scale,
    cameraPosition: cameraInfo.position,
  }));

  const [summoningProps, setSummoningProps] = useState(() => ({
    resources: necromancerResources,
    spawnOptions: necromancerOptions,
    automation: automationState,
    spells: spellOptions,
    unitCount,
  }));

  // Throttle toolbar updates to at most 5 times per second
  useEffect(() => {
    const interval = window.setInterval(() => {
      setToolbarState({
        brickTotalHp: brickTotalHpRef2.current,
        brickInitialHp: brickInitialHpRef.current,
        unitCount: unitCountRef.current,
        unitTotalHp: unitTotalHpRef.current,
        scale: scaleRef.current,
        cameraPosition: { ...cameraInfoRef.current.position },
      });
      setSummoningProps({
        resources: necromancerResourcesRef.current,
        spawnOptions: necromancerOptionsRef.current,
        automation: automationStateRef.current,
        spells: spellOptionsRef.current,
        unitCount: unitCountRef.current,
      });
    }, 200);
    return () => window.clearInterval(interval);
  }, []);
  const [vboStats, setVboStats] = useState<BufferStats>({ bytes: 0, reallocs: 0 });
  const vboStatsRef = useRef<BufferStats>({ bytes: 0, reallocs: 0 });
  const [particleStatsState, setParticleStatsState] = useState<ParticleStatsState>({
    active: 0,
    capacity: 0,
    emitters: 0,
  });
  const particleStatsRef = useRef<ParticleStatsState>({ active: 0, capacity: 0, emitters: 0 });
  const particleStatsLastUpdateRef = useRef(0);

  useSceneCanvas({
    scene,
    spellcasting,
    canvasRef,
    wrapperRef,
    summoningPanelRef,
    selectedSpellIdRef,
    spellOptionsRef,
    pointerPressedRef,
    lastPointerPositionRef,
    cameraInfoRef,
    scaleRef,
    setScale,
    setCameraInfo,
    setVboStats,
    vboStatsRef,
    setParticleStats: setParticleStatsState,
    particleStatsRef,
    particleStatsLastUpdateRef,
  });

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
          primaryAction={{ label: "Return to Void Lab", onClick: onLeaveToMapSelect }}
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
