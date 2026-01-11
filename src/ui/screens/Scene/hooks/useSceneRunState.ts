import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { DataBridge } from "@/core/logic/ui/DataBridge";
import type { MapAutoRestartState, MapModuleUiApi } from "@logic/modules/active-map/map/map.types";
import {
  DEFAULT_MAP_AUTO_RESTART_STATE,
  MAP_AUTO_RESTART_BRIDGE_KEY,
} from "@logic/modules/active-map/map/map.const";
import {
  NECROMANCER_RESOURCES_BRIDGE_KEY,
  NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY,
} from "@logic/modules/active-map/necromancer/necromancer.const";
import type {
  NecromancerModuleUiApi,
  NecromancerResourcesPayload,
  NecromancerSpawnOption,
} from "@logic/modules/active-map/necromancer/necromancer.types";
import { SpellOption } from "@logic/modules/active-map/spellcasting/spellcasting.types";
import {
  DEFAULT_SPELL_OPTIONS,
  SPELL_OPTIONS_BRIDGE_KEY,
} from "@logic/modules/active-map/spellcasting/spellcasting.const";
import type { UnitAutomationBridgeState, UnitAutomationModuleUiApi } from "@logic/modules/active-map/unit-automation/unit-automation.types";
import {
  DEFAULT_UNIT_AUTOMATION_STATE,
  UNIT_AUTOMATION_STATE_BRIDGE_KEY,
} from "@logic/modules/active-map/unit-automation/unit-automation.const";
import { BRICK_TOTAL_HP_BRIDGE_KEY } from "@logic/modules/active-map/bricks/bricks.const";
import {
  PLAYER_UNIT_COUNT_BRIDGE_KEY,
  PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY,
} from "@logic/modules/active-map/player-units/player-units.const";
import { UnitDesignId } from "@logic/modules/camp/unit-design/unit-design.types";
import {
  RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
  DEFAULT_RESOURCE_RUN_SUMMARY,
} from "@logic/modules/shared/resources/resources.const";
import type { ResourceRunSummaryPayload } from "@logic/modules/shared/resources/resources.types";
import { SceneCameraState } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { useBridgeRef } from "@ui-shared/useBridgeRef";
import { clearAllAuraSlots } from "@ui/renderers/objects";
import { petalAuraGpuRenderer } from "@ui/renderers/primitives/gpu/petal-aura";

