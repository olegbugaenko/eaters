import React from "react";
import "./ProgressBar.css";

export type ProgressBarOrientation = "horizontal" | "vertical";

export interface ProgressBarProps {
  className?: string;
  current: number;
  max: number;
  showText?: boolean;
  orientation?: ProgressBarOrientation;
  formatValue?: (current: number, max: number, percent: number) => React.ReactNode;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  className,
  current,
  max,
  showText = true,
  orientation = "horizontal",
  formatValue,
}) => {
  const safeMax = sanitizeMax(max);
  const safeCurrent = clampValue(current, 0, safeMax);
  const percent = safeMax > 0 ? clampValue((safeCurrent / safeMax) * 100, 0, 100) : 0;
  const classes = [
    "progress-bar",
    orientation === "vertical" ? "progress-bar--vertical" : "progress-bar--horizontal",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const fillStyle =
    orientation === "vertical"
      ? ({ height: `${percent}%` } as React.CSSProperties)
      : ({ width: `${percent}%` } as React.CSSProperties);

  const label = formatValue
    ? formatValue(safeCurrent, safeMax, percent)
    : `${Math.round(safeCurrent)} / ${Math.round(safeMax)}`;

  return (
    <div className={classes}>
      <div className="progress-bar__track">
        <div className="progress-bar__fill" style={fillStyle} />
        {showText ? <div className="progress-bar__label">{label}</div> : null}
      </div>
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
