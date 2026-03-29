import { useCallback, useMemo } from "react";
import { classNames } from "@ui-shared/classNames";
import { formatNumber } from "@ui-shared/format/number";
import { StableInput } from "@ui-shared/StableInput";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { MasterDetailLayout } from "@ui-shared/MasterDetailLayout/MasterDetailLayout";
import {
  DEFAULT_NEW_UNLOCKS_STATE,
  NEW_UNLOCKS_BRIDGE_KEY,
} from "@logic/services/new-unlock-notification/new-unlock-notification.const";
import type { NewUnlockNotificationBridgeState } from "@logic/services/new-unlock-notification/new-unlock-notification.types";
import type {
  DarkResearchBridgeState,
  DarkResearchItemBridgeState,
  DarkResearchModuleUiApi,
} from "@logic/modules/camp/dark-research/dark-research.types";
import { useLocalization } from "@ui/shared/useLocalization";
import { getAssetUrl } from "@shared/helpers/assets.helper";
import { formatDuration } from "@ui/utils/formatDuration";
import "./DarkResearchView.css";

const QUICK_BUTTONS: readonly {
  label: string;
  type: "set" | "delta" | "max";
  value?: number;
}[] = [
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

const formatEtaToNextLevel = (
  xp: number,
  maxXp: number,
  xpPerSecond: number,
): string => {
  if (!Number.isFinite(xpPerSecond) || xpPerSecond <= 0) {
    return "—";
  }
  const remainingXp = Math.max(0, maxXp - xp);
  if (remainingXp <= 0) {
    return "00:00";
  }
  const etaMs = (remainingXp / xpPerSecond) * 1000;
  return formatDuration(etaMs);
};

export const DarkResearchView: React.FC<DarkResearchViewProps> = ({
  state,
}) => {
  const { t } = useLocalization();
  const { uiApi, bridge } = useAppLogic();
  const darkResearch = uiApi.darkResearch as DarkResearchModuleUiApi;
  const newUnlocksState = useBridgeValue(
    bridge,
    NEW_UNLOCKS_BRIDGE_KEY,
    DEFAULT_NEW_UNLOCKS_STATE as NewUnlockNotificationBridgeState,
  );
  const unseenPaths = useMemo(
    () => new Set(newUnlocksState.unseenPaths),
    [newUnlocksState.unseenPaths],
  );

  const getUnlockPath = useCallback(
    (item: DarkResearchItemBridgeState) => `darkResearch.${item.id}`,
    [],
  );

  const renderCard = useCallback(
    (research: DarkResearchItemBridgeState) => {
      const localizedName = t(
        `voidCamp.darkResearch.researches.${research.id}.name`,
        research.name,
      );
      const progress = research.maxXp > 0 ? research.xp / research.maxXp : 0;
      const progressPercent = Math.max(
        0,
        Math.min(100, Math.round(progress * 100)),
      );
      const etaToNextLevel = formatEtaToNextLevel(
        research.xp,
        research.maxXp,
        research.xpPerSecond,
      );

      return (
        <>
          <div className="dark-research-card__title-row">
            <h3 className="heading-3 dark-research-card__title">
              {localizedName}
            </h3>
            <span className="dark-research-card__level">
              {t("voidCamp.common.level", "Level")}:{" "}
              {formatNumber(research.level, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="dark-research-card__eta">
            <span className="text-muted">
              {t("scene.targetTooltip.remaining", "Remaining")}:
            </span>
            <span>{etaToNextLevel}</span>
          </div>
          <div className="dark-research-card__progress">
            <div
              className="dark-research-card__progress-bar"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="dark-research-card__queue-row">
            <label className="dark-research-card__queue-label">
              <span className="text-muted">
                {t("voidCamp.darkResearch.assignedSouls", "Assigned souls")}
              </span>
              <div className="dark-research-card__queue-control">
                <button
                  type="button"
                  className={classNames(
                    "secondary-button",
                    "small-button",
                    "button",
                  )}
                  disabled={research.assignedSouls <= 0}
                  onClick={() => darkResearch.adjustAssignedSouls(research.id, -1)}
                  aria-label={t(
                    "voidCamp.darkResearch.decreaseAssignedSouls",
                    "Decrease assigned souls",
                  )}
                >
                  -
                </button>
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
                      Number.isFinite(parsed)
                        ? Math.max(0, Math.floor(parsed))
                        : 0,
                    );
                  }}
                />
                <button
                  type="button"
                  className={classNames(
                    "secondary-button",
                    "small-button",
                    "button",
                  )}
                  disabled={state.freeSouls <= 0}
                  onClick={() => darkResearch.adjustAssignedSouls(research.id, 1)}
                  aria-label={t(
                    "voidCamp.darkResearch.increaseAssignedSouls",
                    "Increase assigned souls",
                  )}
                >
                  +
                </button>
              </div>
            </label>
            <label className="dark-research-card__queue-label">
              <span className="text-muted">
                {t("voidCamp.darkResearch.autoAssignPercent", "Auto assign %")}
              </span>
              <StableInput
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                className="dark-research-card__queue-input"
                value={research.autoAssignPercent}
                onCommit={(value) => {
                  const parsed = Number(value);
                  darkResearch.setAutoAssignPercent(
                    research.id,
                    Number.isFinite(parsed)
                      ? Math.max(0, Math.floor(parsed))
                      : 0,
                  );
                }}
              />
            </label>
          </div>
        </>
      );
    },
    [darkResearch, t],
  );

  const renderDetail = useCallback(
    (research: DarkResearchItemBridgeState) => {
      const localizedName = t(
        `voidCamp.darkResearch.researches.${research.id}.name`,
        research.name,
      );
      const localizedDescription = t(
        `voidCamp.darkResearch.researches.${research.id}.description`,
        research.description,
      );
      const progress = research.maxXp > 0 ? research.xp / research.maxXp : 0;
      const progressPercent = Math.max(
        0,
        Math.min(100, Math.round(progress * 100)),
      );

      return (
        <div className="dark-research-detail">
          <div className="dark-research-detail__header">
            <h3 className="heading-3">{localizedName}</h3>
            <span className="dark-research-detail__level">
              {t("voidCamp.common.level", "Level")}:{" "}
              {formatNumber(research.level, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <p className="dark-research-detail__description">
            {localizedDescription}
          </p>

          <div className="dark-research-detail__section">
            <h4>{t("voidCamp.darkResearch.progress", "Research Progress")}</h4>
            <div className="dark-research-detail__metrics">
              <div className="dark-research-detail__metric-row">
                <span className="text-subtle">
                  {t("voidCamp.darkResearch.xp", "XP")}
                </span>
                <span className="dark-research-detail__metric-value">
                  {formatNumber(research.xp, { maximumFractionDigits: 1 })}/
                  {formatNumber(research.maxXp, { maximumFractionDigits: 1 })}
                </span>
              </div>
              <div className="dark-research-detail__metric-row">
                <span className="text-subtle">
                  {t("voidCamp.darkResearch.gainRate", "Gain rate")}
                </span>
                <span className="dark-research-detail__metric-value">
                  {formatNumber(research.xpPerSecond, {
                    maximumFractionDigits: 2,
                  })}
                  {t("voidCamp.darkResearch.perSecondSuffix", "/s")}
                </span>
              </div>
              <div className="dark-research-detail__metric-row">
                <span className="text-subtle">
                  {t("voidCamp.darkResearch.progress", "Research Progress")}
                </span>
                <span className="dark-research-detail__metric-value">
                  {progressPercent}%
                </span>
              </div>
            </div>
          </div>

          <div className="dark-research-detail__section">
            <h4>{t("voidCamp.common.bonuses", "Bonuses")}</h4>
            <div className="dark-research-detail__effects">
              {research.bonusEffects.map((effect) => (
                <div
                  key={`${effect.bonusId}-${effect.effectType}`}
                  className="dark-research-detail__effect-row"
                >
                  <span>
                    {t(`bonuses.${effect.bonusId}.name`, effect.bonusName)}
                  </span>
                  <span className="dark-research-detail__effect-values">
                    <span className="dark-research-detail__effect-current">
                      {formatNumber(effect.currentValue, {
                        maximumFractionDigits: 3,
                      })}
                    </span>
                    <span
                      className="dark-research-detail__effect-arrow"
                      aria-hidden="true"
                    >
                      →
                    </span>
                    <span className="dark-research-detail__effect-next">
                      {formatNumber(effect.nextValue, {
                        maximumFractionDigits: 3,
                      })}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="dark-research-detail__section">
            <h4>
              {t("voidCamp.darkResearch.soulAssignment", "Soul Assignment")}
            </h4>
            <div className="dark-research-detail__quick-buttons">
              {QUICK_BUTTONS.map((button) => {
                const isPositive =
                  button.type === "max" ||
                  (button.type === "delta" && (button.value ?? 0) > 0);
                const noFreeSouls = state.freeSouls < 1;
                const nothingToRemove = research.assignedSouls <= 0;
                const isNegative =
                  button.type === "delta" && (button.value ?? 0) < 0;
                const isSetZero = button.type === "set" && button.value === 0;
                const isDisabled =
                  (isPositive && noFreeSouls) ||
                  ((isNegative || isSetZero) && nothingToRemove);

                return (
                  <button
                    key={button.label}
                    type="button"
                    className={classNames(
                      "secondary-button",
                      "small-button",
                      "button",
                    )}
                    disabled={isDisabled}
                    onClick={() => {
                      switch (button.type) {
                        case "set":
                          darkResearch.setAssignedSouls(
                            research.id,
                            button.value ?? 0,
                          );
                          return;
                        case "delta":
                          darkResearch.adjustAssignedSouls(
                            research.id,
                            button.value ?? 0,
                          );
                          return;
                        case "max":
                          darkResearch.setAssignedSouls(
                            research.id,
                            research.assignedSouls + state.freeSouls,
                          );
                          return;
                        default:
                          return;
                      }
                    }}
                  >
                    {button.label === "Max"
                      ? t("voidCamp.common.max", "Max")
                      : button.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    },
    [darkResearch, state.freeSouls, t],
  );

  if (!state.unlocked) {
    return (
      <div className="dark-research-view surface-panel stack-lg">
        <header className="dark-research-view__header">
          <h2 className="heading-2">
            {t("voidCamp.darkResearch.title", "Dark Research")}
          </h2>
          <p className="text-muted">
            {t(
              "voidCamp.darkResearch.locked",
              "Unlock Souls Harvest to begin forbidden studies.",
            )}
          </p>
        </header>
      </div>
    );
  }

  const headerContent = (
    <>
      <p className="text-muted">
        {t(
          "voidCamp.darkResearch.subtitle",
          "Assign souls to researches to generate XP over time.",
        )}
      </p>
      <p className="text-muted dark-research-view__souls-line">
        <span className="dark-research-view__souls-label">
          <img
            className="dark-research-view__souls-icon"
            src={getAssetUrl("images/collectable/soul.png")}
            alt=""
            aria-hidden="true"
          />
          <span>{t("voidCamp.darkResearch.souls", "Souls (free/total):")}</span>
        </span>
        <span className="dark-research-view__souls-values">
          {formatNumber(state.freeSouls, { maximumFractionDigits: 0 })}
          <span className="dark-research-view__souls-sep">/</span>
          {formatNumber(state.totalSouls, { maximumFractionDigits: 0 })}
        </span>
      </p>
    </>
  );

  return (
    <MasterDetailLayout
      items={state.researches}
      header={headerContent}
      renderCard={renderCard}
      renderDetail={renderDetail}
      emptyDetail={t(
        "voidCamp.darkResearch.hoverHint",
        "Hover over a research to inspect its details.",
      )}
      getUnlockPath={getUnlockPath}
      unseenPaths={unseenPaths}
      className="dark-research-view"
    />
  );
};
