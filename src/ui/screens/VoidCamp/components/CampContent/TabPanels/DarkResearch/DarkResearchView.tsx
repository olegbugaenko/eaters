import { useMemo } from "react";
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
import type {
  DarkResearchBridgeState,
  DarkResearchModuleUiApi,
} from "@logic/modules/camp/dark-research/dark-research.types";
import { useLocalization } from "@ui/shared/useLocalization";
import "./DarkResearchView.css";

const QUICK_BUTTONS: readonly { label: string; type: "set" | "delta" | "max"; value?: number }[] = [
  { label: "0", type: "set", value: 0 },
  { label: "-100", type: "delta", value: -100 },
  { label: "-10", type: "delta", value: -10 },
  { label: "-1", type: "delta", value: -1 },
  { label: "+1", type: "delta", value: 1 },
  { label: "+10", type: "delta", value: 10 },
  { label: "+100", type: "delta", value: 100 },
  { label: "Max", type: "max" },
];

interface DarkResearchViewProps {
  readonly state: DarkResearchBridgeState;
}

export const DarkResearchView: React.FC<DarkResearchViewProps> = ({ state }) => {
  const { t } = useLocalization();
  const { uiApi, bridge } = useAppLogic();
  const darkResearch = uiApi.darkResearch as DarkResearchModuleUiApi;
  const newUnlocksState = useBridgeValue(
    bridge,
    NEW_UNLOCKS_BRIDGE_KEY,
    DEFAULT_NEW_UNLOCKS_STATE as NewUnlockNotificationBridgeState
  );
  const unseenPaths = useMemo(
    () => new Set(newUnlocksState.unseenPaths),
    [newUnlocksState.unseenPaths]
  );

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
        <p className="text-muted">{t("voidCamp.darkResearch.subtitle", "Assign souls to researches to generate XP over time.")}</p>
        <p className="text-muted dark-research-view__souls-line">
          {t("voidCamp.darkResearch.souls", "Souls")}: {formatNumber(state.freeSouls, { maximumFractionDigits: 0 })}/
          {formatNumber(state.totalSouls, { maximumFractionDigits: 0 })}
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
                      {t("voidCamp.darkResearch.xp", "XP")}: {formatNumber(research.xp, { maximumFractionDigits: 1 })}/
                      {formatNumber(research.maxXp, { maximumFractionDigits: 1 })}
                    </span>
                    <span>
                      {t("voidCamp.darkResearch.gainRate", "Gain rate")}: {formatNumber(research.xpPerSecond, { maximumFractionDigits: 2 })}
                      {t("voidCamp.darkResearch.perSecondSuffix", "/s")}
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
                      <span className="text-muted">{t("voidCamp.darkResearch.assignedSouls", "Assigned souls")}</span>
                      <StableInput
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className="dark-research-card__queue-input"
                        value={research.assignedSouls}
                        onCommit={(value) => {
                          const parsed = Number(value);
                          darkResearch.setAssignedSouls(
                            research.id,
                            Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
                          );
                        }}
                      />
                    </label>
                  </div>

                  <div className="dark-research-card__quick-buttons">
                    {QUICK_BUTTONS.map((button) => (
                      <button
                        key={button.label}
                        type="button"
                        className={classNames("secondary-button", "small-button", "button")}
                        onClick={() => {
                          switch (button.type) {
                            case "set":
                              darkResearch.setAssignedSouls(research.id, button.value ?? 0);
                              return;
                            case "delta":
                              darkResearch.adjustAssignedSouls(research.id, button.value ?? 0);
                              return;
                            case "max":
                              darkResearch.setAssignedSouls(
                                research.id,
                                research.assignedSouls + state.freeSouls
                              );
                              return;
                            default:
                              return;
                          }
                        }}
                      >
                        {button.label === "Max" ? t("voidCamp.common.max", "Max") : button.label}
                      </button>
                    ))}
                  </div>
                </div>
              </NewUnlockWrapper>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
