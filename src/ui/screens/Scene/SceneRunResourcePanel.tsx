import React from "react";
import { ResourceRunSummaryItem } from "../../../logic/modules/ResourcesModule";
import { formatNumber } from "../../shared/format/number";
import "./SceneRunResourcePanel.css";

interface SceneRunResourcePanelProps {
  readonly resources: readonly ResourceRunSummaryItem[];
}

export const SceneRunResourcePanel: React.FC<SceneRunResourcePanelProps> = ({
  resources,
}) => {
  const collected = resources.filter((resource) => resource.gained > 0);
  const hasCollected = collected.length > 0;

  return (
    <div className="scene-run-resources" aria-live="polite">
      <div className="scene-run-resources__header">
        <h2 className="scene-run-resources__title">Collected Resources</h2>
        <p className="scene-run-resources__subtitle">This run so far</p>
      </div>
      {hasCollected ? (
        <ul className="scene-run-resources__list">
          {collected.map((resource) => (
            <li key={resource.id} className="scene-run-resources__item surface-card">
              <span className="scene-run-resources__name">{resource.name}</span>
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
      ) : (
        <p className="scene-run-resources__empty">No resources collected yet.</p>
      )}
    </div>
  );
};
