import { useCallback, useMemo } from "react";
import type { ResourceAmountPayload } from "@logic/modules/shared/resources/resources.types";
import { UnitModuleWorkshopBridgeState } from "@logic/modules/camp/unit-module-workshop/unit-module-workshop.types";
import { DEFAULT_UNIT_MODULE_WORKSHOP_STATE } from "@logic/modules/camp/unit-module-workshop/unit-module-workshop.const";
import { ResourceCostDisplay } from "@ui-shared/ResourceCostDisplay";
import { formatUnitModuleBonusValue } from "@ui-shared/format/unitModuleBonus";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { UnitModuleId } from "@db/unit-modules-db";
import { Button } from "@ui-shared/Button";
import { ModuleDetailsCard } from "@ui-shared/ModuleDetailsCard";
import { MasterDetailLayout } from "@ui-shared/MasterDetailLayout/MasterDetailLayout";
import { computeMissingCost } from "@ui-shared/helpers/computeMissingCost";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import {
  DEFAULT_NEW_UNLOCKS_STATE,
  NEW_UNLOCKS_BRIDGE_KEY,
} from "@logic/services/new-unlock-notification/new-unlock-notification.const";
import type { NewUnlockNotificationBridgeState } from "@logic/services/new-unlock-notification/new-unlock-notification.types";
import { useLocalization } from "@ui/shared/useLocalization";
import "./ModulesWorkshopView.css";
import type { UnitModuleWorkshopUiApi } from "@logic/modules/camp/unit-module-workshop/unit-module-workshop.types";

interface ModulesWorkshopViewProps {
  state?: UnitModuleWorkshopBridgeState;
  resources: ResourceAmountPayload[];
}

type ModuleItem = UnitModuleWorkshopBridgeState["modules"][number];

const computeNextBonusValue = (
  base: number,
  perLevel: number,
  currentLevel: number
): number => {
  const nextLevel = currentLevel + 1;
  if (nextLevel <= 0) {
    return 0;
  }
  return base + perLevel * (nextLevel - 1);
};

