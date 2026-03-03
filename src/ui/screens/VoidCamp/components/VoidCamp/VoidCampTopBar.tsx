import { classNames } from "@ui/shared/classNames";
import { useLocalization } from "@ui/shared/useLocalization";
import "./VoidCampTopBar.css";

interface VoidCampTopBarProps {
  readonly versionLabel?: string;
  readonly onVersionClick?: () => void;
  readonly onSettingsClick: () => void;
  readonly onStatisticsClick: () => void;
  readonly onAchievementsClick?: () => void;
  readonly showAchievements?: boolean;
  readonly onExitClick: () => void;
  readonly wishlistUrl?: string;
  readonly feedbackUrl?: string;
}

export const VoidCampTopBar: React.FC<VoidCampTopBarProps> = ({
  versionLabel,
  onVersionClick,
  onSettingsClick,
  onStatisticsClick,
  onAchievementsClick,
  showAchievements,
  onExitClick,
  wishlistUrl,
  feedbackUrl,
}) => {
  const { t } = useLocalization();
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
          {t("voidCamp.topBar.statistics", "Statistics")}
        </button>
        {showAchievements && onAchievementsClick && (
          <button
            type="button"
            className={classNames(
              "void-camp-top-bar__button",
              "void-camp-top-bar__button--achievements"
            )}
            onClick={onAchievementsClick}
          >
            {t("voidCamp.topBar.achievements", "Achievements")}
          </button>
        )}
        <button
          type="button"
          className={classNames(
            "void-camp-top-bar__button",
            "void-camp-top-bar__button--settings"
          )}
          onClick={onSettingsClick}
        >
          {t("voidCamp.topBar.settings", "Settings")}
        </button>
      </div>
      <div className="void-camp-top-bar__right">
        {wishlistUrl && (
          <a
            className={classNames(
              "void-camp-top-bar__button",
              "void-camp-top-bar__button--wishlist",
              "void-camp-top-bar__link"
            )}
            href={wishlistUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t("voidCamp.topBar.wishlist", "Wishlist on Steam")}
          </a>
        )}
        {feedbackUrl && (
          <a
            className={classNames("void-camp-top-bar__feedback-link", "void-camp-top-bar__link")}
            href={feedbackUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t("voidCamp.topBar.feedback", "Feedback form")}
          </a>
        )}
        <span className="void-camp-top-bar__label">{t("voidCamp.topBar.version", "Version")}</span>
        <button
          type="button"
          className={classNames(
            "void-camp-top-bar__button",
            "void-camp-top-bar__button--version"
          )}
          onClick={onVersionClick}
          disabled={!onVersionClick}
        >
          {versionLabel ?? t("voidCamp.topBar.unknownVersion", "Unknown")}
        </button>
        <button
          type="button"
          className={classNames(
            "void-camp-top-bar__button",
            "void-camp-top-bar__button--exit"
          )}
          onClick={onExitClick}
        >
          {t("voidCamp.topBar.exit", "Exit")}
        </button>
      </div>
    </div>
  );
};
