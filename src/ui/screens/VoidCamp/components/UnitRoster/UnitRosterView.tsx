import { useCallback, useMemo } from "react";
import { classNames } from "@shared/classNames";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import {
  UnitDesignerBridgeState,
  UnitDesignerUnitState,
} from "@logic/modules/UnitDesignModule";
import { Button } from "@shared/Button";
import { UnitAutomationBridgeState } from "@logic/modules/UnitAutomationModule";
import "./UnitRosterView.css";

interface UnitRosterViewProps {
  state: UnitDesignerBridgeState;
  automation: UnitAutomationBridgeState;
}

const buildUnitMap = (
  units: readonly UnitDesignerUnitState[]
): Map<string, UnitDesignerUnitState> => {
  const map = new Map<string, UnitDesignerUnitState>();
  units.forEach((unit) => {
    map.set(unit.id, unit);
  });
  return map;
};

export const UnitRosterView: React.FC<UnitRosterViewProps> = ({ state, automation }) => {
  const { app } = useAppLogic();
  const designer = useMemo(() => app.getUnitDesigner(), [app]);
  const automationModule = useMemo(() => app.getUnitAutomation(), [app]);

  const roster = state.activeRoster;
  const maxSlots = state.maxActiveUnits;

  const unitsById = useMemo(() => buildUnitMap(state.units), [state.units]);
  const rosterUnits = useMemo(
    () => roster.map((id) => unitsById.get(id) ?? null),
    [roster, unitsById]
  );
  const rosterFull = roster.length >= maxSlots;
  const automationLookup = useMemo(() => {
    const lookup = new Map<string, boolean>();
    automation.units.forEach((entry) => {
      lookup.set(entry.designId, entry.enabled);
    });
    return lookup;
  }, [automation.units]);

  const handleAddToRoster = useCallback(
    (unitId: string) => {
      if (roster.includes(unitId) || rosterFull) {
        return;
      }
      designer.setActiveRoster([...roster, unitId]);
    },
    [designer, roster, rosterFull]
  );

  const handleRemoveFromRoster = useCallback(
    (unitId: string) => {
      if (!roster.includes(unitId)) {
        return;
      }
      designer.setActiveRoster(roster.filter((entry) => entry !== unitId));
    },
    [designer, roster]
  );

  const handleMove = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= roster.length) {
        return;
      }
      const next = [...roster];
      const [moved] = next.splice(index, 1);
      if (!moved) {
        return;
      }
      next.splice(target, 0, moved);
      designer.setActiveRoster(next);
    },
    [designer, roster]
  );

  const handleClearSlot = useCallback(
    (index: number) => {
      if (!roster[index]) {
        return;
      }
      const next = roster.filter((_, entryIndex) => entryIndex !== index);
      designer.setActiveRoster(next);
    },
    [designer, roster]
  );

  const handleClearRoster = useCallback(() => {
    if (roster.length === 0) {
      return;
    }
    designer.setActiveRoster([]);
  }, [designer, roster]);

  const handleToggleAutomation = useCallback(
    (unitId: string, enabled: boolean) => {
      automationModule.setAutomationEnabled(unitId, enabled);
    },
    [automationModule]
  );

  return (
    <div className="unit-roster surface-panel stack-lg">
      <header className="unit-roster__header">
        <div>
          <h2 className="heading-2">Battle Roster</h2>
          <p className="body-md text-muted">
            Select up to {maxSlots} units to deploy and reorder them to prioritise
            deployment.
          </p>
        </div>
        <Button onClick={handleClearRoster} disabled={roster.length === 0}>
          Clear roster
        </Button>
      </header>
      <div className="unit-roster__content">
        <section className="unit-roster__slots surface-sidebar">
          <h3 className="heading-4">Active Lineup</h3>
          <ol className="unit-roster__slot-list">
            {Array.from({ length: maxSlots }).map((_, index) => {
              const unit = rosterUnits[index] ?? null;
              return (
                <li
                  key={`roster-slot-${index}`}
                  className={classNames(
                    "unit-roster__slot",
                    unit && "unit-roster__slot--filled"
                  )}
                >
                  <span className="unit-roster__slot-index">{index + 1}</span>
                  {unit ? (
                    <div className="unit-roster__slot-body">
                      <div className="unit-roster__slot-info">
                        <span className="unit-roster__slot-name">{unit.name}</span>
                        <span className="unit-roster__slot-meta">
                          {unit.modules.length} modules
                        </span>
                      </div>
                      <div className="unit-roster__slot-actions">
                        <div className="unit-roster__slot-controls">
                          <button
                            type="button"
                            className="unit-roster__slot-button"
                            onClick={() => handleMove(index, -1)}
                            disabled={index === 0}
                            aria-label={`Move ${unit.name} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="unit-roster__slot-button"
                            onClick={() => handleMove(index, 1)}
                            disabled={index >= roster.length - 1}
                            aria-label={`Move ${unit.name} down`}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="unit-roster__slot-remove"
                            onClick={() => handleClearSlot(index)}
                          >
                            Remove
                          </button>
                        </div>
                        {automation.unlocked ? (
                          <label className="unit-roster__automation-toggle">
                            <input
                              type="checkbox"
                              checked={automationLookup.get(unit.id) ?? false}
                              onChange={(event) =>
                                handleToggleAutomation(unit.id, event.target.checked)
                              }
                            />
                            Automate
                          </label>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="unit-roster__slot-empty">Empty slot</div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
        <section className="unit-roster__available">
          <div className="unit-roster__available-header">
            <h3 className="heading-4">Available Units</h3>
            <p className="body-sm text-muted">
              Build designs in the Unit Designer, then add them to your battle roster
              here.
            </p>
          </div>
          <ul className="unit-roster__list">
            {state.units.length === 0 ? (
              <li className="unit-roster__empty">No units designed yet.</li>
            ) : (
              state.units.map((unit) => {
                const isActive = roster.includes(unit.id);
                const slotIndex = roster.indexOf(unit.id);
                const buttonLabel = isActive
                  ? "Remove"
                  : rosterFull
                  ? "Roster full"
                  : "Add to roster";
                return (
                  <li
                    key={unit.id}
                    className={classNames(
                      "unit-roster__list-item",
                      isActive && "unit-roster__list-item--active"
                    )}
                  >
                    <div className="unit-roster__list-info">
                      <span className="unit-roster__list-name">{unit.name}</span>
                      <span className="unit-roster__list-meta">
                        {unit.modules.length} modules
                      </span>
                    </div>
                    <div className="unit-roster__list-actions">
                      {isActive ? (
                        <span className="unit-roster__list-badge">Slot {slotIndex + 1}</span>
                      ) : null}
                      <button
                        type="button"
                        className="unit-roster__list-button"
                        onClick={() =>
                          isActive
                            ? handleRemoveFromRoster(unit.id)
                            : handleAddToRoster(unit.id)
                        }
                        disabled={!isActive && rosterFull}
                      >
                        {buttonLabel}
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </div>
    </div>
  );
};
