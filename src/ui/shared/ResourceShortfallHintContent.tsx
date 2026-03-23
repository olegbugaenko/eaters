import React from "react";

export interface ResourceShortfallEntry {
  id: string;
  label: string;
  amount: number;
  missingAmount: number;
  currentAmount: number;
}

interface ResourceShortfallHintContentProps {
  progressPercent: number;
  entries: readonly ResourceShortfallEntry[];
  progressLabel: string;
  neededLabel: string;
  formatAmount: (value: number) => string;
  renderIcon: (id: string, label: string) => React.ReactNode;
}

export const ResourceShortfallHintContent: React.FC<
  ResourceShortfallHintContentProps
> = ({
  progressPercent,
  entries,
  progressLabel,
  neededLabel,
  formatAmount,
  renderIcon,
}) => (
  <span>
    <span className="resource-cost__shortfall-title">
      {progressLabel} {progressPercent}%
    </span>
    <span className="resource-cost__shortfall-list">
      {entries.map((entry) => (
        <span key={entry.id} className="resource-cost__shortfall-item">
          {renderIcon(entry.id, entry.label)}
          <span className="resource-cost__shortfall-item-text">
            {entry.label}: {formatAmount(entry.currentAmount)} /{" "}
            {formatAmount(entry.amount)}{" "}
            <span className="resource-cost__shortfall-item-missing">
              (+{formatAmount(entry.missingAmount)} {neededLabel})
            </span>
          </span>
        </span>
      ))}
    </span>
  </span>
);
