import { CSSProperties, useId } from "react";
import { classNames } from "@shared/classNames";
import { formatNumber } from "@shared/format/number";
import "./ResourceDiamondMeter.css";

interface GradientStop {
  offset: number;
  color: string;
  opacity?: number;
}

export interface ResourceDiamondMeterProps {
  id: string;
  className?: string;
  current: number;
  max: number;
  gradientStops: readonly GradientStop[];
  outlineColor: string;
  glowColor: string;
  showText?: boolean;
  formatValue?: (current: number, max: number, percent: number) => React.ReactNode;
  title?: string;
}

const DIAMOND_SIZE = 120;
const DIAMOND_PATH = "M60 4L116 60L60 116L4 60Z";
const INNER_RIDGE_PATH = "M60 12L108 60L60 108L12 60Z";

export const ResourceDiamondMeter: React.FC<ResourceDiamondMeterProps> = ({
  id,
  className,
  current,
  max,
  gradientStops,
  outlineColor,
  glowColor,
  showText = true,
  formatValue,
  title,
}) => {
  const safeMax = sanitizeMax(max);
  const safeCurrent = clampValue(current, 0, safeMax);
  const percent = safeMax > 0 ? clampValue((safeCurrent / safeMax) * 100, 0, 100) : 0;
  const label = formatValue
    ? formatValue(safeCurrent, safeMax, percent)
    : `${formatNumber(safeCurrent, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} / ${formatNumber(safeMax, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}`;

  const rawId = useId().replace(/:/g, "");
  const idBase = `${id}-${rawId}`;
  const clipPathId = `${idBase}-clip`;
  const baseGradientId = `${idBase}-base-gradient`;
  const fillGradientId = `${idBase}-fill-gradient`;
  const highlightGradientId = `${idBase}-highlight-gradient`;

  const fillHeight = (percent / 100) * DIAMOND_SIZE;
  const classes = classNames("resource-diamond-meter", className);

  const meterStyle = {
    "--resource-gem-glow": glowColor,
  } as CSSProperties;

  return (
    <div className={classes} style={meterStyle}>
      <svg
        className="resource-diamond-meter__svg"
        viewBox={`0 0 ${DIAMOND_SIZE} ${DIAMOND_SIZE}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id={clipPathId}>
            <path d={DIAMOND_PATH} />
          </clipPath>
          <linearGradient id={baseGradientId} x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="rgba(226, 232, 240, 0.18)" />
            <stop offset="55%" stopColor="rgba(148, 163, 184, 0.12)" />
            <stop offset="100%" stopColor="rgba(15, 23, 42, 0.78)" />
          </linearGradient>
          <linearGradient id={fillGradientId} x1="0.5" y1="1" x2="0.5" y2="0">
            {gradientStops.map((stop, index) => (
              <stop
                key={`${stop.offset}-${index}`}
                offset={`${Math.min(Math.max(stop.offset, 0), 1) * 100}%`}
                stopColor={stop.color}
                stopOpacity={stop.opacity ?? 1}
              />
            ))}
          </linearGradient>
          <linearGradient id={highlightGradientId} x1="0.15" y1="0.1" x2="0.85" y2="0.85">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.6)" />
            <stop offset="35%" stopColor="rgba(255, 255, 255, 0.25)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${clipPathId})`}>
          <rect width={DIAMOND_SIZE} height={DIAMOND_SIZE} fill={`url(#${baseGradientId})`} />
          <rect
            x="0"
            y={Math.max(DIAMOND_SIZE - fillHeight, 0)}
            width={DIAMOND_SIZE}
            height={Math.max(fillHeight, 0)}
            fill={`url(#${fillGradientId})`}
          />
          <rect width={DIAMOND_SIZE} height={DIAMOND_SIZE} fill={`url(#${highlightGradientId})`} />
        </g>
        <path d={DIAMOND_PATH} fill="none" stroke={outlineColor} strokeWidth="2" opacity="0.9" />
        <path d={INNER_RIDGE_PATH} fill="none" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1.5" opacity="0.7" />
      </svg>
      {title ? <div className="resource-diamond-meter__title">{title}</div> : null}
      {showText ? <div className="resource-diamond-meter__value">{label}</div> : null}
    </div>
  );
};

const sanitizeMax = (value: number): number => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return 1;
};

const clampValue = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (min > max) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};
