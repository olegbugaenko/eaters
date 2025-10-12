import { useCallback, useEffect, useMemo, useState } from "react";
import { ResourceCostDisplay } from "@shared/ResourceCostDisplay";
import { ResourceAmountPayload } from "@logic/modules/ResourcesModule";
import { UnitDesignerBridgeState } from "@logic/modules/UnitDesignModule";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { formatUnitModuleBonusValue } from "@shared/format/unitModuleBonus";
import { buildUnitStatEntries } from "@shared/unitStats";
import { PlayerUnitType } from "@db/player-units-db";
import { formatNumber } from "@shared/format/number";
import { UnitModuleId } from "@db/unit-modules-db";
import "./UnitDesignerView.css";

interface UnitDesignerViewProps {
  state: UnitDesignerBridgeState;
  resources: ResourceAmountPayload[];
}

const DEFAULT_UNIT_TYPE: PlayerUnitType = "bluePentagon";

const computeResourceTotals = (resources: ResourceAmountPayload[]): Record<string, number> => {
  const totals: Record<string, number> = {};
  resources.forEach((entry) => {
    totals[entry.id] = entry.amount;
  });
  return totals;
};

const computeMissing = (
  cost: { mana: number; sanity: number },
  totals: Record<string, number>
): { mana: number; sanity: number } => ({
  mana: Math.max(cost.mana - (totals.mana ?? 0), 0),
  sanity: Math.max(cost.sanity - (totals.sanity ?? 0), 0),
});

const getDefaultType = (units: readonly { type: PlayerUnitType }[], fallback: PlayerUnitType) =>
  units[0]?.type ?? fallback;

