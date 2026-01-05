import { ReactNode } from "react";
import { classNames } from "@ui-shared/classNames";
import { formatNumber } from "@ui-shared/format/number";
import "./ModuleDetailsCard.css";

interface ModuleDetailsCardProps {
  name: string;
  level: number;
  description: string;
  effectLabel: string;
  currentEffect: string;
  nextEffect?: string | null;
  manaMultiplier: number;
  sanityCost: number;
  costSummary?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const ModuleDetailsCard: React.FC<ModuleDetailsCardProps> = ({
  name,
  level,
  description,
  effectLabel,
  currentEffect,
  nextEffect,
  manaMultiplier,
  sanityCost,
  costSummary,
  actions,
  className,
}) => {
  const effectTitle = nextEffect ? "Effect Preview" : "Effect";
  const containerClassName = classNames("modules-workshop__details", className);
  const sanityImpactLabel =
    sanityCost > 0
      ? `+${formatNumber(sanityCost, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}`
      : "None";

  return (
    <div className={containerClassName}>
      <div className="modules-workshop__details-header">
        <h3 className="heading-3">{name}</h3>
        <span className="modules-workshop__details-level">Level {level}</span>
      </div>
      <p className="modules-workshop__details-description">{description}</p>
      <div className="modules-workshop__details-section">
        <h4>{nextEffect ? "Bonuses" : "Effect"}</h4>
        <div className="modules-workshop__effect-preview">
          <span className="modules-workshop__effect-label">{effectLabel}</span>
          <span className="modules-workshop__effect-values">
            <span className="modules-workshop__effect-current">{currentEffect}</span>
            {nextEffect ? (
              <>
                <span className="modules-workshop__effect-arrow" aria-hidden="true">
                  →
                </span>
                <span className="modules-workshop__effect-next">{nextEffect}</span>
              </>
            ) : null}
          </span>
        </div>
      </div>
      <div className="modules-workshop__details-section">
        <h4>Unit Costs</h4>
        <div className="modules-workshop__cost-list">
          <div className="modules-workshop__cost-item">
            <span className="modules-workshop__cost-label">Mana Multiplier</span>
            <span className="modules-workshop__cost-value">
              ×
              {formatNumber(manaMultiplier, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="modules-workshop__cost-item">
            <span className="modules-workshop__cost-label">Sanity Impact</span>
            <span className="modules-workshop__cost-value">{sanityImpactLabel}</span>
          </div>
        </div>
        {costSummary ? <div className="modules-workshop__cost-summary">{costSummary}</div> : null}
      </div>
      {actions ? <div className="modules-workshop__actions">{actions}</div> : null}
    </div>
  );
};
