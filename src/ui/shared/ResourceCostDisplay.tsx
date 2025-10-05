import React from "react";
import {
  RESOURCE_TYPES,
  ResourceAmountMap,
} from "../../types/resources";
import "./ResourceCostDisplay.css";

const RESOURCE_LABELS: Record<string, string> = {
  mana: "Mana",
  sanity: "Sanity",
};

export interface ResourceCostDisplayProps {
  className?: string;
  cost: ResourceAmountMap;
  missing?: ResourceAmountMap;
}

const formatAmount = (value: number): string =>
  Number.isInteger(value) ? `${value}` : value.toFixed(1);

export const ResourceCostDisplay: React.FC<ResourceCostDisplayProps> = ({
  className,
  cost,
  missing,
}) => {
  const classes = ["resource-cost", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      {RESOURCE_TYPES.map((resource) => {
        const amount = cost[resource];
        if (amount <= 0) {
          return null;
        }
        const missingAmount = missing ? Math.max(missing[resource], 0) : 0;
        const itemClasses = [
          "resource-cost__item",
          `resource-cost__item--${resource}`,
          missingAmount > 0 ? "resource-cost__item--missing" : null,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <span key={resource} className={itemClasses}>
            {formatAmount(amount)} {RESOURCE_LABELS[resource]}
            {missingAmount > 0 ? (
              <span className="resource-cost__missing">
                (+{formatAmount(missingAmount)} needed)
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
};
