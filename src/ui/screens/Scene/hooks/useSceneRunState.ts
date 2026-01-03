import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataBridge } from "@logic/core/DataBridge";
import { MapAutoRestartState } from "@logic/modules/active-map/map/map.types";
import {
  DEFAULT_MAP_AUTO_RESTART_STATE,
  MAP_AUTO_RESTART_BRIDGE_KEY,
} from "@logic/modules/active-map/map/map.const";
import {
  NECROMANCER_RESOURCES_BRIDGE_KEY,
  NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY,
} from "@logic/modules/active-map/necromancer/necromancer.const";
import type {
  NecromancerResourcesPayload,
  NecromancerSpawnOption,
} from "@logic/modules/active-map/necromancer/necromancer.types";
import { SpellOption } from "@logic/modules/active-map/spellcasting/spellcasting.types";
import {
  DEFAULT_SPELL_OPTIONS,
  SPELL_OPTIONS_BRIDGE_KEY,
} from "@logic/modules/active-map/spellcasting/spellcasting.const";
import { UnitAutomationBridgeState } from "@logic/modules/active-map/unit-automation/unit-automation.types";
import {
  DEFAULT_UNIT_AUTOMATION_STATE,
  UNIT_AUTOMATION_STATE_BRIDGE_KEY,
} from "@logic/modules/active-map/unit-automation/unit-automation.const";
import { BRICK_TOTAL_HP_BRIDGE_KEY } from "@logic/modules/active-map/bricks/bricks.const";
import {
  PLAYER_UNIT_COUNT_BRIDGE_KEY,
  PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY,
} from "@logic/modules/active-map/player-units/player-units.module";
import { UnitDesignId } from "@logic/modules/camp/unit-design/unit-design.types";
import {
  RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
  DEFAULT_RESOURCE_RUN_SUMMARY,
} from "@logic/modules/shared/resources/resources.const";
import type { ResourceRunSummaryPayload } from "@logic/modules/shared/resources/resources.types";
import { SceneCameraState } from "@logic/services/scene-object-manager/scene-object-manager.types";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { clearAllAuraSlots } from "@ui/renderers/objects";
import {
  clearPetalAuraInstances,
  petalAuraEffect,
} from "@ui/renderers/primitives/gpu/PetalAuraGpuRenderer";

const AUTO_RESTART_SECONDS = 5;

interface ToolbarState {
  brickTotalHp: number;
  brickInitialHp: number;
  unitCount: number;
  unitTotalHp: number;
  scale: number;
  cameraPosition: SceneCameraState["position"];
}

interface SummoningProps {
  resources: NecromancerResourcesPayload;
  spawnOptions: NecromancerSpawnOption[];
  automation: UnitAutomationBridgeState;
  spells: SpellOption[];
  unitCount: number;
}

interface UseSceneRunStateArgs {
  bridge: DataBridge;
  app: {
    restartCurrentMap: () => void;
    setAutoRestartEnabled: (enabled: boolean) => void;
  };
  necromancer: { trySpawnDesign: (designId: UnitDesignId) => boolean };
  unitAutomation: { setAutomationEnabled: (designId: UnitDesignId, enabled: boolean) => void };
  cameraInfoRef: MutableRefObject<SceneCameraState>;
  scaleRef: MutableRefObject<number>;
  spellOptionsRef: MutableRefObject<SpellOption[]>;
}

interface UseSceneRunStateResult {
  brickInitialHp: number;
  toolbarState: ToolbarState;
  summoningProps: SummoningProps;
  resourceSummary: ResourceRunSummaryPayload;
  necromancerResources: NecromancerResourcesPayload;
  autoRestartState: MapAutoRestartState;
  autoRestartCountdown: number;
  spellOptions: SpellOption[];
  automationState: UnitAutomationBridgeState;
  handleToggleAutomation: (designId: UnitDesignId, enabled: boolean) => void;
  handleToggleAutoRestart: (enabled: boolean) => void;
  handleRestart: () => void;
  showRunSummary: boolean;
}

