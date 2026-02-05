import { useCallback, useEffect, useMemo, useState } from "react";
import type { ResourceAmountPayload } from "@logic/modules/shared/resources/resources.types";
import { UnitModuleWorkshopBridgeState } from "@logic/modules/camp/unit-module-workshop/unit-module-workshop.types";
import { DEFAULT_UNIT_MODULE_WORKSHOP_STATE } from "@logic/modules/camp/unit-module-workshop/unit-module-workshop.const";
import { ResourceCostDisplay } from "@ui-shared/ResourceCostDisplay";
import { formatUnitModuleBonusValue } from "@ui-shared/format/unitModuleBonus";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { UnitModuleId } from "@db/unit-modules-db";
import { Button } from "@ui-shared/Button";
import { ModuleDetailsCard } from "@ui-shared/ModuleDetailsCard";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import {
  DEFAULT_NEW_UNLOCKS_STATE,
  NEW_UNLOCKS_BRIDGE_KEY,
} from "@logic/services/new-unlock-notification/new-unlock-notification.const";
import type { NewUnlockNotificationBridgeState } from "@logic/services/new-unlock-notification/new-unlock-notification.types";
import { NewUnlockWrapper } from "@ui-shared/NewUnlockWrapper";
import "./ModulesWorkshopView.css";
import type { UnitModuleWorkshopUiApi } from "@logic/modules/camp/unit-module-workshop/unit-module-workshop.types";
import type { BuildingsModuleUiApi } from "@logic/modules/camp/buildings/buildings.types";

interface ModulesWorkshopViewProps {
  state?: UnitModuleWorkshopBridgeState;
  resources: ResourceAmountPayload[];
  hideMaxedWorkshop?: boolean;
}

const computeMissingCost = (
  cost: Record<string, number> | null,
  totals: Record<string, number>
): Record<string, number> => {
  if (!cost) {
    return {};
  }
  const missing: Record<string, number> = {};
  Object.entries(cost).forEach(([key, amount]) => {
    const current = totals[key] ?? 0;
    const delta = amount - current;
    if (delta > 0) {
      missing[key] = delta;
    }
  });
  return missing;
};

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
  hideMaxedWorkshop = false,
}) => {
  const { uiApi, bridge } = useAppLogic();
  const workshop = uiApi.unitModuleWorkshop as UnitModuleWorkshopUiApi;
  const buildingsApi = uiApi.buildings as BuildingsModuleUiApi;
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

  const [selectedId, setSelectedId] = useState<UnitModuleId | null>(state.modules[0]?.id ?? null);
  const [hoveredId, setHoveredId] = useState<UnitModuleId | null>(null);

  const displayModules = useMemo(
    () =>
      hideMaxedWorkshop
        ? state.modules.filter((m) => !m.maxed)
        : state.modules,
    [state.modules, hideMaxedWorkshop]
  );

  useEffect(() => {
    const fallback = displayModules[0]?.id ?? null;
    if (!selectedId) {
      setSelectedId(fallback);
      return;
    }
    const exists = displayModules.some((module) => module.id === selectedId);
    if (!exists) {
      setSelectedId(fallback);
    }
  }, [selectedId, displayModules]);

  const activeModule = useMemo(() => {
    const activeId = hoveredId ?? selectedId ?? state.modules[0]?.id ?? null;
    if (!activeId) {
      return null;
    }
    return state.modules.find((module) => module.id === activeId) ?? null;
  }, [hoveredId, selectedId, state.modules]);

  const formatMaxLevel = useCallback((value: number | null) => (value !== null ? value : "∞"), []);

  const activeMissing = useMemo(
    () => (activeModule ? computeMissingCost(activeModule.nextCost, totals) : {}),
    [activeModule, totals]
  );

  const handleUpgrade = useCallback(
    (id: UnitModuleId) => {
      workshop.tryUpgradeModule(id);
    },
    [workshop]
  );

  if (!state.modules || state.modules.length === 0) {
    return (
      <div className="modules-workshop surface-panel stack-lg">
        <header className="modules-workshop__header">
          <div>
            <h2 className="heading-2">Organ Workshop</h2>
            <p className="text-muted">Grow and craft organs once they become available.</p>
          </div>
        </header>
        <div className="modules-workshop__empty">No organs are available yet.</div>
      </div>
    );
  }

  return (
    <div className="modules-workshop stack-lg">
      <header className="modules-workshop__header modules-workshop__header--row">
        <p className="text-muted">Cultivate organs and manifested parts, then refine them over time.</p>
        <label className="modules-workshop__hide-maxed">
          <input
            type="checkbox"
            checked={hideMaxedWorkshop}
            onChange={(e) => buildingsApi.setHideMaxedWorkshop(e.target.checked)}
          />
          <span>Hide Maxed</span>
        </label>
      </header>
      <div className="modules-workshop__content">
        <div className="modules-workshop__list-container">
          <ul className="modules-workshop__list">
          {displayModules.map((module) => {
            const isActive = module.id === (hoveredId ?? selectedId ?? module.id);
            const moduleMissing = computeMissingCost(module.nextCost, totals);
            const hasMissingResources = Object.keys(moduleMissing).length > 0;
            const unlockPath = `biolab.organs.${module.id}`;
            const maxLevelLabel = formatMaxLevel(module.maxLevel);
            return (
              <li key={module.id}>
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
                    onClick={() => setSelectedId(module.id)}
                    onMouseEnter={() => setHoveredId(module.id)}
                    onMouseLeave={() =>
                      setHoveredId((current) => (current === module.id ? null : current))
                    }
                    onFocus={() => setHoveredId(module.id)}
                    onBlur={() => setHoveredId((current) => (current === module.id ? null : current))}
                  >
                    <span className="modules-workshop__card-title heading-3">{module.name}</span>
                    <span className="modules-workshop__card-level">
                      {module.level}/{maxLevelLabel}
                    </span>
                    <div className="modules-workshop__card-cost">
                      {module.nextCost ? (
                        <ResourceCostDisplay
                          cost={module.nextCost}
                          missing={moduleMissing}
                        />
                      ) : (
                        <span className="text-muted">
                          {module.maxed ? "Maxed" : "Unavailable"}
                        </span>
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
          {activeModule ? (
            <ModuleDetailsCard
              className="modules-workshop__details--scrollable"
              name={activeModule.name}
              level={activeModule.level}
              levelLabel={`${activeModule.level}/${formatMaxLevel(activeModule.maxLevel)}`}
              description={activeModule.description}
              effectLabel={activeModule.bonusLabel}
              currentEffect={
                activeModule.level > 0
                  ? formatUnitModuleBonusValue(
                      activeModule.bonusType,
                      activeModule.currentBonusValue
                    )
                  : "Locked"
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
                      ? "This organ has reached its maximum level."
                      : "Organ unavailable. Fulfil its unlock requirements to cultivate."}
                  </p>
                )
              }
              actions={
                <Button
                  onClick={() => handleUpgrade(activeModule.id)}
                  disabled={!activeModule.nextCost || Object.keys(activeMissing).length > 0}
                >
                  {activeModule.level > 0 ? "Upgrade" : "Unlock"}
                </Button>
              }
            />
          ) : (
            <div className="modules-workshop__details modules-workshop__details--scrollable">
              <div className="modules-workshop__details-empty">
                Hover over an organ to inspect its details.
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