const AUTO_RESTART_SECONDS = 5;
const DEFAULT_NECROMANCER_RESOURCES: NecromancerResourcesPayload = {
  mana: { current: 0, max: 0 },
  sanity: { current: 0, max: 0 },
};
const EMPTY_SPAWN_OPTIONS: NecromancerSpawnOption[] = [];

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
  map: MapModuleUiApi;
  necromancer: NecromancerModuleUiApi;
  unitAutomation: UnitAutomationModuleUiApi;
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
  map,
  necromancer,
  unitAutomation,
  cameraInfoRef,
  scaleRef,
  spellOptionsRef,
}: UseSceneRunStateArgs): UseSceneRunStateResult => {
  const resourceSummary = useBridgeValue(
    bridge,
    RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
    DEFAULT_RESOURCE_RUN_SUMMARY
  );
  const autoRestartState = useBridgeValue(
    bridge,
    MAP_AUTO_RESTART_BRIDGE_KEY,
    DEFAULT_MAP_AUTO_RESTART_STATE
  );
  const [autoRestartCountdown, setAutoRestartCountdown] = useState(AUTO_RESTART_SECONDS);
  const autoRestartHandledRef = useRef(false);
  const brickInitialHpRef = useRef(0);
  const unitCountRef = useBridgeRef(bridge, PLAYER_UNIT_COUNT_BRIDGE_KEY, 0);
  const unitTotalHpRef = useBridgeRef(bridge, PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY, 0);
  const necromancerResourcesRef = useBridgeRef(
    bridge,
    NECROMANCER_RESOURCES_BRIDGE_KEY,
    DEFAULT_NECROMANCER_RESOURCES
  );
  const necromancerOptionsRef = useBridgeRef(
    bridge,
    NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY,
    EMPTY_SPAWN_OPTIONS
  );
  const automationStateRef = useBridgeRef(
    bridge,
    UNIT_AUTOMATION_STATE_BRIDGE_KEY,
    DEFAULT_UNIT_AUTOMATION_STATE
  );
  const handleSpellOptionsChange = useCallback(
    (value: SpellOption[]) => {
      spellOptionsRef.current = value;
    },
    [spellOptionsRef]
  );
  const spellOptionsBridgeRef = useBridgeRef(
    bridge,
    SPELL_OPTIONS_BRIDGE_KEY,
    DEFAULT_SPELL_OPTIONS,
    handleSpellOptionsChange
  );
  const brickTotalHpRef = useRef(0);

  useEffect(() => {
    const applyBrickTotals = (value: number | undefined) => {
      const next = value ?? 0;
      brickTotalHpRef.current = next;
      if (next > brickInitialHpRef.current) {
        brickInitialHpRef.current = next;
      } else if (brickInitialHpRef.current === 0 && next > 0) {
        brickInitialHpRef.current = next;
      }
    };
    applyBrickTotals(bridge.getValue(BRICK_TOTAL_HP_BRIDGE_KEY));
    const unsubscribe = bridge.subscribe(BRICK_TOTAL_HP_BRIDGE_KEY, applyBrickTotals);
    return unsubscribe;
  }, [bridge]);

  useEffect(() => {
    spellOptionsRef.current = spellOptionsBridgeRef.current;
  }, [spellOptionsBridgeRef, spellOptionsRef]);

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

  const [toolbarState, setToolbarState] = useState<ToolbarState>(() => ({
    brickTotalHp: brickTotalHpRef.current,
    brickInitialHp: brickInitialHpRef.current,
    unitCount: unitCountRef.current,
    unitTotalHp: unitTotalHpRef.current,
    scale: scaleRef.current,
    cameraPosition: cameraInfoRef.current.position,
  }));
  const [summoningProps, setSummoningProps] = useState<SummoningProps>(() => ({
    resources: necromancerResourcesRef.current,
    spawnOptions: necromancerOptionsRef.current,
    automation: automationStateRef.current,
    spells: spellOptionsBridgeRef.current,
    unitCount: unitCountRef.current,
  }));
  const toolbarStateRef = useRef(toolbarState);
  const summoningPropsRef = useRef<SummoningProps>({
    resources: necromancerResourcesRef.current,
    spawnOptions: necromancerOptionsRef.current,
    automation: automationStateRef.current,
    spells: spellOptionsBridgeRef.current,
    unitCount: unitCountRef.current,
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextToolbarState = {
        brickTotalHp: brickTotalHpRef.current,
        brickInitialHp: brickInitialHpRef.current,
        unitCount: unitCountRef.current,
        unitTotalHp: unitTotalHpRef.current,
        scale: scaleRef.current,
        cameraPosition: cameraInfoRef.current.position,
      };
      const previousToolbarState = toolbarStateRef.current;
      const hasCameraPositionChange =
        previousToolbarState.cameraPosition.x !== nextToolbarState.cameraPosition.x ||
        previousToolbarState.cameraPosition.y !== nextToolbarState.cameraPosition.y;
      const hasToolbarChange =
        previousToolbarState.brickTotalHp !== nextToolbarState.brickTotalHp ||
        previousToolbarState.brickInitialHp !== nextToolbarState.brickInitialHp ||
        previousToolbarState.unitCount !== nextToolbarState.unitCount ||
        previousToolbarState.unitTotalHp !== nextToolbarState.unitTotalHp ||
        previousToolbarState.scale !== nextToolbarState.scale ||
        hasCameraPositionChange;
      if (hasToolbarChange) {
        const cameraPosition = hasCameraPositionChange
          ? { ...nextToolbarState.cameraPosition }
          : previousToolbarState.cameraPosition;
        const updatedToolbarState = { ...nextToolbarState, cameraPosition };
        toolbarStateRef.current = updatedToolbarState;
        setToolbarState(updatedToolbarState);
      }

      const nextSummoningProps = {
        resources: necromancerResourcesRef.current,
        spawnOptions: necromancerOptionsRef.current,
        automation: automationStateRef.current,
        spells: spellOptionsRef.current,
        unitCount: unitCountRef.current,
      };
      const previousSummoningProps = summoningPropsRef.current;
      const hasSummoningChange =
        previousSummoningProps.resources !== nextSummoningProps.resources ||
        previousSummoningProps.spawnOptions !== nextSummoningProps.spawnOptions ||
        previousSummoningProps.automation !== nextSummoningProps.automation ||
        previousSummoningProps.spells !== nextSummoningProps.spells ||
        previousSummoningProps.unitCount !== nextSummoningProps.unitCount;
      if (hasSummoningChange) {
        summoningPropsRef.current = nextSummoningProps;
        setSummoningProps(nextSummoningProps);
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, [cameraInfoRef, scaleRef]);

  const necromancerResources = summoningProps.resources;
  const spellOptions = summoningProps.spells;
  const automationState = summoningProps.automation;

  return {
    brickInitialHp: brickInitialHpRef.current,
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