export const useSceneRunState = ({
  bridge,
  app,
  necromancer,
  unitAutomation,
  cameraInfoRef,
  scaleRef,
  spellOptionsRef,
}: UseSceneRunStateArgs): UseSceneRunStateResult => {
  const brickTotalHp = useBridgeValue<number>(bridge, BRICK_TOTAL_HP_BRIDGE_KEY, 0);
  const unitCount = useBridgeValue<number>(bridge, PLAYER_UNIT_COUNT_BRIDGE_KEY, 0);
  const unitTotalHp = useBridgeValue<number>(bridge, PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY, 0);
  const necromancerResources = useBridgeValue<NecromancerResourcesPayload>(
    bridge,
    NECROMANCER_RESOURCES_BRIDGE_KEY,
    { mana: { current: 0, max: 0 }, sanity: { current: 0, max: 0 } }
  );
  const necromancerOptions = useBridgeValue<NecromancerSpawnOption[]>(
    bridge,
    NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY,
    []
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
  const autoRestartState = useBridgeValue<MapAutoRestartState>(
    bridge,
    MAP_AUTO_RESTART_BRIDGE_KEY,
    DEFAULT_MAP_AUTO_RESTART_STATE
  );
  const [autoRestartCountdown, setAutoRestartCountdown] = useState(AUTO_RESTART_SECONDS);
  const autoRestartHandledRef = useRef(false);
  const automationStateRef = useRef<UnitAutomationBridgeState>(DEFAULT_UNIT_AUTOMATION_STATE);
  const necromancerResourcesRef = useRef<NecromancerResourcesPayload>(necromancerResources);
  const necromancerOptionsRef = useRef<NecromancerSpawnOption[]>(necromancerOptions);
  const unitCountRef = useRef(unitCount);
  const unitTotalHpRef = useRef(unitTotalHp);
  const brickTotalHpRef = useRef(brickTotalHp);
  const brickInitialHpRef = useRef(0);

  useEffect(() => {
    if (brickTotalHp > brickInitialHpRef.current) {
      brickInitialHpRef.current = brickTotalHp;
    } else if (brickInitialHpRef.current === 0 && brickTotalHp > 0) {
      brickInitialHpRef.current = brickTotalHp;
    }
  }, [brickTotalHp]);

  // Sync all state values to refs in a single effect to reduce overhead
  useEffect(() => {
    spellOptionsRef.current = spellOptions;
    automationStateRef.current = automationState;
    necromancerResourcesRef.current = necromancerResources;
    necromancerOptionsRef.current = necromancerOptions;
    unitCountRef.current = unitCount;
    unitTotalHpRef.current = unitTotalHp;
    brickTotalHpRef.current = brickTotalHp;
  }, [
    spellOptions,
    automationState,
    necromancerResources,
    necromancerOptions,
    unitCount,
    unitTotalHp,
    brickTotalHp,
  ]);

  const restartMap = useCallback(() => {
    clearAllAuraSlots();
    const auraContext = petalAuraEffect.getPrimaryContext();
    if (auraContext) {
      clearPetalAuraInstances(auraContext);
    } else {
      clearPetalAuraInstances();
    }
    app.restartCurrentMap();
  }, [app]);

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

  const handleToggleAutomation = useCallback(
    (designId: UnitDesignId, enabled: boolean) => {
      unitAutomation.setAutomationEnabled(designId, enabled);
    },
    [unitAutomation]
  );

  useEffect(() => {
    if (!resourceSummary.completed) {
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
  }, [autoRestartState.enabled, autoRestartState.unlocked, resourceSummary.completed, restartMap]);

  const brickInitialHp = brickInitialHpRef.current;
  const initialToolbarState = useMemo(
    () => ({
      brickTotalHp,
      brickInitialHp,
      unitCount,
      unitTotalHp,
      scale: scaleRef.current,
      cameraPosition: cameraInfoRef.current.position,
    }),
    [brickInitialHp, brickTotalHp, cameraInfoRef, scaleRef, unitCount, unitTotalHp]
  );

  const [toolbarState, setToolbarState] = useState<ToolbarState>(initialToolbarState);
  const [summoningProps, setSummoningProps] = useState<SummoningProps>(() => ({
    resources: necromancerResources,
    spawnOptions: necromancerOptions,
    automation: automationState,
    spells: spellOptions,
    unitCount,
  }));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setToolbarState({
        brickTotalHp: brickTotalHpRef.current,
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
  }, [cameraInfoRef, scaleRef]);

  return {
    brickInitialHp,
    toolbarState,
    summoningProps,
    resourceSummary,
    necromancerResources,
    autoRestartState,
    autoRestartCountdown,
    spellOptions,
    automationState,
    handleToggleAutomation,
    handleToggleAutoRestart,
    handleRestart,
    showRunSummary: resourceSummary.completed,
  };
};
