import {
  MutableRefObject,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type {
  SceneCameraState,
  SceneUiApi,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { SpellOption } from "@logic/modules/active-map/spellcasting/spellcasting.types";
import type { SpellcastingModuleUiApi } from "@logic/modules/active-map/spellcasting/spellcasting.types";
import { SpellId } from "@db/spells-db";
import {
  BufferStats,
  ParticleStatsState,
  useSceneCanvas,
} from "./useSceneCanvas";
import type { GameLoopUiApi } from "@core/logic/provided/services/game-loop/game-loop.types";
import type { MapEffectsBridgeState } from "@logic/modules/active-map/map/map.types";

interface UseSceneCameraInteractionArgs {
  scene: SceneUiApi;
  spellcasting: SpellcastingModuleUiApi;
  gameLoop: GameLoopUiApi;
  mapEffectsRef: MutableRefObject<MapEffectsBridgeState>;
  selectedSpellIdRef: MutableRefObject<SpellId | null>;
  spellOptionsRef: MutableRefObject<SpellOption[]>;
  isPauseOpen: boolean;
  showTutorial: boolean;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  wrapperRef: MutableRefObject<HTMLDivElement | null>;
  summoningPanelRef: MutableRefObject<HTMLDivElement | null>;
  cameraInfoRef: MutableRefObject<SceneCameraState>;
  scaleRef: MutableRefObject<number>;
  pointerPressedRef: MutableRefObject<boolean>;
  lastPointerPositionRef: MutableRefObject<{ x: number; y: number } | null>;
  onSpellCast?: (spellId: SpellId) => void;
  onInspectTarget?: (position: SceneVector2) => void;
}

interface UseSceneCameraInteractionResult {
  canvasRef: RefObject<HTMLCanvasElement>;
  wrapperRef: RefObject<HTMLDivElement>;
  summoningPanelRef: RefObject<HTMLDivElement>;
  pointerPressedRef: MutableRefObject<boolean>;
  lastPointerPositionRef: MutableRefObject<{ x: number; y: number } | null>;
  cameraInfoRef: MutableRefObject<SceneCameraState>;
  scaleRef: MutableRefObject<number>;
  cameraUiStore: CameraUiStore;
  handleScaleChange: (value: number) => void;
}

export interface CameraUiState {
  scale: number;
  cameraInfo: SceneCameraState;
  scaleRange: { min: number; max: number };
}

export interface CameraUiStore {
  getSnapshot: () => CameraUiState;
  subscribe: (listener: () => void) => () => void;
}

type CameraUiUpdate = Partial<CameraUiState>;

export const useSceneCameraInteraction = ({
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
  onSpellCast,
  onInspectTarget,
  mapEffectsRef,
}: UseSceneCameraInteractionArgs): UseSceneCameraInteractionResult => {
  // Delay scale initialization until viewport is properly sized
  const hasInitializedScaleRef = useRef(false);
  const cameraUiStateRef = useRef<CameraUiState>({
    scale: scaleRef.current ?? 1,
    cameraInfo: cameraInfoRef.current ?? scene.getCamera(),
    scaleRange: scene.getScaleRange(),
  });
  const cameraUiListenersRef = useRef(new Set<() => void>());
  const cameraUiStore = useMemo<CameraUiStore>(
    () => ({
      getSnapshot: () => cameraUiStateRef.current,
      subscribe: (listener) => {
        cameraUiListenersRef.current.add(listener);
        return () => {
          cameraUiListenersRef.current.delete(listener);
        };
      },
    }),
    []
  );
  const notifyCameraUi = useCallback(() => {
    cameraUiListenersRef.current.forEach((listener) => listener());
  }, []);
  const updateCameraUi = useCallback(
    (next: CameraUiUpdate) => {
      const current = cameraUiStateRef.current;
      let hasChange = false;
      const updated: CameraUiState = { ...current };

      if (next.scale !== undefined && next.scale !== current.scale) {
        updated.scale = next.scale;
        hasChange = true;
      }
      if (next.cameraInfo !== undefined) {
        const nextCamera = next.cameraInfo;
        const prevCamera = current.cameraInfo;
        const hasCameraChange =
          Math.abs(nextCamera.position.x - prevCamera.position.x) > 0.0001 ||
          Math.abs(nextCamera.position.y - prevCamera.position.y) > 0.0001 ||
          Math.abs(nextCamera.viewportSize.width - prevCamera.viewportSize.width) > 0.0001 ||
          Math.abs(nextCamera.viewportSize.height - prevCamera.viewportSize.height) > 0.0001 ||
          Math.abs(nextCamera.scale - prevCamera.scale) > 0.0001;
        if (hasCameraChange) {
          updated.cameraInfo = nextCamera;
          hasChange = true;
        }
      }
      if (next.scaleRange !== undefined) {
        const nextRange = next.scaleRange;
        const prevRange = current.scaleRange;
        if (nextRange.min !== prevRange.min || nextRange.max !== prevRange.max) {
          updated.scaleRange = nextRange;
          hasChange = true;
        }
      }

      if (hasChange) {
        cameraUiStateRef.current = updated;
        notifyCameraUi();
      }
    },
    [notifyCameraUi]
  );
  // Debug stats are now written to global debugStats object (no React state)
  const vboStatsRef = useRef<BufferStats>({ bytes: 0, reallocs: 0 });
  const particleStatsRef = useRef<ParticleStatsState>({ active: 0, capacity: 0, emitters: 0 });
  const particleStatsLastUpdateRef = useRef(0);

  const handleScaleChange = useCallback(
    (nextScale: number) => {
      scene.setScale(nextScale);
      const current = scene.getCamera();
      scaleRef.current = current.scale;
      cameraInfoRef.current = current;
      updateCameraUi({ scale: current.scale, cameraInfo: current });
    },
    [cameraInfoRef, scaleRef, scene, updateCameraUi]
  );

  useSceneCanvas({
    scene,
    spellcasting,
    gameLoop,
    mapEffectsRef,
    canvasRef,
    wrapperRef,
    summoningPanelRef,
    selectedSpellIdRef,
    spellOptionsRef,
    pointerPressedRef,
    lastPointerPositionRef,
    cameraInfoRef,
    scaleRef,
    onCameraUiChange: updateCameraUi,
    vboStatsRef,
    particleStatsRef,
    particleStatsLastUpdateRef,
    hasInitializedScaleRef,
    onSpellCast,
    onInspectTarget,
  });

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

      const viewportX = (lastPointerPositionRef.current.x / canvas.width) * rect.width;
      const viewportY = (lastPointerPositionRef.current.y / canvas.height) * rect.height;

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

      const castSuccess = spellcasting.tryCastSpell(spellId, worldPosition);
      if (castSuccess) {
        onSpellCast?.(spellId);
      }
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [isPauseOpen, showTutorial, onSpellCast, spellcasting, scene]);

  return {
    canvasRef,
    wrapperRef,
    summoningPanelRef,
    pointerPressedRef,
    lastPointerPositionRef,
    cameraInfoRef,
    scaleRef,
    cameraUiStore,
    handleScaleChange,
  };
};
