import { useEffect, useRef, memo } from "react";
import { DataBridge } from "@logic/core/DataBridge";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { RESOURCE_RUN_DURATION_BRIDGE_KEY } from "@logic/modules/shared/resources/resources.module";
import { formatDuration } from "@ui/utils/formatDuration";
import { debugStats } from "./debugStats";
import "./SceneDebugPanel.css";

interface SceneDebugPanelProps {
  timeMs?: number;
  bridge?: DataBridge;
}

const UPDATE_INTERVAL_MS = 500;
const FPS_SAMPLE_MS = 1000;

/**
 * Debug panel that reads stats from global debugStats object
 * instead of React props to avoid triggering re-renders.
 */
const SceneDebugPanelInner: React.FC<SceneDebugPanelProps> = ({ timeMs, bridge }) => {
  const timeMsValue = typeof timeMs === "number" ? timeMs : (bridge ? useBridgeValue(bridge, RESOURCE_RUN_DURATION_BRIDGE_KEY, 0) : 0);
  const latestTimeMs = useRef(timeMsValue);
  const timeRef = useRef<HTMLDivElement | null>(null);
  const fpsRef = useRef<HTMLDivElement | null>(null);
  const vboRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<HTMLDivElement | null>(null);
  const lastDisplayedTime = useRef<string | null>(null);
  const lastDisplayedFps = useRef<number | null>(null);
  const lastDisplayedVbo = useRef<string | null>(null);
  const lastDisplayedParticles = useRef<string | null>(null);

  useEffect(() => {
    latestTimeMs.current = timeMsValue;
  }, [timeMsValue]);

  useEffect(() => {
    const update = () => {
      // Read time from ref (updated via useBridgeValue)
      const formatted = formatDuration(latestTimeMs.current);
      if (lastDisplayedTime.current !== formatted && timeRef.current) {
        lastDisplayedTime.current = formatted;
        timeRef.current.textContent = `Map Time: ${formatted}`;
      }

      // Read VBO stats from global object (no React re-render)
      if (vboRef.current) {
        const next = `Dyn VBO: ${Math.round(debugStats.vboBytes / 1024)} KB (${debugStats.vboReallocs})`;
        if (lastDisplayedVbo.current !== next) {
          lastDisplayedVbo.current = next;
          vboRef.current.textContent = next;
        }
      }

      // Read particle stats from global object (no React re-render)
      if (particlesRef.current) {
        const next = `Particles: ${debugStats.particleActive}/${debugStats.particleCapacity} (emitters: ${debugStats.particleEmitters})`;
        if (lastDisplayedParticles.current !== next) {
          lastDisplayedParticles.current = next;
          particlesRef.current.textContent = next;
        }
      }
    };

    update();
    const interval = window.setInterval(update, UPDATE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let animationFrame = 0;
    let lastTimestamp = performance.now();
    let accumulated = 0;
    let frames = 0;

    if (fpsRef.current && lastDisplayedFps.current == null) {
      lastDisplayedFps.current = 0;
      fpsRef.current.textContent = "FPS: 0";
    }

    const measure = (now: number) => {
      frames += 1;
      const delta = now - lastTimestamp;
      lastTimestamp = now;
      accumulated += delta;

      if (accumulated >= FPS_SAMPLE_MS) {
        const nextFps = Math.round((frames / accumulated) * 1000);
        if (lastDisplayedFps.current !== nextFps && fpsRef.current) {
          lastDisplayedFps.current = nextFps;
          fpsRef.current.textContent = `FPS: ${nextFps}`;
        }
        accumulated = 0;
        frames = 0;
      }

      animationFrame = window.requestAnimationFrame(measure);
    };

    animationFrame = window.requestAnimationFrame(measure);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div className="scene-debug-panel">
      <div className="scene-debug-panel__item" ref={timeRef} />
      <div className="scene-debug-panel__item" ref={fpsRef} />
      <div className="scene-debug-panel__item" ref={vboRef} />
      <div className="scene-debug-panel__item" ref={particlesRef} />
    </div>
  );
};

/** Memoized export - prevents re-renders from parent */
export const SceneDebugPanel = memo(SceneDebugPanelInner);
