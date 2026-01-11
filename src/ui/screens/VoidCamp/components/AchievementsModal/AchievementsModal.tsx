import { useCallback, useId } from "react";
import type { AchievementBridgeEntry } from "@logic/modules/shared/achievements/achievements.types";
import { BonusEffectsPreviewList } from "@ui-shared/BonusEffectsPreviewList";
import "./AchievementsModal.css";

interface AchievementsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly achievements: readonly AchievementBridgeEntry[];
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  isOpen,
  onClose,
  achievements,
}) => {
  const titleId = useId();

  const handleDialogClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  if (!isOpen) {
    return null;
  }

  // Only show achievements with level > 0
  const unlockedAchievements = achievements.filter((a) => a.level > 0);

  return (
    <div className="achievements-modal" onClick={onClose} role="presentation">
      <div
        className="achievements-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={handleDialogClick}
      >
        <header className="achievements-modal__header">
          <h2 id={titleId} className="achievements-modal__title">
            Achievements
          </h2>
          <button type="button" className="achievements-modal__close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="achievements-modal__content">
          {unlockedAchievements.length === 0 ? (
            <div className="achievements-modal__empty">
              No achievements unlocked yet. Complete special maps to earn achievements!
            </div>
          ) : (
            <ul className="achievements-modal__list">
              {unlockedAchievements.map((achievement) => (
                <li key={achievement.id} className="achievements-modal__item">
                  <div className="achievements-modal__item-header">
                    <div>
                      <h3 className="achievements-modal__item-title">
                        {achievement.name}
                      </h3>
                      <p className="achievements-modal__item-level">
                        Level {achievement.level} / {achievement.maxLevel}
                      </p>
                    </div>
                  </div>
                  <p className="achievements-modal__item-description">
                    {achievement.description}
                  </p>
                  {achievement.mapId && (
                    <p className="achievements-modal__item-source">
                      Source: {achievement.mapId}
                    </p>
                  )}
                  <div className="achievements-modal__item-bonuses">
                    <BonusEffectsPreviewList
                      effects={achievement.bonusEffects}
                      emptyLabel="No bonuses yet."
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
