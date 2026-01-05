import {
  MutableRefObject,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SceneCameraState
} from "@logic/services/scene-object-manager/scene-object-manager.types";
import { SceneObjectManager } from "@logic/services/scene-object-manager/SceneObjectManager";
import { SpellOption } from "@logic/modules/active-map/spellcasting/spellcasting.types";
import { SpellcastingModule } from "@logic/modules/active-map/spellcasting/spellcasting.module";
import { SpellId } from "@db/spells-db";
import {
  BufferStats,
  ParticleStatsState,
  useSceneCanvas,
} from "./useSceneCanvas";
import { GameLoop } from "@logic/services/game-loop/GameLoop";

interface UseSceneCameraInteractionArgs {
  scene: SceneObjectManager;
  spellcasting: SpellcastingModule;
  gameLoop: GameLoop;
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
}

interface UseSceneCameraInteractionResult {
  canvasRef: RefObject<HTMLCanvasElement>;
  wrapperRef: RefObject<HTMLDivElement>;
  summoningPanelRef: RefObject<HTMLDivElement>;
  pointerPressedRef: MutableRefObject<boolean>;
  lastPointerPositionRef: MutableRefObject<{ x: number; y: number } | null>;
  cameraInfoRef: MutableRefObject<SceneCameraState>;
  scaleRef: MutableRefObject<number>;
  scale: number;
  cameraInfo: SceneCameraState;
  scaleRange: { min: number; max: number };
  vboStats: BufferStats;
  particleStatsState: ParticleStatsState;
  handleScaleChange: (value: number) => void;
}

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
}: UseSceneCameraInteractionArgs): UseSceneCameraInteractionResult => {
  // Delay scale initialization until viewport is properly sized
  const hasInitializedScaleRef = useRef(false);
  const [scale, setScale] = useState(() => {
    // Don't initialize from scene yet - wait for first resize
    return scaleRef.current ?? 1;
  });
  const [cameraInfo, setCameraInfo] = useState(
    () => cameraInfoRef.current ?? scene.getCamera()
  );
  const [scaleRange, setScaleRange] = useState(() => scene.getScaleRange());
  const [vboStats, setVboStats] = useState<BufferStats>({ bytes: 0, reallocs: 0 });
  const vboStatsRef = useRef<BufferStats>({ bytes: 0, reallocs: 0 });
  const [particleStatsState, setParticleStatsState] = useState<ParticleStatsState>({
    active: 0,
    capacity: 0,
    emitters: 0,
  });
  const particleStatsRef = useRef<ParticleStatsState>({ active: 0, capacity: 0, emitters: 0 });
  const particleStatsLastUpdateRef = useRef(0);

  const handleScaleChange = useCallback(
    (nextScale: number) => {
      scene.setScale(nextScale);
      const current = scene.getCamera();
      setScale(current.scale);
      setCameraInfo(current);
    },
    [scene]
  );

  useEffect(() => {
    cameraInfoRef.current = cameraInfo;
  }, [cameraInfo]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useSceneCanvas({
    scene,
    spellcasting,
    gameLoop,
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
    setScaleRange,
    setVboStats,
    vboStatsRef,
    setParticleStats: setParticleStatsState,
    particleStatsRef,
    particleStatsLastUpdateRef,
    hasInitializedScaleRef,
    onSpellCast,
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

      spellcasting.tryCastSpell(spellId, worldPosition);
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [isPauseOpen, showTutorial, spellcasting, scene]);

  return {
    canvasRef,
    wrapperRef,
    summoningPanelRef,
    pointerPressedRef,
    lastPointerPositionRef,
    cameraInfoRef,
    scaleRef,
    scale,
    cameraInfo,
    scaleRange,
    vboStats,
    particleStatsState,
    handleScaleChange,
  };
};
