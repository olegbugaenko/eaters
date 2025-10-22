import { ResourceRunSummaryItem } from "../../../logic/modules/shared/ResourcesModule";
import { Button } from "../../shared/Button";
import { formatNumber } from "../../shared/format/number";
import "./SceneRunSummaryModal.css";

interface SceneRunSummaryModalAction {
  label: string;
  onClick: () => void;
}

interface SceneRunSummaryAutoRestartControls {
  enabled: boolean;
  countdown: number;
  onToggle: (enabled: boolean) => void;
  thresholdEnabled: boolean;
  minEffectiveUnits: number;
  onUpdateThreshold: (enabled: boolean, minUnits: number) => void;
}

interface SceneRunSummaryModalProps {
  resources: ResourceRunSummaryItem[];
  bricksDestroyed: number;
  totalBricksDestroyed: number;
  primaryAction: SceneRunSummaryModalAction;
  secondaryAction?: SceneRunSummaryModalAction;
  title?: string;
  subtitle?: string;
  autoRestart?: SceneRunSummaryAutoRestartControls;
}

const formatDelta = (value: number): string => {
  if (value <= 0) {
    return "(+0)";
  }
  return `(+${formatNumber(value, { maximumFractionDigits: 2 })})`;
};

const formatRate = (value: number): string => {
  if (value <= 0 || !Number.isFinite(value)) {
    return "0/s";
  }
  return `${formatNumber(value, {
    maximumFractionDigits: 2,
    minimumFractionDigits: value < 10 ? 2 : 0,
  })}/s`;
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
  autoRestart,
  title = "Run Complete",
  subtitle = "Resources recovered from the ruins:",
}) => {
  const collectedResources = resources.filter((resource) => resource.gained > 0);
  const hasResources = collectedResources.length > 0;
  return (
    <div className="scene-run-summary">
      <div className="scene-run-summary__backdrop" />
      <div className="scene-run-summary__dialog">
        <h2 className="scene-run-summary__title">{title}</h2>
        <p className="scene-run-summary__subtitle">{subtitle}</p>
        {hasResources ? (
          <ul className="scene-run-summary__list">
            {collectedResources.map((resource) => (
              <li key={resource.id} className="scene-run-summary__list-item">
                <span className="scene-run-summary__resource-name">{resource.name}</span>
                <span className="scene-run-summary__resource-amount">
                  {formatNumber(resource.amount)}
                  <span className="scene-run-summary__resource-delta">
                    {formatDelta(resource.gained)}
                  </span>
                  <span className="scene-run-summary__resource-rate">
                    {formatRate(resource.ratePerSecond)}
                  </span>
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
        {autoRestart ? (
          <div className="scene-run-summary__auto-restart">
            <label className="scene-run-summary__auto-restart-toggle">
              <input
                type="checkbox"
                checked={autoRestart.enabled}
                onChange={(event) => autoRestart.onToggle(event.target.checked)}
              />
              <span>Autorestart</span>
            </label>
            <span className="scene-run-summary__auto-restart-timer">
              {Math.max(0, Math.ceil(autoRestart.countdown))}s
            </span>
            <div className="scene-run-summary__threshold">
              <label className="scene-run-summary__auto-restart-toggle">
                <input
                  type="checkbox"
                  checked={autoRestart.thresholdEnabled}
                  onChange={(e) => autoRestart.onUpdateThreshold(e.target.checked, autoRestart.minEffectiveUnits)}
                />
                <span>Early restart when effective units below</span>
              </label>
              <input
                className="scene-run-summary__threshold-input"
                type="number"
                min={0}
                value={autoRestart.minEffectiveUnits}
                onChange={(e) => autoRestart.onUpdateThreshold(autoRestart.thresholdEnabled, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              />
            </div>
          </div>
        ) : null}
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
