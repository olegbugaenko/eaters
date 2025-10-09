import { ResourceRunSummaryItem } from "../../../logic/modules/ResourcesModule";
import { Button } from "../../shared/Button";
import { formatNumber } from "../../shared/format/number";
import "./SceneRunSummaryModal.css";

interface SceneRunSummaryModalAction {
  label: string;
  onClick: () => void;
}

interface SceneRunSummaryModalProps {
  resources: ResourceRunSummaryItem[];
  bricksDestroyed: number;
  totalBricksDestroyed: number;
  primaryAction: SceneRunSummaryModalAction;
  secondaryAction?: SceneRunSummaryModalAction;
  title?: string;
  subtitle?: string;
}

const formatDelta = (value: number): string => {
  if (value <= 0) {
    return `(+0)`;
  }
  return `(+${formatNumber(value, { maximumFractionDigits: 2 })})`;
};

const formatCount = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return formatNumber(Math.max(Math.floor(value), 0), {
    maximumFractionDigits: 0,
    useGrouping: true,
  });
};

export const SceneRunSummaryModal: React.FC<SceneRunSummaryModalProps> = ({
  resources,
  bricksDestroyed,
  totalBricksDestroyed,
  primaryAction,
  secondaryAction,
  title = "Run Complete",
  subtitle = "Resources recovered from the ruins:",
}) => {
  const hasResources = resources.length > 0;
  return (
    <div className="scene-run-summary">
      <div className="scene-run-summary__backdrop" />
      <div className="scene-run-summary__dialog">
        <h2 className="scene-run-summary__title">{title}</h2>
        <p className="scene-run-summary__subtitle">{subtitle}</p>
        {hasResources ? (
          <ul className="scene-run-summary__list">
            {resources.map((resource) => (
              <li key={resource.id} className="scene-run-summary__list-item">
                <span className="scene-run-summary__resource-name">{resource.name}</span>
                <span className="scene-run-summary__resource-amount">
                  {resource.amount}
                  <span className="scene-run-summary__resource-delta">{formatDelta(resource.gained)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="scene-run-summary__empty">No resources gathered this time.</p>
        )}
        <div className="scene-run-summary__stats">
          <div className="scene-run-summary__stat">
            <span className="scene-run-summary__stat-label">Bricks Destroyed</span>
            <span className="scene-run-summary__stat-value">{formatCount(bricksDestroyed)}</span>
            <span className="scene-run-summary__stat-note">
              Lifetime total: {formatCount(totalBricksDestroyed)}
            </span>
          </div>
        </div>
        <div className="scene-run-summary__actions">
          <Button onClick={primaryAction.onClick}>{primaryAction.label}</Button>
          {secondaryAction ? (
            <Button onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
