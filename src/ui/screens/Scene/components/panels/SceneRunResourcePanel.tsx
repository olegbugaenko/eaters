import React from "react";
import type { ResourceRunSummaryItem } from "@logic/modules/shared/resources/resources.types";
import { formatNumber } from "@ui-shared/format/number";
import { ResourceIcon } from "@ui-shared/icons/ResourceIcon";
import { getAssetUrl } from "@shared/helpers/assets.helper";
import "./SceneRunResourcePanel.css";

interface SceneRunSoulSummaryItem {
  readonly name: string;
  readonly gained: number;
}

interface SceneRunResourcePanelProps {
  readonly resources: readonly ResourceRunSummaryItem[];
  readonly souls?: SceneRunSoulSummaryItem;
}

export const SceneRunResourcePanel: React.FC<SceneRunResourcePanelProps> = ({
  resources,
  souls,
}) => {
  const collected = resources.filter((resource) => resource.gained > 0);
  const hasSouls = (souls?.gained ?? 0) > 0;

  if (collected.length === 0 && !hasSouls) {
    return null;
  }

  return (
    <div className="scene-run-resources" aria-live="polite">
      <ul className="scene-run-resources__list">
        {collected.map((resource) => (
          <li
            key={resource.id}
            className="scene-run-resources__item surface-card"
          >
            <ResourceIcon
              resourceId={resource.id}
              className="scene-run-resources__icon"
              label={resource.name}
            />
            <span className="scene-run-resources__value">
              +
              {formatNumber(resource.gained, {
                maximumFractionDigits: 2,
                minimumFractionDigits: resource.gained < 1 ? 2 : 0,
                useGrouping: true,
              })}
            </span>
          </li>
        ))}
        {hasSouls && souls ? (
          <li key="souls" className="scene-run-resources__item surface-card">
            <span
              className="resource-icon scene-run-resources__icon"
              role="img"
              aria-label={souls.name}
            >
              <img
                className="resource-icon__image"
                src={getAssetUrl("images/collectable/soul.png")}
                alt=""
                aria-hidden="true"
              />
            </span>
            <span className="scene-run-resources__value">
              +
              {formatNumber(souls.gained, {
                maximumFractionDigits: 0,
                minimumFractionDigits: 0,
                useGrouping: true,
              })}
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  );
};
