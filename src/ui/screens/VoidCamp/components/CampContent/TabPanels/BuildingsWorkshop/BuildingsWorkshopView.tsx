import { useCallback, useEffect, useMemo, useState } from "react";
import type { ResourceAmountPayload } from "@logic/modules/shared/resources/resources.types";
import { BuildingsWorkshopBridgeState } from "@/logic/modules/camp/buildings/buildings.types";
import { DEFAULT_BUILDINGS_WORKSHOP_STATE } from "@/logic/modules/camp/buildings/buildings.const";
import { ResourceCostDisplay } from "@ui-shared/ResourceCostDisplay";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { BuildingId } from "@db/buildings-db";
import { Button } from "@ui-shared/Button";
import { BonusEffectsPreviewList } from "@ui-shared/BonusEffectsPreviewList";
import "../ModulesWorkshop/ModulesWorkshopView.css";
import type { BuildingsModuleUiApi } from "@logic/modules/camp/buildings/buildings.types";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import {
  DEFAULT_NEW_UNLOCKS_STATE,
  NEW_UNLOCKS_BRIDGE_KEY,
} from "@logic/services/new-unlock-notification/new-unlock-notification.const";
import type { NewUnlockNotificationBridgeState } from "@logic/services/new-unlock-notification/new-unlock-notification.types";
import { NewUnlockWrapper } from "@ui-shared/NewUnlockWrapper";

type BuildingsWorkshopViewProps = {
  state?: BuildingsWorkshopBridgeState;
  resources: ResourceAmountPayload[];
};

const computeMissingCost = (
  cost: Record<string, number> | null,
  totals: Record<string, number>
): Record<string, number> => {
  if (!cost) {
    return {};
  }
  const missing: Record<string, number> = {};
  Object.entries(cost).forEach(([key, amount]) => {
    if (amount <= 0) {
      return;
    }
    const current = totals[key] ?? 0;
    const delta = amount - current;
    if (delta > 0) {
      missing[key] = delta;
    }
  });
  return missing;
};