export const ModulesWorkshopView: React.FC<ModulesWorkshopViewProps> = ({
  state = DEFAULT_UNIT_MODULE_WORKSHOP_STATE,
  resources,
}) => {
  const { uiApi, bridge } = useAppLogic();
  const { t } = useLocalization();
  const workshop = uiApi.unitModuleWorkshop as UnitModuleWorkshopUiApi;
  const newUnlocksState = useBridgeValue(
    bridge,
    NEW_UNLOCKS_BRIDGE_KEY,
    DEFAULT_NEW_UNLOCKS_STATE as NewUnlockNotificationBridgeState
  );
  const unseenPaths = useMemo(
    () => new Set(newUnlocksState.unseenPaths),
    [newUnlocksState.unseenPaths]
  );
  const totals = useMemo(() => {
    const map: Record<string, number> = {};
    resources.forEach((entry) => {
      map[entry.id] = entry.amount;
    });
    return map;
  }, [resources]);

  const showMaxed = !(state.hideMaxedWorkshop ?? false);
  const showHidden = state.showHiddenWorkshop ?? false;
  const hiddenSet = useMemo(
    () => new Set(state.hiddenModuleIds ?? []),
    [state.hiddenModuleIds]
  );
  const displayModules = useMemo(
    () =>
      state.modules.filter(
        (m) =>
          (showHidden || !hiddenSet.has(m.id)) &&
          (showMaxed || !m.maxed)
      ),
    [state.modules, showMaxed, showHidden, hiddenSet]
  );

  const formatLevelLabel = useCallback(
    (level: number, maxLevel: number | null) =>
      maxLevel !== null ? `${level}/${maxLevel}` : String(level),
    []
  );

  const handleUpgrade = useCallback(
    (id: UnitModuleId) => {
      workshop.tryUpgradeModule(id);
    },
    [workshop]
  );

  const getUnlockPath = useCallback(
    (item: ModuleItem) => `biolab.organs.${item.id}`,
    []
  );

  const getCardClassName = useCallback(
    (item: ModuleItem) => {
      const missing = computeMissingCost(item.nextCost, totals);
      return Object.keys(missing).length > 0
        ? "modules-workshop__card--missing-resources"
        : "";
    },
    [totals]
  );

  const renderCard = useCallback(
    (module: ModuleItem) => {
      const moduleMissing = computeMissingCost(module.nextCost, totals);
      const levelLabel = formatLevelLabel(module.level, module.maxLevel);
      return (
        <>
          <div className="modules-workshop__card-title-row">
            <span className="modules-workshop__card-title heading-3">{module.name}</span>
            <span className="modules-workshop__card-level">{levelLabel}</span>
          </div>
          <div className="modules-workshop__card-cost">
            {module.nextCost ? (
              <ResourceCostDisplay
                cost={module.nextCost}
                missing={moduleMissing}
              />
            ) : (
              <span className="text-muted">
                {module.maxed ? t("voidCamp.common.maxed", "Maxed") : t("voidCamp.common.unavailable", "Unavailable")}
              </span>
            )}
          </div>
        </>
      );
    },
    [totals, formatLevelLabel, t]
  );

  const renderDetail = useCallback(
    (activeModule: ModuleItem) => {
      const activeMissing = computeMissingCost(activeModule.nextCost, totals);
      const isHidden = hiddenSet.has(activeModule.id);
      return (
        <ModuleDetailsCard
          name={activeModule.name}
          level={activeModule.level}
          levelLabel={formatLevelLabel(activeModule.level, activeModule.maxLevel)}
          description={activeModule.description}
          effectLabel={activeModule.bonusLabel}
          currentEffect={
            activeModule.level > 0
              ? formatUnitModuleBonusValue(
                  activeModule.bonusType,
                  activeModule.currentBonusValue
                )
              : t("voidCamp.common.locked", "Locked")
          }
          nextEffect={
            activeModule.maxed
              ? null
              : formatUnitModuleBonusValue(
                  activeModule.bonusType,
                  computeNextBonusValue(
                    activeModule.baseBonusValue,
                    activeModule.bonusPerLevel,
                    activeModule.level
                  )
                )
          }
          manaMultiplier={activeModule.manaCostMultiplier}
          sanityCost={activeModule.sanityCost}
          costSummary={
            activeModule.nextCost ? (
              <ResourceCostDisplay
                className="modules-workshop__resource-cost"
                cost={activeModule.nextCost}
                missing={activeMissing}
              />
            ) : (
              <p className="text-muted body-sm">
                {activeModule.maxed
                  ? t("voidCamp.modules.maxedDesc", "This organ has reached its maximum level.")
                  : t("voidCamp.modules.unavailableDesc", "Organ unavailable. Fulfil its unlock requirements to cultivate.")}
              </p>
            )
          }
          actions={
            <>
              <Button
                onClick={() => workshop.setModuleHidden(activeModule.id, !isHidden)}
              >
                {isHidden ? t("voidCamp.common.unhide", "Unhide") : t("voidCamp.common.hide", "Hide")}
              </Button>
              <Button
                onClick={() => handleUpgrade(activeModule.id)}
                disabled={!activeModule.nextCost || Object.keys(activeMissing).length > 0}
              >
                {activeModule.level > 0 ? t("voidCamp.common.upgrade", "Upgrade") : t("voidCamp.common.unlock", "Unlock")}
              </Button>
            </>
          }
        />
      );
    },
    [totals, formatLevelLabel, handleUpgrade, hiddenSet, workshop, t]
  );

  const headerContent = (
    <>
      <p className="text-muted">{t("voidCamp.modules.subtitle", "Cultivate organs and manifested parts, then refine them over time.")}</p>
      <div className="modules-workshop__filter-panel">
        <label className="modules-workshop__filter-checkbox">
          <input
            type="checkbox"
            checked={showMaxed}
            onChange={(e) => workshop.setHideMaxedWorkshop(!e.target.checked)}
          />
          <span>{t("voidCamp.common.showMaxed", "Show maxed")}</span>
        </label>
        <label className="modules-workshop__filter-checkbox">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => workshop.setShowHiddenWorkshop(e.target.checked)}
          />
          <span>{t("voidCamp.common.showHidden", "Show hidden")}</span>
        </label>
      </div>
    </>
  );

  const emptyHeader = (
    <div>
      <h2 className="heading-2">{t("voidCamp.modules.title", "Organ Workshop")}</h2>
      <p className="text-muted">{t("voidCamp.modules.emptyTitle", "Grow and craft organs once they become available.")}</p>
    </div>
  );

  if (!state.modules || state.modules.length === 0) {
    return (
      <MasterDetailLayout
        items={[]}
        header={emptyHeader}
        renderCard={() => null}
        renderDetail={() => null}
        emptyState={t("voidCamp.modules.emptyDesc", "No organs are available yet.")}
        emptyDetail={t("voidCamp.modules.hoverHint", "Hover over an organ to inspect its details.")}
        className="modules-workshop"
      />
    );
  }

  return (
    <MasterDetailLayout
      items={displayModules}
      header={headerContent}
      renderCard={renderCard}
      renderDetail={renderDetail}
      emptyDetail={t("voidCamp.modules.hoverHint", "Hover over an organ to inspect its details.")}
      getUnlockPath={getUnlockPath}
      unseenPaths={unseenPaths}
      getCardClassName={getCardClassName}
      className="modules-workshop"
    />
  );
};
