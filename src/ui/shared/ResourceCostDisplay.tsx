import React from "react";
import "./ResourceCostDisplay.css";

export interface ResourceCostDisplayResource {
  id: string;
  label: string;
}

export interface ResourceCostDisplayProps {
  className?: string;
  cost: Record<string, number>;
  missing?: Record<string, number>;
  resources?: readonly ResourceCostDisplayResource[];
}

const formatAmount = (value: number): string =>
  Number.isInteger(value) ? `${value}` : value.toFixed(1);

const DEFAULT_RESOURCES: readonly ResourceCostDisplayResource[] = [
  { id: "mana", label: "Mana" },
  { id: "sanity", label: "Sanity" },
];

const toTitleCase = (value: string): string => {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const ResourceCostDisplay: React.FC<ResourceCostDisplayProps> = ({
  className,
  cost,
  missing,
  resources,
}) => {
  const classes = ["resource-cost", className].filter(Boolean).join(" ");
  const descriptors = (() => {
    const provided = resources ? [...resources] : [...DEFAULT_RESOURCES];
    const known = new Set(provided.map((item) => item.id));
    Object.keys(cost).forEach((key) => {
      const amount = cost[key] ?? 0;
      if (!known.has(key) && amount > 0) {
        provided.push({ id: key, label: toTitleCase(key) });
        known.add(key);
      }
    });
    return provided;
  })();

  return (
    <div className={classes}>
      {descriptors.map((resource) => {
        const amount = cost[resource.id] ?? 0;
        if (amount <= 0) {
          return null;
        }
        const missingAmount = missing
          ? Math.max(missing[resource.id] ?? 0, 0)
          : 0;
        const itemClasses = [
          "resource-cost__item",
          `resource-cost__item--${resource.id}`,
          missingAmount > 0 ? "resource-cost__item--missing" : null,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <span key={resource.id} className={itemClasses}>
            {formatAmount(amount)} {resource.label}
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
