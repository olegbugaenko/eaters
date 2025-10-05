import { useEffect, useRef, useState } from "react";
import { formatTime } from "./formatTime";
import "./SceneDebugPanel.css";

interface SceneDebugPanelProps {
  timeMs: number;
  brickCount: number;
}

interface DebugDisplayState {
  formattedTime: string;
  brickCount: number;
}

const UPDATE_INTERVAL_MS = 250;
const FPS_SAMPLE_MS = 500;

export const SceneDebugPanel: React.FC<SceneDebugPanelProps> = ({ timeMs, brickCount }) => {
  const latestValues = useRef({ timeMs, brickCount });
  const [{ formattedTime, brickCount: displayedBricks }, setDisplayState] = useState<DebugDisplayState>(
    () => ({
      formattedTime: formatTime(timeMs),
      brickCount,
    })
  );
  const [fps, setFps] = useState(0);

  useEffect(() => {
    latestValues.current = { timeMs, brickCount };
  }, [timeMs, brickCount]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const next = latestValues.current;
      const nextFormatted = formatTime(next.timeMs);
      setDisplayState((current) => {
        if (current.formattedTime === nextFormatted && current.brickCount === next.brickCount) {
          return current;
        }
        return {
          formattedTime: nextFormatted,
          brickCount: next.brickCount,
        };
      });
    }, UPDATE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let animationFrame = 0;
    let lastTimestamp = performance.now();
    let accumulated = 0;
    let frames = 0;

    const measure = (now: number) => {
      frames += 1;
      const delta = now - lastTimestamp;
      lastTimestamp = now;
      accumulated += delta;

      if (accumulated >= FPS_SAMPLE_MS) {
        const nextFps = Math.round((frames / accumulated) * 1000);
        setFps((current) => (current === nextFps ? current : nextFps));
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
      <div className="scene-debug-panel__item">Time: {formattedTime}</div>
      <div className="scene-debug-panel__item">Particles: {displayedBricks}</div>
      <div className="scene-debug-panel__item">FPS: {fps}</div>
    </div>
  );
};
