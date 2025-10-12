import { useEffect, useRef } from "react";
import { formatTime } from "./formatTime";
import "./SceneDebugPanel.css";

interface SceneDebugPanelProps {
  timeMs: number;
  brickCount: number;
}

const UPDATE_INTERVAL_MS = 250;
export const SceneDebugPanel: React.FC<SceneDebugPanelProps> = ({ timeMs, brickCount }) => {
  const latestValues = useRef({ timeMs, brickCount });
  const timeRef = useRef<HTMLDivElement | null>(null);
  const brickRef = useRef<HTMLDivElement | null>(null);
  const fpsRef = useRef<HTMLDivElement | null>(null);
  const lastDisplayedTime = useRef<string | null>(null);
  const lastDisplayedBricks = useRef<number | null>(null);
  const lastDisplayedFps = useRef<number | null>(null);
  const lastFpsSample = useRef<{ timeMs: number; real: number } | null>(null);

  useEffect(() => {
    latestValues.current = { timeMs, brickCount };
  }, [timeMs, brickCount]);

  useEffect(() => {
    const update = () => {
      const { timeMs: nextTime, brickCount: nextBricks } = latestValues.current;
      const formatted = formatTime(nextTime);

      if (fpsRef.current && lastDisplayedFps.current == null) {
        lastDisplayedFps.current = 0;
        fpsRef.current.textContent = "FPS: 0";
      }

      if (lastDisplayedTime.current !== formatted && timeRef.current) {
        lastDisplayedTime.current = formatted;
        timeRef.current.textContent = `Time: ${formatted}`;
      }

      if (lastDisplayedBricks.current !== nextBricks && brickRef.current) {
        lastDisplayedBricks.current = nextBricks;
        brickRef.current.textContent = `Particles: ${nextBricks}`;
      }

      const previousSample = lastFpsSample.current;
      const now = performance.now();

      if (previousSample) {
        const timeDelta = nextTime - previousSample.timeMs;
        const realDelta = now - previousSample.real;

        if (realDelta > 0) {
          const nextFps = timeDelta > 0 ? Math.round((timeDelta / realDelta) * 1000) : 0;
          if (lastDisplayedFps.current !== nextFps && fpsRef.current) {
            lastDisplayedFps.current = nextFps;
            fpsRef.current.textContent = `FPS: ${nextFps}`;
          }
        }
      }

      lastFpsSample.current = { timeMs: nextTime, real: now };
    };

    update();
    const interval = window.setInterval(update, UPDATE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="scene-debug-panel">
      <div className="scene-debug-panel__item" ref={timeRef} />
      <div className="scene-debug-panel__item" ref={brickRef} />
      <div className="scene-debug-panel__item" ref={fpsRef} />
    </div>
  );
};
