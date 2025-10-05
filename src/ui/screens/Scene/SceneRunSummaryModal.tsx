import { ResourceRunSummaryItem } from "../../../logic/modules/ResourcesModule";
import { Button } from "../../shared/Button";
import "./SceneRunSummaryModal.css";

interface SceneRunSummaryModalProps {
  resources: ResourceRunSummaryItem[];
  onLeave: () => void;
  onRestart: () => void;
}

const formatDelta = (value: number): string => {
  if (value <= 0) {
    return `(+0)`;
  }
  return `(+${value})`;
};

export const SceneRunSummaryModal: React.FC<SceneRunSummaryModalProps> = ({
  resources,
  onLeave,
  onRestart,
}) => {
  const hasResources = resources.length > 0;

  return (
    <div className="scene-run-summary">
      <div className="scene-run-summary__backdrop" />
      <div className="scene-run-summary__dialog">
        <h2 className="scene-run-summary__title">Run Complete</h2>
        <p className="scene-run-summary__subtitle">Resources recovered from the ruins:</p>
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
        <div className="scene-run-summary__actions">
          <Button onClick={onLeave}>Leave</Button>
          <Button onClick={onRestart}>Restart</Button>
        </div>
      </div>
    </div>
  );
};
