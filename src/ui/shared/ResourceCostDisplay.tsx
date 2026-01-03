import React from "react";
import { RESOURCE_IDS, ResourceId } from "@db/resources-db";
import { classNames } from "@ui-shared/classNames";
import { ResourceIcon } from "./icons/ResourceIcon";
import { formatNumber } from "./format/number";
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

const formatAmount = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (Number.isInteger(value)) {
    return formatNumber(value, { maximumFractionDigits: 0 });
  }
  return formatNumber(value, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
};

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

const isResourceId = (value: string): value is ResourceId =>
  RESOURCE_IDS.includes(value as ResourceId);

const renderCostIcon = (id: string, label: string): React.ReactNode => {
  if (isResourceId(id)) {
    return <ResourceIcon resourceId={id} className="resource-cost__icon" label={label} />;
  }

  switch (id) {
    case "mana":
      return (
        <span className="resource-cost__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M12 2C8.5 6.5 6.5 9.5 6.5 12.5c0 3.6 2.9 6.5 6.5 6.5s6.5-2.9 6.5-6.5C19.5 9.5 15.5 4.5 12 2z"
              fill="#38bdf8"
              stroke="#0ea5e9"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M12 6.5c-1.7 2.5-2.6 4.1-2.6 5.7 0 1.9 1.5 3.4 3.4 3.4s3.4-1.5 3.4-3.4c0-1.6-0.9-3.2-2.6-5.7"
              fill="none"
              stroke="#bae6fd"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      );
    case "sanity":
      return (
        <span className="resource-cost__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <circle cx="12" cy="12" r="5.5" fill="#facc15" stroke="#d97706" strokeWidth="1.4" />
            <g stroke="#fef08a" strokeWidth="1.3" strokeLinecap="round">
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="4" y1="12" x2="7" y2="12" />
              <line x1="17" y1="12" x2="20" y2="12" />
              <line x1="5.6" y1="5.6" x2="7.8" y2="7.8" />
              <line x1="16.2" y1="16.2" x2="18.4" y2="18.4" />
              <line x1="5.6" y1="18.4" x2="7.8" y2="16.2" />
              <line x1="16.2" y1="7.8" x2="18.4" y2="5.6" />
            </g>
          </svg>
        </span>
      );
    default:
      return null;
  }
};

export const ResourceCostDisplay: React.FC<ResourceCostDisplayProps> = ({
  className,
  cost,
  missing,
  resources,
}) => {
  const classes = classNames("resource-cost", className);
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
        const itemClasses = classNames(
          "resource-cost__item",
          `resource-cost__item--${resource.id}`,
          missingAmount > 0 && "resource-cost__item--missing"
        );

        return (
          <span key={resource.id} className={itemClasses}>
            {renderCostIcon(resource.id, resource.label)}
            <span className="resource-cost__value">
              <span className="resource-cost__amount">{formatAmount(amount)}</span>
              <span className="resource-cost__label">{resource.label}</span>
            </span>
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
