import { useMemo } from "react";
import { BonusEffectPreview } from "../../types/bonuses";
import { formatNumber } from "./format/number";
import "./BonusEffectsPreviewList.css";

export interface BonusEffectsPreviewListProps {
  readonly effects: readonly BonusEffectPreview[];
  readonly className?: string;
  readonly emptyLabel?: string;
}

const DEFAULT_EMPTY_LABEL = "No bonus effects.";

const formatDecimal = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return formatNumber(value, { maximumFractionDigits: 2 });
};

const formatSigned = (value: number): string => {
  if (!Number.isFinite(value) || value === 0) {
    return value === 0 ? "+0" : "-";
  }
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}${formatDecimal(Math.abs(value))}`;
};

const isKnownEffectType = (effectType: string): effectType is "income" | "multiplier" | "base" =>
  effectType === "income" || effectType === "multiplier" || effectType === "base";

const formatValue = (effectType: string, value: number): string => {
  if (!Number.isFinite(value)) {
    return "-";
  }
  switch (effectType) {
    case "multiplier":
      return `x${formatDecimal(value)}`;
    case "income":
      return formatSigned(value);
    case "base":
      return formatDecimal(value);
    default:
      return formatDecimal(value);
  }
};

const formatLabel = (effect: BonusEffectPreview): string => {
  if (isKnownEffectType(effect.effectType)) {
    return effect.bonusName;
  }
  return `${effect.bonusName} (${effect.effectType})`;
};

export const BonusEffectsPreviewList = ({
  effects,
  className,
  emptyLabel = DEFAULT_EMPTY_LABEL,
}: BonusEffectsPreviewListProps) => {
  const containerClassName = useMemo(() => {
    if (!className || className.trim().length === 0) {
      return "bonus-effects-preview";
    }
    return `bonus-effects-preview ${className}`;
  }, [className]);

  if (!effects || effects.length === 0) {
    return (
      <div className={containerClassName}>
        <div className="bonus-effects-preview__empty">{emptyLabel}</div>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <ul className="bonus-effects-preview__list">
        {effects.map((effect) => {
          const key = `${effect.bonusId}:${effect.effectType}`;
          return (
            <li key={key} className="bonus-effects-preview__item">
              <span className="bonus-effects-preview__label">{formatLabel(effect)}</span>
              <span className="bonus-effects-preview__values">
                <span className="bonus-effects-preview__value bonus-effects-preview__value--current">
                  {formatValue(effect.effectType, effect.currentValue)}
                </span>
                <span className="bonus-effects-preview__arrow">→</span>
                <span className="bonus-effects-preview__value bonus-effects-preview__value--next">
                  {formatValue(effect.effectType, effect.nextValue)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