export const BuildingsWorkshopView: React.FC<BuildingsWorkshopViewProps> = ({
  state = DEFAULT_BUILDINGS_WORKSHOP_STATE,
  resources,
}) => {
  const { uiApi, bridge } = useAppLogic();
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

  const [selectedId, setSelectedId] = useState<BuildingId | null>(
    state.buildings[0]?.id ?? null
  );
  const [hoveredId, setHoveredId] = useState<BuildingId | null>(null);

  useEffect(() => {
    const fallback = state.buildings[0]?.id ?? null;
    if (!selectedId) {
      setSelectedId(fallback);
      return;
    }
    const exists = state.buildings.some((building) => building.id === selectedId);
    if (!exists) {
      setSelectedId(fallback);
    }
  }, [selectedId, state.buildings]);

  const activeBuilding = useMemo(() => {
    const activeId = hoveredId ?? selectedId ?? state.buildings[0]?.id ?? null;
    if (!activeId) {
      return null;
    }
    return state.buildings.find((building) => building.id === activeId) ?? null;
  }, [hoveredId, selectedId, state.buildings]);

  const activeMissing = useMemo(
    () => (activeBuilding ? computeMissingCost(activeBuilding.nextCost, totals) : {}),
    [activeBuilding, totals]
  );

  const handleUpgrade = useCallback(
    (id: BuildingId) => {
      workshop.tryUpgradeBuilding(id);
    },
    [workshop]
  );

  if (!state.buildings || state.buildings.length === 0) {
    return (
      <div className="modules-workshop surface-panel stack-lg">
        <header className="modules-workshop__header">
          <div>
            <h2 className="heading-2">Construction Yard</h2>
            <p className="text-muted">No building plans are available yet.</p>
          </div>
        </header>
        <div className="modules-workshop__empty">Gain access to building blueprints to begin construction.</div>
      </div>
    );
  }

  return (
    <div className="modules-workshop stack-lg">
      <header className="modules-workshop__header">
        <div>
          <p className="text-muted">Raise permanent structures that empower your rituals.</p>
        </div>
      </header>
      <div className="modules-workshop__content">
        <div className="modules-workshop__list-container">
          <ul className="modules-workshop__list">
            {state.buildings.map((building) => {
              const isActive = building.id === (hoveredId ?? selectedId ?? building.id);
              const missing = computeMissingCost(building.nextCost, totals);
              const hasMissingResources = Object.keys(missing).length > 0;
              const unlockPath = `buildings.${building.id}`;
              return (
                <li key={building.id}>
                  <NewUnlockWrapper
                    path={unlockPath}
                    hasNew={unseenPaths.has(unlockPath)}
                    markOnHover
                    className="new-unlock-wrapper--block"
                  >
                    <button
                      type="button"
                      className={
                        "modules-workshop__card" +
                        (isActive ? " modules-workshop__card--active" : "") +
                        (hasMissingResources ? " modules-workshop__card--missing-resources" : "")
                      }
                      onClick={() => setSelectedId(building.id)}
                      onMouseEnter={() => setHoveredId(building.id)}
                      onMouseLeave={() =>
                        setHoveredId((current) => (current === building.id ? null : current))
                      }
                      onFocus={() => setHoveredId(building.id)}
                      onBlur={() =>
                        setHoveredId((current) => (current === building.id ? null : current))
                      }
                    >
                      <span className="modules-workshop__card-title">{building.name}</span>
                      <span className="modules-workshop__card-level">Level {building.level}</span>
                      <p className="modules-workshop__card-description">{building.description}</p>
                      <div className="modules-workshop__card-cost">
                        {building.nextCost ? (
                          <ResourceCostDisplay cost={building.nextCost} missing={missing} />
                        ) : (
                          <span className="text-muted">Unavailable</span>
                        )}
                      </div>
                    </button>
                  </NewUnlockWrapper>
                </li>
              );
            })}
          </ul>
        </div>
        <aside>
          {activeBuilding ? (
            <div className="modules-workshop__details modules-workshop__details--scrollable">
              <div className="modules-workshop__details-header">
                <h3 className="heading-3">{activeBuilding.name}</h3>
                <span className="modules-workshop__details-level">Level {activeBuilding.level}</span>
              </div>
              <p className="modules-workshop__details-description">{activeBuilding.description}</p>
              <div className="modules-workshop__details-section">
                <h4>Bonuses</h4>
                <BonusEffectsPreviewList
                  effects={activeBuilding.bonusEffects}
                  emptyLabel="No bonuses yet."
                />
              </div>
              <div className="modules-workshop__details-section">
                <h4>Construction</h4>
                <div className="modules-workshop__cost-row">
                  <div className="building-row">
                    <span className="text-subtle">Max Level</span>
                    <span className="modules-workshop__cost-value">
                      {activeBuilding.maxLevel !== null ? activeBuilding.maxLevel : "∞"}
                    </span>
                  </div>
                  <div className="building-row">
                    <span className="text-subtle">Status</span>
                    <span className="modules-workshop__cost-value">
                      {activeBuilding.maxed
                        ? "Maxed"
                        : activeBuilding.available
                        ? "Available"
                        : "Locked"}
                    </span>
                  </div>
                </div>
                {activeBuilding.nextCost ? (
                  <ResourceCostDisplay
                    className="modules-workshop__resource-cost"
                    cost={activeBuilding.nextCost}
                    missing={activeMissing}
                  />
                ) : (
                  <p className="text-muted body-sm">
                    {activeBuilding.maxed
                      ? "This building has reached its maximum level."
                      : "Building unavailable. Fulfil its unlock requirements to construct."}
                  </p>
                )}
              </div>
              <div className="modules-workshop__actions">
                <Button
                  onClick={() => handleUpgrade(activeBuilding.id)}
                  disabled={
                    !activeBuilding.nextCost || Object.keys(activeMissing).length > 0
                  }
                >
                  {activeBuilding.level > 0 ? "Upgrade" : "Construct"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="modules-workshop__details modules-workshop__details--scrollable">
              <div className="modules-workshop__details-empty">
                Hover over a building to inspect its details.
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
