import { classNames } from "@ui/shared/classNames";
import "./VoidCampTopBar.css";

interface VoidCampTopBarProps {
  readonly versionLabel?: string;
  readonly onVersionClick?: () => void;
  readonly onSettingsClick: () => void;
  readonly onStatisticsClick: () => void;
  readonly onExitClick: () => void;
}

export const VoidCampTopBar: React.FC<VoidCampTopBarProps> = ({
  versionLabel,
  onVersionClick,
  onSettingsClick,
  onStatisticsClick,
  onExitClick,
}) => {
  return (
    <div className="void-camp-top-bar">
      <div className="void-camp-top-bar__left">
        <button
          type="button"
          className={classNames(
            "void-camp-top-bar__button",
            "void-camp-top-bar__button--statistics"
          )}
          onClick={onStatisticsClick}
        >
          Statistics
        </button>
        <button
          type="button"
          className={classNames(
            "void-camp-top-bar__button",
            "void-camp-top-bar__button--settings"
          )}
          onClick={onSettingsClick}
        >
          Settings
        </button>
      </div>
      <div className="void-camp-top-bar__right">
        <span className="void-camp-top-bar__label">Version</span>
        <button
          type="button"
          className={classNames(
            "void-camp-top-bar__button",
            "void-camp-top-bar__button--version"
          )}
          onClick={onVersionClick}
          disabled={!onVersionClick}
        >
          {versionLabel ?? "Unknown"}
        </button>
        <button
          type="button"
          className={classNames(
            "void-camp-top-bar__button",
            "void-camp-top-bar__button--exit"
          )}
          onClick={onExitClick}
        >
          Exit
        </button>
      </div>
    </div>
  );
};
