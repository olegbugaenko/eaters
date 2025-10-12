import { useCallback, useEffect, useMemo, useState } from "react";
import { ResourceAmountPayload } from "@logic/modules/ResourcesModule";
import {
  DEFAULT_UNIT_MODULE_WORKSHOP_STATE,
  UnitModuleWorkshopBridgeState,
} from "@logic/modules/UnitModuleWorkshopModule";
import { ResourceCostDisplay } from "@shared/ResourceCostDisplay";
import { formatNumber } from "@shared/format/number";
import { formatUnitModuleBonusValue } from "@shared/format/unitModuleBonus";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { UnitModuleId } from "@db/unit-modules-db";
import { ResourceId, getResourceConfig } from "@db/resources-db";
import { Button } from "@shared/Button";
import "./ModulesWorkshopView.css";

interface ModulesWorkshopViewProps {
  state?: UnitModuleWorkshopBridgeState;
  resources: ResourceAmountPayload[];
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
}) => {
  const { app } = useAppLogic();
  const workshop = useMemo(() => app.getUnitModuleWorkshop(), [app]);
  const totals = useMemo(() => {
    const map: Record<string, number> = {};
    resources.forEach((entry) => {
      map[entry.id] = entry.amount;
    });
    return map;
  }, [resources]);

  const [selectedId, setSelectedId] = useState<UnitModuleId | null>(state.modules[0]?.id ?? null);
  const [hoveredId, setHoveredId] = useState<UnitModuleId | null>(null);

  useEffect(() => {
    const fallback = state.modules[0]?.id ?? null;
    if (!selectedId) {
      setSelectedId(fallback);
      return;
    }
    const exists = state.modules.some((module) => module.id === selectedId);
    if (!exists) {
      setSelectedId(fallback);
    }
  }, [selectedId, state.modules]);

  const activeModule = useMemo(() => {
    const activeId = hoveredId ?? selectedId ?? state.modules[0]?.id ?? null;
    if (!activeId) {
      return null;
    }
    return state.modules.find((module) => module.id === activeId) ?? null;
  }, [hoveredId, selectedId, state.modules]);

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

  const formatCostSummary = useCallback((cost: Record<string, number> | null): string => {
    if (!cost) {
      return "Unavailable";
    }
    const entries = Object.entries(cost).filter(([, amount]) => amount > 0);
    if (entries.length === 0) {
      return "Free";
    }
    return entries
      .map(([id, amount]) => {
        const config = getResourceConfig(id as ResourceId);
        const label = config ? config.name : id;
        return `${formatNumber(amount, { maximumFractionDigits: 0 })} ${label}`;
      })
      .join(" · ");
  }, []);

  if (!state.modules || state.modules.length === 0) {
    return (
      <div className="modules-workshop surface-panel stack-lg">
        <header className="modules-workshop__header">
          <div>
            <h2 className="heading-2">Module Shop</h2>
            <p className="text-muted">Fabricate modules once they become available.</p>
          </div>
        </header>
        <div className="modules-workshop__empty">No modules are available yet.</div>
      </div>
    );
  }

  return (
    <div className="modules-workshop surface-panel stack-lg">
      <header className="modules-workshop__header">
        <div>
          <h2 className="heading-2">Module Shop</h2>
          <p className="text-muted">Craft ship augments and improve them over time.</p>
        </div>
      </header>
      <div className="modules-workshop__content">
        <ul className="modules-workshop__list">
          {state.modules.map((module) => {
            const isActive = module.id === (hoveredId ?? selectedId ?? module.id);
            return (
              <li key={module.id}>
                <button
                  type="button"
                  className={
                    "modules-workshop__card" + (isActive ? " modules-workshop__card--active" : "")
                  }
                  onClick={() => setSelectedId(module.id)}
                  onMouseEnter={() => setHoveredId(module.id)}
                  onMouseLeave={() =>
                    setHoveredId((current) => (current === module.id ? null : current))
                  }
                  onFocus={() => setHoveredId(module.id)}
                  onBlur={() => setHoveredId((current) => (current === module.id ? null : current))}
                >
                  <span className="modules-workshop__card-title">{module.name}</span>
                  <span className="modules-workshop__card-level">Level {module.level}</span>
                  <p className="modules-workshop__card-description">{module.description}</p>
                  <span className="modules-workshop__card-cost">
                    {formatCostSummary(module.nextCost)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <aside className="modules-workshop__details">
          {activeModule ? (
            <>
              <div className="modules-workshop__details-header">
                <h3 className="heading-3">{activeModule.name}</h3>
                <span className="modules-workshop__details-level">
                  Level {activeModule.level}
                </span>
              </div>
              <p className="modules-workshop__details-description">{activeModule.description}</p>
              <div className="modules-workshop__details-section">
                <h4>Effect Preview</h4>
                <div className="modules-workshop__effect-preview">
                  <span className="modules-workshop__effect-current">
                    {activeModule.level > 0
                      ? formatUnitModuleBonusValue(
                          activeModule.bonusType,
                          activeModule.currentBonusValue
                        )
                      : "Locked"}
                  </span>
                  <span className="modules-workshop__effect-arrow" aria-hidden="true">
                    →
                  </span>
                  <span className="modules-workshop__effect-next">
                    {formatUnitModuleBonusValue(
                      activeModule.bonusType,
                      computeNextBonusValue(
                        activeModule.baseBonusValue,
                        activeModule.bonusPerLevel,
                        activeModule.level
                      )
                    )}
                  </span>
                </div>
                <span className="modules-workshop__effect-label">{activeModule.bonusLabel}</span>
              </div>
              <div className="modules-workshop__details-section">
                <h4>Costs</h4>
                <div className="modules-workshop__cost-row">
                  <div>
                    <span className="text-subtle">Mana Multiplier</span>
                    <span className="modules-workshop__cost-value">
                      ×
                      {formatNumber(activeModule.manaCostMultiplier, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-subtle">Sanity Increase</span>
                    <span className="modules-workshop__cost-value">
                      +
                      {formatNumber(activeModule.sanityCost, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                </div>
                {activeModule.nextCost ? (
                  <ResourceCostDisplay
                    className="modules-workshop__resource-cost"
                    cost={activeModule.nextCost}
                    missing={activeMissing}
                  />
                ) : (
                  <p className="text-muted body-sm">
                    Unlock the Modules skill to begin fabrication.
                  </p>
                )}
              </div>
              <div className="modules-workshop__actions">
                <Button
                  onClick={() => handleUpgrade(activeModule.id)}
                  disabled={!activeModule.nextCost || Object.keys(activeMissing).length > 0}
                >
                  {activeModule.level > 0 ? "Upgrade" : "Unlock"}
                </Button>
              </div>
            </>
          ) : (
            <div className="modules-workshop__details-empty">
              Hover over a module to inspect its details.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
