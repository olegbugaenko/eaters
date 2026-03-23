import React from "react";
import { RESOURCE_IDS, ResourceId, getResourceConfig } from "@db/resources-db";
import { classNames } from "@ui-shared/classNames";
import { ResourceIcon } from "./icons/ResourceIcon";
import { formatNumber } from "./format/number";
import { useLocalization } from "@ui/shared/useLocalization";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { HintTooltip } from "@ui-shared/HintTooltip";
import {
  ResourceShortfallEntry,
  ResourceShortfallHintContent,
} from "@ui-shared/ResourceShortfallHintContent";
import "./ResourceCostDisplay.css";

export interface ResourceCostDisplayResource {
  id: string;
  label?: string;
}

export interface ResourceCostDisplayProps {
  className?: string;
  cost: Record<string, number>;
  missing?: Record<string, number>;
  resources?: readonly ResourceCostDisplayResource[];
  /** When true, do not show "(+N needed)" for shortfalls (still styled as missing via color). */
  hideMissing?: boolean;
  /** When true, show only icon + amount (no resource name label). */
  hideLabels?: boolean;
  /** Shows compact progress bar for missing resources instead of "(+N needed)" labels. */
  showMissingProgressBar?: boolean;
  /** Placement for the missing resources tooltip. */
  missingProgressTooltipPlacement?: "top" | "right";
}

const formatAmount = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (Number.isInteger(value)) {
    return formatNumber(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  return formatNumber(value, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
};

const DEFAULT_RESOURCES: readonly ResourceCostDisplayResource[] = [
  { id: "mana" },
  { id: "sanity" },
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

interface ComputedResourceShortfallEntry extends ResourceShortfallEntry {
  completion: number;
}

export const ResourceCostDisplay: React.FC<ResourceCostDisplayProps> = ({
  className,
  cost,
  missing,
  resources,
  hideMissing = false,
  hideLabels = false,
  showMissingProgressBar = false,
  missingProgressTooltipPlacement = "top",
}) => {
  const { t } = useLocalization();
  const { uiApi } = useAppLogic();
  const classes = classNames(
    "resource-cost",
    hideLabels && "resource-cost--no-labels",
    className,
  );

  const getResourceLabel = (id: string, explicitLabel?: string): string => {
    if (id === "mana") {
      return t("voidCamp.common.mana", explicitLabel ?? "Mana");
    }
    if (id === "sanity") {
      return t("voidCamp.common.sanity", explicitLabel ?? "Sanity");
    }
    if (isResourceId(id)) {
      return uiApi.localization.getResourceName(
        id,
        explicitLabel ?? getResourceConfig(id).name,
      );
    }
    if (explicitLabel) {
      return explicitLabel;
    }
    return toTitleCase(id);
  };

  const descriptors = (() => {
    const provided = resources ? [...resources] : [...DEFAULT_RESOURCES];
    const known = new Set(provided.map((item) => item.id));
    Object.keys(cost).forEach((key) => {
      const amount = cost[key] ?? 0;
      if (!known.has(key) && amount > 0) {
        provided.push({ id: key });
        known.add(key);
      }
    });
    return provided;
  })();

  const shortfallEntries: ComputedResourceShortfallEntry[] = descriptors
    .map((resource) => {
      const amount = cost[resource.id] ?? 0;
      const missingAmount = missing ? Math.max(missing[resource.id] ?? 0, 0) : 0;
      if (amount <= 0 || missingAmount <= 0) {
        return null;
      }
      const label = getResourceLabel(resource.id, resource.label);
      const currentAmount = Math.max(0, amount - missingAmount);
      const completion = amount > 0 ? Math.min(1, Math.max(0, currentAmount / amount)) : 1;
      return {
        id: resource.id,
        label,
        amount,
        missingAmount,
        currentAmount,
        completion,
      };
    })
    .filter((entry): entry is ComputedResourceShortfallEntry => entry !== null);

  const shortageProgress = shortfallEntries.reduce<number>(
    (min, entry) => Math.min(min, entry.completion),
    1,
  );
  const shortageProgressPercent = Math.round(shortageProgress * 100);

  return (
    <div className={classes}>
      {descriptors.map((resource) => {
        const amount = cost[resource.id] ?? 0;
        if (amount <= 0) {
          return null;
        }
        const label = getResourceLabel(resource.id, resource.label);
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
            {renderCostIcon(resource.id, label)}
            <span className="resource-cost__value">
              <span className="resource-cost__amount">{formatAmount(amount)}</span>
              {!hideLabels ? (
                <span className="resource-cost__label">{label}</span>
              ) : null}
            </span>
            {!hideMissing && missingAmount > 0 ? (
              <span className="resource-cost__missing">
                (+{formatAmount(missingAmount)} {t("voidCamp.common.needed", "needed")})
              </span>
            ) : null}
          </span>
        );
      })}
      {showMissingProgressBar && shortfallEntries.length > 0 ? (
        <span className="resource-cost__shortfall">
          <HintTooltip
            aria-label={t(
              "voidCamp.common.missingResourcesHint",
              "Missing resources details",
            )}
            placement={missingProgressTooltipPlacement}
            contentClassName="resource-cost__shortfall-popup"
            content={
              <ResourceShortfallHintContent
                progressPercent={shortageProgressPercent}
                entries={shortfallEntries}
                progressLabel={t(
                  "voidCamp.common.resourcesProgress",
                  "Resources progress",
                )}
                neededLabel={t("voidCamp.common.needed", "needed")}
                formatAmount={formatAmount}
                renderIcon={renderCostIcon}
              />
            }
          >
            <span className="resource-cost__shortfall-track" aria-hidden="true">
              <span
                className="resource-cost__shortfall-fill"
                style={{ width: `${shortageProgressPercent}%` }}
              />
            </span>
          </HintTooltip>
        </span>
      ) : null}
    </div>
  );
};