export const UnitDesignerView: React.FC<UnitDesignerViewProps> = ({ state, resources }) => {
  const { app } = useAppLogic();
  const designer = useMemo(() => app.getUnitDesigner(), [app]);
  const totals = useMemo(() => computeResourceTotals(resources), [resources]);
  const [selectedId, setSelectedId] = useState<string | null>(state.units[0]?.id ?? null);

  useEffect(() => {
    if (state.units.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current && state.units.some((unit) => unit.id === current)) {
        return current;
      }
      return state.units[0]?.id ?? null;
    });
  }, [state.units]);

  const selectedUnit = useMemo(
    () => state.units.find((unit) => unit.id === selectedId) ?? state.units[0] ?? null,
    [state.units, selectedId]
  );

  const missingCost = useMemo(
    () => (selectedUnit ? computeMissing(selectedUnit.cost, totals) : { mana: 0, sanity: 0 }),
    [selectedUnit, totals]
  );

  const handleSelectUnit = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleCreateUnit = useCallback(() => {
    const type = selectedUnit?.type ?? getDefaultType(state.units, DEFAULT_UNIT_TYPE);
    const id = designer.createDesign(type);
    setSelectedId(id);
  }, [designer, selectedUnit?.type, state.units]);

  const handleDeleteUnit = useCallback(
    (id: string) => {
      designer.deleteDesign(id);
    },
    [designer]
  );

  const handleRenameUnit = useCallback(
    (id: string, name: string) => {
      designer.updateDesign(id, { name });
    },
    [designer]
  );

  const handleRemoveModule = useCallback(
    (unitId: string, moduleId: UnitModuleId, modules: readonly UnitModuleId[]) => {
      designer.updateDesign(unitId, { modules: modules.filter((entry) => entry !== moduleId) });
    },
    [designer]
  );

  const handleAddModule = useCallback(
    (unitId: string, moduleId: UnitModuleId, modules: readonly UnitModuleId[]) => {
      designer.updateDesign(unitId, { modules: [...modules, moduleId] });
    },
    [designer]
  );

  if (!selectedUnit) {
    return (
      <div className="unit-designer surface-panel stack-lg">
        <header className="unit-designer__header">
          <div>
            <h2 className="heading-2">Unit Designer</h2>
            <p className="body-md text-muted">Create units once modules are available.</p>
          </div>
          <button type="button" className="button button--primary" onClick={handleCreateUnit}>
            New Unit
          </button>
        </header>
        <p className="body-md text-muted">No units available yet.</p>
      </div>
    );
  }

  const selectedModuleIds = selectedUnit.modules;
  const selectedDetails = selectedUnit.moduleDetails;
  const statEntries = buildUnitStatEntries(selectedUnit.blueprint);
  const isAtModuleCap = selectedModuleIds.length >= state.maxModules;

  return (
    <div className="unit-designer surface-panel stack-lg">
      <header className="unit-designer__header">
        <div>
          <h2 className="heading-2">Unit Designer</h2>
          <p className="body-md text-muted">
            Configure custom ships by slotting modules you have fabricated.
          </p>
        </div>
        <button type="button" className="button button--primary" onClick={handleCreateUnit}>
          New Unit
        </button>
      </header>
      <div className="unit-designer__content">
        <aside className="unit-designer__list">
          <h3 className="heading-4">Units</h3>
          <ul className="unit-designer__list-items">
            {state.units.map((unit) => {
              const isActive = unit.id === selectedUnit.id;
              return (
                <li key={unit.id}>
                  <button
                    type="button"
                    className={[
                      "unit-designer__list-item",
                      isActive ? "unit-designer__list-item--active" : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleSelectUnit(unit.id)}
                  >
                    <span className="unit-designer__list-name">{unit.name}</span>
                    <span className="unit-designer__list-modules">{unit.modules.length} modules</span>
                  </button>
                  <button
                    type="button"
                    className="button button--text unit-designer__delete"
                    onClick={() => handleDeleteUnit(unit.id)}
                    aria-label={`Delete ${unit.name}`}
                  >
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        <section className="unit-designer__editor">
          <div className="unit-designer__field">
            <label htmlFor="unit-designer-name" className="label">
              Unit Name
            </label>
            <input
              id="unit-designer-name"
              type="text"
              className="input"
              value={selectedUnit.name}
              onChange={(event) => handleRenameUnit(selectedUnit.id, event.target.value)}
            />
          </div>
          <div className="unit-designer__selected">
            <h4 className="heading-4">Equipped Modules</h4>
            {selectedDetails.length === 0 ? (
              <p className="body-sm text-muted">No modules equipped yet.</p>
            ) : (
              <ul className="unit-designer__selected-list">
                {selectedDetails.map((module) => (
                  <li key={module.id} className="unit-designer__selected-item">
                    <div>
                      <div className="unit-designer__selected-name">{module.name}</div>
                      <div className="unit-designer__selected-meta">
                        {formatUnitModuleBonusValue(module.bonusType, module.bonusValue)} · Mana ×
                        {formatNumber(module.manaCostMultiplier, { maximumFractionDigits: 2 })} · +
                        {formatNumber(module.sanityCost, { maximumFractionDigits: 0 })} sanity
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button button--text"
                      onClick={() => handleRemoveModule(selectedUnit.id, module.id, selectedModuleIds)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="unit-designer__available">
            <h4 className="heading-4">Available Modules</h4>
            <div className="unit-designer__available-grid">
              {state.availableModules.map((module) => {
                const isLocked = module.level <= 0;
                const isSelected = selectedModuleIds.includes(module.id);
                const disabled = isLocked || isSelected || isAtModuleCap;
                return (
                  <article key={module.id} className="unit-designer__available-card surface-panel stack-sm">
                    <div className="unit-designer__available-header">
                      <div>
                        <h5 className="heading-5">{module.name}</h5>
                        <p className="body-xs text-muted">
                          {module.level > 0 ? `Level ${module.level}` : "Locked"}
                        </p>
                      </div>
                      <span className="unit-designer__available-bonus">
                        {formatUnitModuleBonusValue(module.bonusType, module.bonusValue)}
                      </span>
                    </div>
                    <p className="body-sm text-muted">{module.description}</p>
                    <div className="unit-designer__available-meta body-xs text-muted">
                      Mana ×{formatNumber(module.manaCostMultiplier, { maximumFractionDigits: 2 })} · +
                      {formatNumber(module.sanityCost, { maximumFractionDigits: 0 })} sanity
                    </div>
                    <button
                      type="button"
                      className="button button--secondary"
                      disabled={disabled}
                      onClick={() => handleAddModule(selectedUnit.id, module.id, selectedModuleIds)}
                    >
                      {isLocked ? "Locked" : isSelected ? "Equipped" : isAtModuleCap ? "Max slots" : "Add"}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
        <aside className="unit-designer__summary">
          <h4 className="heading-4">Summary</h4>
          <div className="unit-designer__cost">
            <h5 className="heading-5">Summoning Cost</h5>
            <ResourceCostDisplay cost={selectedUnit.cost} missing={missingCost} />
          </div>
          <div className="unit-designer__stats">
            <h5 className="heading-5">Stats</h5>
            <dl>
              {statEntries.map((entry) => (
                <div key={entry.label} className="unit-designer__stat">
                  <dt>{entry.label}</dt>
                  <dd>
                    <span>{entry.value}</span>
                    {entry.hint ? <span className="unit-designer__stat-hint">{entry.hint}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
};
