import { useEffect, useRef, memo } from "react";
import { DataBridge } from "@/core/logic/ui/DataBridge";
import { RESOURCE_RUN_DURATION_BRIDGE_KEY } from "@logic/modules/shared/resources/resources.module";
import { formatDuration } from "@ui/utils/formatDuration";
import { debugStats } from "./debugStats";
import "./SceneDebugPanel.css";

interface SceneDebugPanelProps {
  bridge?: DataBridge;
}

const UPDATE_INTERVAL_MS = 500;

/**
 * Debug panel that reads stats from global debugStats object
 * instead of React props to avoid triggering re-renders.
 * 
 * FPS is now calculated in the render loop (tickFrame) - no separate rAF needed.
 */
const SceneDebugPanelInner: React.FC<SceneDebugPanelProps> = ({ bridge }) => {
  const timeRef = useRef<HTMLDivElement | null>(null);
  const fpsRef = useRef<HTMLDivElement | null>(null);
  const vboRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<HTMLDivElement | null>(null);
  const movableRef = useRef<HTMLDivElement | null>(null);
  const unitsRef = useRef<HTMLDivElement | null>(null);
  const jointsRef = useRef<HTMLDivElement | null>(null);
  const animationsRef = useRef<HTMLDivElement | null>(null);
  const joinedRef = useRef<HTMLDivElement | null>(null);
  const joinedTimingRef = useRef<HTMLDivElement | null>(null);
  const lastDisplayedTime = useRef<string | null>(null);
  const lastDisplayedFps = useRef<number | null>(null);
  const lastDisplayedVbo = useRef<string | null>(null);
  const lastDisplayedParticles = useRef<string | null>(null);
  const lastDisplayedMovable = useRef<string | null>(null);
  const lastDisplayedUnits = useRef<string | null>(null);
  const lastDisplayedJoints = useRef<string | null>(null);
  const lastDisplayedAnimations = useRef<string | null>(null);
  const lastDisplayedJoined = useRef<string | null>(null);
  const lastDisplayedJoinedTiming = useRef<string | null>(null);

  useEffect(() => {
    const update = () => {
      // Read time from bridge directly (avoid useBridgeValue re-renders)
      const timeMs = bridge?.getValue(RESOURCE_RUN_DURATION_BRIDGE_KEY) ?? 0;
      const formatted = formatDuration(timeMs);
      if (lastDisplayedTime.current !== formatted && timeRef.current) {
        lastDisplayedTime.current = formatted;
        timeRef.current.textContent = `Map Time: ${formatted}`;
      }

      // Read FPS from global stats (calculated in render loop)
      if (fpsRef.current) {
        const nextFps = debugStats.currentFps;
        if (lastDisplayedFps.current !== nextFps) {
          lastDisplayedFps.current = nextFps;
          fpsRef.current.textContent = `FPS: ${nextFps}`;
        }
      }

      // Read VBO stats from global object
      if (vboRef.current) {
        const next = `Dyn VBO: ${Math.round(debugStats.vboBytes / 1024)} KB (${debugStats.vboReallocs})`;
        if (lastDisplayedVbo.current !== next) {
          lastDisplayedVbo.current = next;
          vboRef.current.textContent = next;
        }
      }

      // Read particle stats from global object
      if (particlesRef.current) {
        const next = `Particles: ${debugStats.particleActive}/${debugStats.particleCapacity} (${debugStats.particleEmitters})`;
        if (lastDisplayedParticles.current !== next) {
          lastDisplayedParticles.current = next;
          particlesRef.current.textContent = next;
        }
      }

      if (movableRef.current) {
        const next = `Movable: ${debugStats.movableObjects}`;
        if (lastDisplayedMovable.current !== next) {
          lastDisplayedMovable.current = next;
          movableRef.current.textContent = next;
        }
      }

      if (unitsRef.current) {
        const next = `Units: ${debugStats.unitCount}`;
        if (lastDisplayedUnits.current !== next) {
          lastDisplayedUnits.current = next;
          unitsRef.current.textContent = next;
        }
      }

      if (jointsRef.current) {
        const next = `Joints: ${debugStats.jointCount} (GPU ${debugStats.jointGpuCount} / CPU ${debugStats.jointCpuCount})`;
        if (lastDisplayedJoints.current !== next) {
          lastDisplayedJoints.current = next;
          jointsRef.current.textContent = next;
        }
      }

      if (animationsRef.current) {
        const next = `Animations: ${debugStats.animationCount} (GPU ${debugStats.animationGpuCount} / CPU ${debugStats.animationCpuCount})`;
        if (lastDisplayedAnimations.current !== next) {
          lastDisplayedAnimations.current = next;
          animationsRef.current.textContent = next;
        }
      }

      if (joinedRef.current) {
        const next = `Joined GPU: ${debugStats.joinedHandles} handles / ${debugStats.joinedDrawCalls} draws`;
        if (lastDisplayedJoined.current !== next) {
          lastDisplayedJoined.current = next;
          joinedRef.current.textContent = next;
        }
      }

      if (joinedTimingRef.current) {
        const next = `Joined GPU timing: render ${debugStats.joinedRenderMs.toFixed(2)}ms, upload ${debugStats.joinedUploadMs.toFixed(2)}ms`;
        if (lastDisplayedJoinedTiming.current !== next) {
          lastDisplayedJoinedTiming.current = next;
          joinedTimingRef.current.textContent = next;
        }
      }
    };

    update();
    const interval = window.setInterval(update, UPDATE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [bridge]);

  return (
    <div className="scene-debug-panel">
      <div className="scene-debug-panel__item" ref={timeRef} />
      <div className="scene-debug-panel__item" ref={fpsRef} />
      <div className="scene-debug-panel__item" ref={vboRef} />
      <div className="scene-debug-panel__item" ref={particlesRef} />
      <div className="scene-debug-panel__item" ref={movableRef} />
      <div className="scene-debug-panel__item" ref={unitsRef} />
      <div className="scene-debug-panel__item" ref={jointsRef} />
      <div className="scene-debug-panel__item" ref={animationsRef} />
      <div className="scene-debug-panel__item" ref={joinedRef} />
      <div className="scene-debug-panel__item" ref={joinedTimingRef} />
    </div>
  );
};

/** Memoized export - prevents re-renders from parent */
export const SceneDebugPanel = memo(SceneDebugPanelInner);
