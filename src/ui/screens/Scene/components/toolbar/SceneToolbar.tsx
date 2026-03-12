import { useEffect, useId, useState } from "react";
import { DataBridge } from "@/core/logic/ui/DataBridge";
import { Button } from "@ui-shared/Button";
import { ProgressBar } from "@ui-shared/ProgressBar";
import { formatNumber } from "@ui-shared/format/number";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { OBJECTIVE_TOTAL_HP_BRIDGE_KEY } from "@logic/modules/active-map/objective-integrity/objective-integrity.const";
import {
  PLAYER_UNIT_COUNT_BRIDGE_KEY,
  PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY,
} from "@logic/modules/active-map/player-units/player-units.const";
import { useLocalization } from "@ui/shared/useLocalization";
import { MapEffectsBar } from "./MapEffectsBar";
import "./SceneToolbar.css";

interface SceneToolbarProps {
  bridge: DataBridge;
  onExit: () => void;
  scale: number;
  scaleRange: { min: number; max: number };
  onScaleChange: (value: number) => void;
  cameraPosition: { x: number; y: number };
}

const sanitizeId = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]/g, "_");

export const SceneToolbar: React.FC<SceneToolbarProps> = ({
  bridge,
  onExit,
  scale,
  scaleRange,
  onScaleChange,
  cameraPosition,
}) => {
  const brickTotalHp = useBridgeValue(bridge, OBJECTIVE_TOTAL_HP_BRIDGE_KEY, 0);
  const unitCount = useBridgeValue(bridge, PLAYER_UNIT_COUNT_BRIDGE_KEY, 0);
  const unitTotalHp = useBridgeValue(
    bridge,
    PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY,
    0,
  );
  const { t } = useLocalization();
  const [brickInitialHp, setBrickInitialHp] = useState(0);

  useEffect(() => {
    if (brickTotalHp <= 0) {
      return;
    }
    setBrickInitialHp((current) => {
      if (current === 0 || brickTotalHp > current) {
        return brickTotalHp;
      }
      return current;
    });
  }, [brickTotalHp]);

  const clampedInitialHp = brickInitialHp > 0 ? brickInitialHp : brickTotalHp;
  const shapePrefix = sanitizeId(`${useId()}-scene-toolbar`);
  const fillGradientId = `${shapePrefix}-fill`;
  const sheenGradientId = `${shapePrefix}-sheen`;
  const outlineGradientId = `${shapePrefix}-outline`;
  const glowFilterId = `${shapePrefix}-glow`;

  return (
    <div
      className="scene-toolbar"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="scene-toolbar__section scene-toolbar__section--left">
        <Button onClick={onExit}>
          {t("scene.toolbar.exit", "Exit Map [ESC]")}
        </Button>
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
          <div className="scene-toolbar__hp-label">
            {t("scene.toolbar.brickIntegrity", "Brick Integrity")}
          </div>
          <ProgressBar
            className="scene-toolbar__hp-bar"
            current={brickTotalHp}
            max={clampedInitialHp}
            formatValue={(current, max) =>
              `${formatNumber(current, {
                compact: true,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} / ${formatNumber(max, {
                compact: true,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            }
          />
        </div>
        <div className="scene-toolbar__units">
          {t("scene.toolbar.units", "Units")}:{" "}
          {formatNumber(Math.round(unitCount), {
            maximumFractionDigits: 0,
            compact: true,
          })}{" "}
          ({t("scene.toolbar.hp", "HP")}{" "}
          {formatNumber(unitTotalHp, {
            compact: true,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })})
        </div>
        <MapEffectsBar bridge={bridge} />
      </div>
      <div className="scene-toolbar__section scene-toolbar__section--right">
        <label className="scene-toolbar__zoom">
          <span>
            {t("scene.toolbar.zoom", "Zoom")}:{" "}
            {formatNumber(scale, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            {t("scene.common.timesShort", "×")}
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
          {t("scene.toolbar.camera", "Camera")}: {t("scene.toolbar.axisX", "x")}{" "}
          {formatNumber(cameraPosition.x, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          , {t("scene.toolbar.axisY", "y")}{" "}
          {formatNumber(cameraPosition.y, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
        </div>
      </div>
    </div>
  );
};
