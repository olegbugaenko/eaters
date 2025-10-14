import { useCallback, useEffect, useMemo, useState } from "react";
import { classNames } from "@shared/classNames";
import { ResourceCostDisplay } from "@shared/ResourceCostDisplay";
import { ResourceAmountPayload } from "@logic/modules/ResourcesModule";
import {
  UnitDesignerBridgeState,
  UnitDesignerUnitState,
} from "@logic/modules/UnitDesignModule";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { formatUnitModuleBonusValue } from "@shared/format/unitModuleBonus";
import { buildUnitStatEntries } from "@shared/unitStats";
import { PlayerUnitType } from "@db/player-units-db";
import { formatNumber } from "@shared/format/number";
import { UnitModuleId } from "@db/unit-modules-db";
import { Button } from "@shared/Button";
import { ModuleDetailsCard } from "@shared/ModuleDetailsCard";
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
  const [preview, setPreview] = useState<{
    id: UnitModuleId;
    origin: "available" | "equipped";
  } | null>(null);

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

  useEffect(() => {
    setPreview(null);
  }, [selectedUnit?.id]);

  const roster = state.activeRoster;
  const rosterSet = useMemo(() => new Set(roster), [roster]);
  const rosterUnits = useMemo(
    () =>
      roster
        .map((id) => state.units.find((unit) => unit.id === id) ?? null)
        .filter((unit): unit is UnitDesignerUnitState => Boolean(unit)),
    [roster, state.units]
  );
  const rosterFull = roster.length >= state.maxActiveUnits;

  const missingCost = useMemo(
    () => (selectedUnit ? computeMissing(selectedUnit.cost, totals) : { mana: 0, sanity: 0 }),
    [selectedUnit, totals]
  );

  const handleSelectUnit = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleToggleActive = useCallback(
    (id: string) => {
      const isActive = roster.includes(id);
      if (isActive) {
        designer.setActiveRoster(roster.filter((entry) => entry !== id));
        return;
      }
      if (roster.length >= state.maxActiveUnits) {
        return;
      }
      designer.setActiveRoster([...roster, id]);
    },
    [designer, roster, state.maxActiveUnits]
  );

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
          <Button onClick={handleCreateUnit}>New Unit</Button>
        </header>
        <p className="body-md text-muted">No units available yet.</p>
      </div>
    );
  }

  const selectedModuleIds = selectedUnit.modules;
  const selectedDetails = selectedUnit.moduleDetails;
  const availableModules = useMemo(
    () => state.availableModules.filter((module) => module.level > 0),
    [state.availableModules]
  );
  const previewModule = useMemo(() => {
    if (!preview) {
      return null;
    }
    const collection = preview.origin === "available" ? availableModules : selectedDetails;
    return collection.find((module) => module.id === preview.id) ?? null;
  }, [preview, availableModules, selectedDetails]);

  useEffect(() => {
    if (preview && !previewModule) {
      setPreview(null);
    }
  }, [preview, previewModule]);
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
      </header>
      <div className="unit-designer__content">
        <aside className="unit-designer__list">
          <div className="unit-designer__list-header">
            <h3 className="heading-4">Units</h3>
            <Button onClick={handleCreateUnit}>New Unit</Button>
          </div>
          <ul className="unit-designer__list-items">
            {state.units.map((unit) => {
              const isActive = unit.id === selectedUnit.id;
              const isRostered = rosterSet.has(unit.id);
              const listItemClassName = classNames(
                "unit-designer__list-item",
                isActive && "unit-designer__list-item--active",
                isRostered && "unit-designer__list-item--roster"
              );
              const rosterButtonClassName = classNames(
                "unit-designer__roster-toggle",
                isRostered && "unit-designer__roster-toggle--active"
              );
              const rosterLabel = isRostered
                ? "Active"
                : rosterFull
                ? "Roster full"
                : "Add to roster";
              return (
                <li key={unit.id} className="unit-designer__list-entry">
                  <div className="unit-designer__list-row">
                    <button
                      type="button"
                      className={listItemClassName}
                      onClick={() => handleSelectUnit(unit.id)}
                    >
                      <div className="unit-designer__list-text">
                        <span className="unit-designer__list-name">{unit.name}</span>
                        <span className="unit-designer__list-modules">{unit.modules.length} modules</span>
                      </div>
                      {isRostered ? <span className="unit-designer__list-badge">Active</span> : null}
                    </button>
                    <div className="unit-designer__list-actions">
                      <button
                        type="button"
                        className={rosterButtonClassName}
                        onClick={() => handleToggleActive(unit.id)}
                        disabled={!isRostered && rosterFull}
                      >
                        {rosterLabel}
                      </button>
                      <button
                        type="button"
                        className="unit-designer__text-button unit-designer__delete"
                        onClick={() => handleDeleteUnit(unit.id)}
                        aria-label={`Delete ${unit.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
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
                  <li
                    key={module.id}
                    className="unit-designer__selected-item"
                    onMouseEnter={() => setPreview({ id: module.id, origin: "equipped" })}
                    onMouseLeave={() => setPreview(null)}
                    onFocus={() => setPreview({ id: module.id, origin: "equipped" })}
                    onBlur={(event) => {
                      const next = event.relatedTarget as Node | null;
                      if (!next || !event.currentTarget.contains(next)) {
                        setPreview(null);
                      }
                    }}
                  >
                    <div>
                      <div className="unit-designer__selected-name">{module.name}</div>
                      {/*<div className="unit-designer__selected-meta">
                        {formatUnitModuleBonusValue(module.bonusType, module.bonusValue)} · Mana ×
                        {formatNumber(module.manaCostMultiplier, { maximumFractionDigits: 2 })} · +
                        {formatNumber(module.sanityCost, { maximumFractionDigits: 0 })} sanity
                      </div>*/}
                    </div>
                    <button
                      type="button"
                      className="unit-designer__text-button"
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
            <div className="unit-designer__available-scroll">
              {availableModules.length === 0 ? (
                <p className="body-sm text-muted">Fabricate modules to equip them here.</p>
              ) : (
                <ul className="unit-designer__available-list">
                  {availableModules.map((module) => {
                    const isSelected = selectedModuleIds.includes(module.id);
                    const disabled = isSelected || isAtModuleCap;
                    const label = isSelected ? "Equipped" : isAtModuleCap ? "Max slots" : "Add";
                    return (
                      <li
                        key={module.id}
                        className="unit-designer__available-item"
                        onMouseEnter={() => setPreview({ id: module.id, origin: "available" })}
                        onMouseLeave={() => setPreview(null)}
                        onFocus={() => setPreview({ id: module.id, origin: "available" })}
                        onBlur={(event) => {
                          const next = event.relatedTarget as Node | null;
                          if (!next || !event.currentTarget.contains(next)) {
                            setPreview(null);
                          }
                        }}
                      >
                        <button type="button" className="unit-designer__available-info">
                          <span className="unit-designer__available-name">{module.name}</span>
                          <span className="unit-designer__available-level">Lv {module.level}</span>
                        </button>
                        <button
                          type="button"
                          className="unit-designer__available-action"
                          disabled={disabled}
                          onClick={() => handleAddModule(selectedUnit.id, module.id, selectedModuleIds)}
                        >
                          {label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
        <aside className="unit-designer__summary surface-sidebar">
          <div className="unit-designer__summary-scroll">
            <section className="unit-designer__roster-summary">
              <h5 className="heading-5">Battle Roster</h5>
              <p className="body-sm text-muted">
                Select up to {state.maxActiveUnits} units to deploy on maps.
              </p>
              <ul className="unit-designer__roster-list">
                {Array.from({ length: state.maxActiveUnits }).map((_, index) => {
                  const unit = rosterUnits[index] ?? null;
                  return (
                    <li
                      key={`roster-${index}`}
                      className={classNames(
                        "unit-designer__roster-slot",
                        unit && "unit-designer__roster-slot--filled"
                      )}
                    >
                      <span className="unit-designer__roster-slot-index">{index + 1}</span>
                      {unit ? (
                        <div className="unit-designer__roster-slot-content">
                          <span className="unit-designer__roster-slot-name">{unit.name}</span>
                          <span className="unit-designer__roster-slot-meta">
                            {unit.modules.length} modules
                          </span>
                        </div>
                      ) : (
                        <span className="unit-designer__roster-slot-empty">Empty slot</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
            <div className="unit-designer__module-preview">
              {previewModule ? (
                <ModuleDetailsCard
                  className="unit-designer__module-card"
                  name={previewModule.name}
                  level={previewModule.level}
                  description={previewModule.description}
                  effectLabel={previewModule.bonusLabel}
                  currentEffect={formatUnitModuleBonusValue(
                    previewModule.bonusType,
                    previewModule.bonusValue
                  )}
                  manaMultiplier={previewModule.manaCostMultiplier}
                  sanityCost={previewModule.sanityCost}
                />
              ) : null}
            </div>
            <section className="unit-designer__cost">
              <h5 className="heading-5">Summoning Cost</h5>
              <ResourceCostDisplay cost={selectedUnit.cost} missing={missingCost} />
            </section>
            <section className="unit-designer__stats">
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
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
};
