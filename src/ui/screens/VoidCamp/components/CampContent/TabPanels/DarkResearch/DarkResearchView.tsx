import { useMemo, useState } from "react";
import { classNames } from "@ui-shared/classNames";
import { formatNumber } from "@ui-shared/format/number";
import { NewUnlockWrapper } from "@ui-shared/NewUnlockWrapper";
import { StableInput } from "@ui-shared/StableInput";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import {
  DEFAULT_NEW_UNLOCKS_STATE,
  NEW_UNLOCKS_BRIDGE_KEY,
} from "@logic/services/new-unlock-notification/new-unlock-notification.const";
import type { NewUnlockNotificationBridgeState } from "@logic/services/new-unlock-notification/new-unlock-notification.types";
import type { DarkResearchBridgeState } from "@logic/modules/camp/dark-research/dark-research.types";
import { useLocalization } from "@ui/shared/useLocalization";
import "./DarkResearchView.css";

const QUICK_BUTTONS: readonly { label: string; delta: number }[] = [
  { label: "-100", delta: -100 },
  { label: "-10", delta: -10 },
  { label: "-1", delta: -1 },
  { label: "+1", delta: 1 },
  { label: "+10", delta: 10 },
  { label: "+100", delta: 100 },
];

interface DarkResearchViewProps {
  readonly state: DarkResearchBridgeState;
}

export const DarkResearchView: React.FC<DarkResearchViewProps> = ({ state }) => {
  const { t } = useLocalization();
  const { bridge } = useAppLogic();
  const newUnlocksState = useBridgeValue(
    bridge,
    NEW_UNLOCKS_BRIDGE_KEY,
    DEFAULT_NEW_UNLOCKS_STATE as NewUnlockNotificationBridgeState
  );
  const unseenPaths = useMemo(
    () => new Set(newUnlocksState.unseenPaths),
    [newUnlocksState.unseenPaths]
  );
  const [queueById, setQueueById] = useState<Record<string, number>>({});

  if (!state.unlocked) {
    return (
      <div className="dark-research-view surface-panel stack-lg">
        <header className="dark-research-view__header">
          <h2 className="heading-2">{t("voidCamp.darkResearch.title", "Dark Research")}</h2>
          <p className="text-muted">
            {t(
              "voidCamp.darkResearch.locked",
              "Unlock Souls Harvest to begin forbidden studies."
            )}
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="dark-research-view stack-lg">
      <header className="dark-research-view__header">
        <p className="text-muted">
          {t(
            "voidCamp.darkResearch.subtitle",
            "Dark studies gain experience over time. Current temporary rate: 1 XP/sec per unlocked research."
          )}
        </p>
      </header>
      <ul className="dark-research-view__list">
        {state.researches.map((research) => {
          const unlockPath = `darkResearch.${research.id}`;
          const localizedName = t(`voidCamp.darkResearch.researches.${research.id}.name`, research.name);
          const localizedDescription = t(
            `voidCamp.darkResearch.researches.${research.id}.description`,
            research.description
          );
          const progress = research.maxXp > 0 ? research.xp / research.maxXp : 0;
          const progressPercent = Math.max(0, Math.min(100, Math.round(progress * 100)));
          const plannedQueue = queueById[research.id] ?? 0;

          return (
            <li key={research.id} className="dark-research-card">
              <NewUnlockWrapper
                path={unlockPath}
                hasNew={unseenPaths.has(unlockPath)}
                markOnHover
                className="new-unlock-wrapper--block"
              >
                <div className="dark-research-card__header">
                  <div className="dark-research-card__header-copy">
                    <div className="dark-research-card__title-row">
                      <h3 className="heading-3 dark-research-card__title">{localizedName}</h3>
                      <span className="dark-research-card__level">
                        {t("voidCamp.common.level", "Level")}: {formatNumber(research.level, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <p className="body-sm text-muted">{localizedDescription}</p>
                  </div>
                </div>

                <div className="dark-research-card__status">
                  <div className="dark-research-card__metrics">
                    <span>
                      {t("voidCamp.darkResearch.xp", "XP")}: {formatNumber(research.xp, { maximumFractionDigits: 1 })}/{formatNumber(research.maxXp, { maximumFractionDigits: 1 })}
                    </span>
                    <span>
                      {t("voidCamp.darkResearch.gainRate", "Gain rate")}: {formatNumber(research.xpPerSecond, { maximumFractionDigits: 2 })}{t("voidCamp.darkResearch.perSecondSuffix", "/s")}
                    </span>
                  </div>
                  <span className="dark-research-card__status-label">
                    {t("voidCamp.darkResearch.progress", "Research Progress")} · {progressPercent}%
                  </span>
                  <div className="dark-research-card__progress">
                    <div className="dark-research-card__progress-bar" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>

                <div className="dark-research-card__effects">
                  {research.bonusEffects.map((effect) => (
                    <div key={`${effect.bonusId}-${effect.effectType}`} className="dark-research-card__effect-row">
                      <span>{t(`bonuses.${effect.bonusId}.name`, effect.bonusName)}</span>
                      <span>
                        {formatNumber(effect.currentValue, { maximumFractionDigits: 3 })}
                        {" → "}
                        {formatNumber(effect.nextValue, { maximumFractionDigits: 3 })}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="dark-research-card__queue">
                  <div className="dark-research-card__queue-row">
                    <label className="dark-research-card__queue-label">
                      <span className="text-muted">{t("voidCamp.darkResearch.queue", "Queue (placeholder)")}</span>
                      <StableInput
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className="dark-research-card__queue-input"
                        value={plannedQueue}
                        onCommit={(value) => {
                          const parsed = Number(value);
                          setQueueById((current) => ({
                            ...current,
                            [research.id]: Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0,
                          }));
                        }}
                      />
                    </label>
                  </div>

                  <div className="dark-research-card__quick-buttons">
                    <button type="button" className={classNames("secondary-button", "small-button", "button")}>
                      0
                    </button>
                    {QUICK_BUTTONS.map((button) => (
                      <button
                        key={button.label}
                        type="button"
                        className={classNames("secondary-button", "small-button", "button")}
                        onClick={() => {
                          setQueueById((current) => ({
                            ...current,
                            [research.id]: Math.max(0, (current[research.id] ?? 0) + button.delta),
                          }));
                        }}
                      >
                        {button.label}
                      </button>
                    ))}
                    <button type="button" className={classNames("secondary-button", "small-button", "button")}>
                      {t("voidCamp.common.max", "Max")}
                    </button>
                  </div>
                  <span className="dark-research-card__queue-note text-muted">
                    {t("voidCamp.darkResearch.placeholderNote", "Queue and +/- controls are UI placeholders for upcoming functionality.")}
                  </span>
                </div>
              </NewUnlockWrapper>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
