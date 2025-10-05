import { Button } from "../../shared/Button";
import { ProgressBar } from "../../shared/ProgressBar";
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

  return (
    <div className="scene-toolbar">
      <div className="scene-toolbar__section scene-toolbar__section--left">
        <Button onClick={onExit}>Main Menu</Button>
      </div>
      <div className="scene-toolbar__section scene-toolbar__section--center">
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
          <span>Zoom: {scale.toFixed(2)}x</span>
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
          Camera: x {cameraPosition.x.toFixed(1)}, y {cameraPosition.y.toFixed(1)}
        </div>
      </div>
    </div>
  );
};
