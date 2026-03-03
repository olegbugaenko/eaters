import { useCallback, useMemo } from "react";
import type { ResourceAmountPayload } from "@logic/modules/shared/resources/resources.types";
import { BuildingsWorkshopBridgeState } from "@/logic/modules/camp/buildings/buildings.types";
import { DEFAULT_BUILDINGS_WORKSHOP_STATE } from "@/logic/modules/camp/buildings/buildings.const";
import { ResourceCostDisplay } from "@ui-shared/ResourceCostDisplay";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { BuildingId } from "@db/buildings-db";
import { Button } from "@ui-shared/Button";
import { BonusEffectsPreviewList } from "@ui-shared/BonusEffectsPreviewList";
import { MasterDetailLayout } from "@ui-shared/MasterDetailLayout/MasterDetailLayout";
import { computeMissingCost } from "@ui-shared/helpers/computeMissingCost";
import type { BuildingsModuleUiApi } from "@logic/modules/camp/buildings/buildings.types";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import {
  DEFAULT_NEW_UNLOCKS_STATE,
  NEW_UNLOCKS_BRIDGE_KEY,
} from "@logic/services/new-unlock-notification/new-unlock-notification.const";
import type { NewUnlockNotificationBridgeState } from "@logic/services/new-unlock-notification/new-unlock-notification.types";
import { useLocalization } from "@ui/shared/useLocalization";
import "./BuildingsWorkshopView.css";

type BuildingsWorkshopViewProps = {
  state?: BuildingsWorkshopBridgeState;
  resources: ResourceAmountPayload[];
};

type BuildingItem = BuildingsWorkshopBridgeState["buildings"][number];

