import React from "react";
import type { ResourceRunSummaryItem } from "@logic/modules/shared/resources/resources.types";
import { formatNumber } from "@ui-shared/format/number";
import { ResourceIcon } from "@ui-shared/icons/ResourceIcon";
import "./SceneRunResourcePanel.css";

interface SceneRunResourcePanelProps {
  readonly resources: readonly ResourceRunSummaryItem[];
}

export const SceneRunResourcePanel: React.FC<SceneRunResourcePanelProps> = ({
  resources,
}) => {
  const collected = resources.filter((resource) => resource.gained > 0);

  if (collected.length === 0) {
    return null;
  }

  return (
    <div className="scene-run-resources" aria-live="polite">
      <ul className="scene-run-resources__list">
        {collected.map((resource) => (
          <li key={resource.id} className="scene-run-resources__item surface-card">
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
      </ul>
    </div>
  );
};
