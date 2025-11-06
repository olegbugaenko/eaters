import { useEffect, useRef } from "react";
import { DataBridge } from "@logic/core/DataBridge";
import { useBridgeValue } from "@shared/useBridgeValue";
import { RESOURCE_RUN_DURATION_BRIDGE_KEY } from "@logic/modules/shared/ResourcesModule";
import { BRICK_COUNT_BRIDGE_KEY } from "@logic/modules/active-map/BricksModule";
import { formatDuration } from "@ui/utils/formatDuration";
import "./SceneDebugPanel.css";

interface SceneDebugPanelProps {
  timeMs?: number;
  brickCount?: number;
  bridge?: DataBridge;
  dynamicBytes?: number;
  dynamicReallocs?: number;
  breakdown?: { type: string; bytes: number; count: number }[];
  particleActive?: number;
  particleCapacity?: number;
  particleEmitters?: number;
}

const UPDATE_INTERVAL_MS = 1000;
const FPS_SAMPLE_MS = 1000;

export const SceneDebugPanel: React.FC<SceneDebugPanelProps> = ({ timeMs, brickCount, bridge, dynamicBytes = 0, dynamicReallocs = 0, breakdown = [], particleActive = 0, particleCapacity = 0, particleEmitters = 0 }) => {
  const timeMsValue = typeof timeMs === "number" ? timeMs : (bridge ? useBridgeValue<number>(bridge, RESOURCE_RUN_DURATION_BRIDGE_KEY, 0) : 0);
  const brickCountValue = typeof brickCount === "number" ? brickCount : (bridge ? useBridgeValue<number>(bridge, BRICK_COUNT_BRIDGE_KEY, 0) : 0);
  const latestValues = useRef({ timeMs, brickCount, dynamicBytes, dynamicReallocs, breakdown, particleActive, particleCapacity, particleEmitters });
  const timeRef = useRef<HTMLDivElement | null>(null);
  const brickRef = useRef<HTMLDivElement | null>(null);
  const fpsRef = useRef<HTMLDivElement | null>(null);
  const vboRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<HTMLDivElement | null>(null);
  const lastDisplayedTime = useRef<string | null>(null);
  const lastDisplayedBricks = useRef<number | null>(null);
  const lastDisplayedFps = useRef<number | null>(null);
  const lastDisplayedVbo = useRef<string | null>(null);

  useEffect(() => {
    latestValues.current = { timeMs: timeMsValue, brickCount: brickCountValue, dynamicBytes, dynamicReallocs, breakdown, particleActive, particleCapacity, particleEmitters } as any;
  }, [timeMsValue, brickCountValue, dynamicBytes, dynamicReallocs, breakdown, particleActive, particleCapacity, particleEmitters]);

  useEffect(() => {
    const update = () => {
      const { timeMs: nextTime, brickCount: nextBricks, dynamicBytes: bytes, dynamicReallocs: reallocs, particleActive: pActive, particleCapacity: pCap, particleEmitters: pEmit } = latestValues.current as any;
      const formatted = formatDuration(nextTime);

      if (lastDisplayedTime.current !== formatted && timeRef.current) {
        lastDisplayedTime.current = formatted;
        timeRef.current.textContent = `Map Time: ${formatted}`;
      }

      if (lastDisplayedBricks.current !== nextBricks && brickRef.current) {
        lastDisplayedBricks.current = nextBricks;
        brickRef.current.textContent = `Particles: ${nextBricks}`;
      }

      if (vboRef.current) {
        const next = `Dyn VBO: ${Math.round(bytes / 1024)} KB (${reallocs})`;
        if (lastDisplayedVbo.current !== next) {
          lastDisplayedVbo.current = next;
          vboRef.current.textContent = next;
        }
      }

      if (particlesRef.current) {
        particlesRef.current.textContent = `Particles: ${pActive}/${pCap} (emitters: ${pEmit})`;
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
      {/*<div className="scene-debug-panel__item" ref={brickRef} />*/}
      <div className="scene-debug-panel__item" ref={fpsRef} />
      <div className="scene-debug-panel__item" ref={vboRef} />
      <div className="scene-debug-panel__item" ref={particlesRef} />
    </div>
  );
};