export const BuildingsWorkshopView: React.FC<BuildingsWorkshopViewProps> = ({
  state = DEFAULT_BUILDINGS_WORKSHOP_STATE,
  resources,
}) => {
  const { uiApi, bridge } = useAppLogic();
  const { t } = useLocalization();
  const workshop = uiApi.buildings as BuildingsModuleUiApi;
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

  const hideMaxed = state.hideMaxedWorkshop ?? false;
  const displayBuildings = useMemo(
    () => (hideMaxed ? state.buildings.filter((b) => !b.maxed) : state.buildings),
    [state.buildings, hideMaxed]
  );

  const handleUpgrade = useCallback(
    (id: BuildingId) => {
      workshop.tryUpgradeBuilding(id);
    },
    [workshop]
  );

  const getUnlockPath = useCallback(
    (item: BuildingItem) => `buildings.${item.id}`,
    []
  );

  const getCardClassName = useCallback(
    (item: BuildingItem) => {
      const missing = computeMissingCost(item.nextCost, totals);
      return Object.keys(missing).length > 0
        ? "buildings-workshop__card--missing-resources"
        : "";
    },
    [totals]
  );

  const renderCard = useCallback(
    (building: BuildingItem) => {
      const missing = computeMissingCost(building.nextCost, totals);
      const levelLabel =
        building.maxLevel !== null
          ? `${building.level}/${building.maxLevel}`
          : String(building.level);
      return (
        <>
          <div className="buildings-workshop__card-title-row">
            <span className="buildings-workshop__card-title heading-3">{building.name}</span>
            <span className="buildings-workshop__card-level">{levelLabel}</span>
          </div>
          <div className="buildings-workshop__card-cost">
            {building.nextCost ? (
              <ResourceCostDisplay cost={building.nextCost} missing={missing} />
            ) : (
              <span className="text-muted">{t("voidCamp.common.unavailable", "Unavailable")}</span>
            )}
          </div>
        </>
      );
    },
    [totals, t]
  );

  const renderDetail = useCallback(
    (activeBuilding: BuildingItem) => {
      const activeMissing = computeMissingCost(activeBuilding.nextCost, totals);
      return (
        <div className="buildings-workshop__detail">
          <div className="buildings-workshop__detail-header">
            <h3 className="heading-3">{activeBuilding.name}</h3>
            <span className="buildings-workshop__detail-level">
              {activeBuilding.maxLevel !== null
                ? `${activeBuilding.level}/${activeBuilding.maxLevel}`
                : String(activeBuilding.level)}
            </span>
          </div>
          <p className="buildings-workshop__detail-description">{activeBuilding.description}</p>
          <div className="buildings-workshop__detail-section">
            <h4>{t("voidCamp.common.bonuses", "Bonuses")}</h4>
            <BonusEffectsPreviewList
              effects={activeBuilding.bonusEffects}
              emptyLabel={t("voidCamp.maps.noBonuses", "No bonuses yet.")}
            />
          </div>
          <div className="buildings-workshop__detail-section">
            <h4>{t("voidCamp.buildings.construction", "Construction")}</h4>
            <div className="buildings-workshop__cost-row">
              <div className="building-row">
                <span className="text-subtle">{t("voidCamp.common.level", "Level")}</span>
                <span className="buildings-workshop__cost-value">
                  {activeBuilding.maxLevel !== null
                    ? `${activeBuilding.level}/${activeBuilding.maxLevel}`
                    : String(activeBuilding.level)}
                </span>
              </div>
              <div className="building-row">
                <span className="text-subtle">{t("voidCamp.common.status", "Status")}</span>
                <span className="buildings-workshop__cost-value">
                  {activeBuilding.maxed
                    ? t("voidCamp.common.maxed", "Maxed")
                    : activeBuilding.available
                    ? t("voidCamp.common.available", "Available")
                    : t("voidCamp.common.locked", "Locked")}
                </span>
              </div>
            </div>
            {activeBuilding.nextCost ? (
              <ResourceCostDisplay
                className="buildings-workshop__resource-cost"
                cost={activeBuilding.nextCost}
                missing={activeMissing}
              />
            ) : (
              <p className="text-muted body-sm">
                {activeBuilding.maxed
                  ? t("voidCamp.buildings.maxedDesc", "This building has reached its maximum level.")
                  : t("voidCamp.buildings.unavailableDesc", "Building unavailable. Fulfil its unlock requirements to construct.")}
              </p>
            )}
          </div>
          <div className="buildings-workshop__actions">
            <Button
              onClick={() => handleUpgrade(activeBuilding.id)}
              disabled={
                !activeBuilding.nextCost || Object.keys(activeMissing).length > 0
              }
            >
              {activeBuilding.level > 0 ? t("voidCamp.common.upgrade", "Upgrade") : t("voidCamp.buildings.construct", "Construct")}
            </Button>
          </div>
        </div>
      );
    },
    [totals, handleUpgrade, t]
  );

  const headerContent = (
    <>
      <p className="text-muted">{t("voidCamp.buildings.subtitle", "Raise permanent structures that empower your rituals.")}</p>
      <label className="buildings-workshop__hide-maxed">
        <input
          type="checkbox"
          checked={hideMaxed}
          onChange={(e) => workshop.setHideMaxedWorkshop(e.target.checked)}
        />
        <span>{t("voidCamp.common.hideMaxed", "Hide Maxed")}</span>
      </label>
    </>
  );

  const emptyHeader = (
    <div>
      <h2 className="heading-2">{t("voidCamp.buildings.title", "Construction Yard")}</h2>
      <p className="text-muted">{t("voidCamp.buildings.emptyTitle", "No building plans are available yet.")}</p>
    </div>
  );

  if (!state.buildings || state.buildings.length === 0) {
    return (
      <MasterDetailLayout
        items={[]}
        header={emptyHeader}
        renderCard={() => null}
        renderDetail={() => null}
        emptyState={t("voidCamp.buildings.emptyDesc", "Gain access to building blueprints to begin construction.")}
        emptyDetail={t("voidCamp.buildings.hoverHint", "Hover over a building to inspect its details.")}
        className="buildings-workshop"
      />
    );
  }

  return (
    <MasterDetailLayout
      items={displayBuildings}
      header={headerContent}
      renderCard={renderCard}
      renderDetail={renderDetail}
      emptyDetail={t("voidCamp.buildings.hoverHint", "Hover over a building to inspect its details.")}
      getUnlockPath={getUnlockPath}
      unseenPaths={unseenPaths}
      getCardClassName={getCardClassName}
      className="buildings-workshop"
    />
  );
};
