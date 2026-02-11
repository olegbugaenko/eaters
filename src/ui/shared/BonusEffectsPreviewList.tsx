import { useMemo } from "react";
import { BonusEffectPreview } from "@shared/types/bonuses";
import { formatNumber } from "./format/number";
import { useLocalization } from "@ui/shared/useLocalization";
import "./BonusEffectsPreviewList.css";

export interface BonusEffectsPreviewListProps {
  readonly effects: readonly BonusEffectPreview[];
  readonly className?: string;
  readonly emptyLabel?: string;
}

const DEFAULT_EMPTY_LABEL = "No bonus effects.";

const toBonusLocalizationKey = (bonusId: string): string => `bonuses.${bonusId}.name`;

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

const formatLabel = (effect: BonusEffectPreview, t: (key: string, fallback?: string) => string): string => {
  const localizedBonusName = t(toBonusLocalizationKey(effect.bonusId), effect.bonusName);
  if (isKnownEffectType(effect.effectType)) {
    return localizedBonusName;
  }
  return `${localizedBonusName} (${effect.effectType})`;
};

export const BonusEffectsPreviewList = ({
  effects,
  className,
  emptyLabel,
}: BonusEffectsPreviewListProps) => {
  const { t } = useLocalization();

  const containerClassName = useMemo(() => {
    if (!className || className.trim().length === 0) {
      return "bonus-effects-preview";
    }
    return `bonus-effects-preview ${className}`;
  }, [className]);

  const localizedEmptyLabel = emptyLabel ?? t("voidCamp.bonuses.empty", DEFAULT_EMPTY_LABEL);

  if (!effects || effects.length === 0) {
    return (
      <div className={containerClassName}>
        <div className="bonus-effects-preview__empty">{localizedEmptyLabel}</div>
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
              <span className="bonus-effects-preview__label">{formatLabel(effect, t)}</span>
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
