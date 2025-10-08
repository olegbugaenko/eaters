import { useId } from "react";
import { Button } from "../../shared/Button";
import { ProgressBar } from "../../shared/ProgressBar";
import { formatNumber } from "../../shared/format/number";
import "./SceneToolbar.css";

interface SceneToolbarProps {
  onExit: () => void;
  brickTotalHp: number;
  brickInitialHp: number;
  unitCount: number;
  unitTotalHp: number;
  scale: number;
  scaleRange: { min: number; max: number };
  onScaleChange: (value: number) => void;
  cameraPosition: { x: number; y: number };
}

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

const sanitizeId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, "_");

export const SceneToolbar: React.FC<SceneToolbarProps> = ({
  onExit,
  brickTotalHp,
  brickInitialHp,
  unitCount,
  unitTotalHp,
  scale,
  scaleRange,
  onScaleChange,
  cameraPosition,
}) => {
  const clampedInitialHp = brickInitialHp > 0 ? brickInitialHp : brickTotalHp;
  const shapePrefix = sanitizeId(`${useId()}-scene-toolbar`);
  const fillGradientId = `${shapePrefix}-fill`;
  const sheenGradientId = `${shapePrefix}-sheen`;
  const outlineGradientId = `${shapePrefix}-outline`;
  const glowFilterId = `${shapePrefix}-glow`;

  return (
    <div className="scene-toolbar">
      <div className="scene-toolbar__section scene-toolbar__section--left">
        <Button onClick={onExit}>Main Menu</Button>
      </div>
      <div className="scene-toolbar__section scene-toolbar__section--center">
        <svg
          className="scene-toolbar__center-silhouette"
          viewBox="0 0 400 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(22, 28, 38, 0.9)" />
              <stop offset="100%" stopColor="rgba(9, 12, 18, 0.78)" />
            </linearGradient>
            <linearGradient id={sheenGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.28)" />
              <stop offset="45%" stopColor="rgba(255, 255, 255, 0.08)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
            </linearGradient>
            <linearGradient id={outlineGradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(123, 198, 240, 0.35)" />
              <stop offset="50%" stopColor="rgba(73, 169, 218, 0.25)" />
              <stop offset="100%" stopColor="rgba(123, 198, 240, 0.35)" />
            </linearGradient>
            <filter
              id={glowFilterId}
              x="-25%"
              y="-55%"
              width="150%"
              height="230%"
              colorInterpolationFilters="sRGB"
            >
              <feDropShadow
                dx="0"
                dy="24"
                stdDeviation="20"
                floodColor="#3ea2d6"
                floodOpacity="0.32"
              />
              <feDropShadow
                dx="0"
                dy="6"
                stdDeviation="12"
                floodColor="#49a9da"
                floodOpacity="0.38"
              />
            </filter>
          </defs>
          <path
            d="M0 60 L40 0 H360 L400 60 L360 120 H40 Z"
            fill={`url(#${fillGradientId})`}
            filter={`url(#${glowFilterId})`}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M40 0 H360 L380 60 L20 60 Z"
            fill={`url(#${sheenGradientId})`}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0 60 L40 0 H360 L400 60 L360 120 H40 Z"
            fill="none"
            stroke={`url(#${outlineGradientId})`}
            strokeWidth="3"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M20 60 L40 120 H360 L380 60 Z"
            fill="rgba(0, 0, 0, 0.25)"
            opacity="0.35"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="scene-toolbar__hp">
          <div className="scene-toolbar__hp-label">Brick Integrity</div>
          <ProgressBar
            className="scene-toolbar__hp-bar"
            current={brickTotalHp}
            max={clampedInitialHp}
            formatValue={(current, max) =>
              `${Math.round(current)} / ${Math.round(max)}`
            }
          />
        </div>
        <div className="scene-toolbar__units">
          Units: {unitCount} (HP {Math.round(unitTotalHp)})
        </div>
      </div>
      <div className="scene-toolbar__section scene-toolbar__section--right">
        <label className="scene-toolbar__zoom">
          <span>
            Zoom: {formatNumber(scale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x
          </span>
          <input
            type="range"
            min={scaleRange.min}
            max={scaleRange.max}
            step={0.05}
            value={scale}
            onChange={(event) => {
              const next = Number.parseFloat(event.target.value);
              onScaleChange(next);
            }}
          />
        </label>
        <div className="scene-toolbar__camera">
          Camera: x {formatNumber(cameraPosition.x, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}, y {formatNumber(cameraPosition.y, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
        </div>
      </div>
    </div>
  );
};
