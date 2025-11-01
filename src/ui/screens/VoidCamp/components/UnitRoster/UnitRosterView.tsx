import { useCallback, useEffect, useMemo, useState } from "react";
import { classNames } from "@shared/classNames";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import {
  UnitDesignerBridgeState,
  UnitDesignerUnitState,
} from "@logic/modules/camp/UnitDesignModule";
import { Button } from "@shared/Button";
import { UnitAutomationBridgeState } from "@logic/modules/active-map/UnitAutomationModule";
import { UnitTargetingMode } from "@/types/unit-targeting";
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

const TARGETING_OPTIONS: ReadonlyArray<{
  mode: UnitTargetingMode;
  label: string;
  description: string;
}> = [
  {
    mode: "nearest",
    label: "Nearest target",
    description: "Engage the closest brick within reach.",
  },
  {
    mode: "highestHp",
    label: "Highest HP",
    description: "Prioritise nearby enemies with the most health.",
  },
  {
    mode: "lowestHp",
    label: "Lowest HP",
    description: "Finish off weakened enemies first within range.",
  },
  {
    mode: "highestDamage",
    label: "Highest damage",
    description: "Seek nearby threats that deal the most damage.",
  },
  {
    mode: "lowestDamage",
    label: "Lowest damage",
    description: "Pick safer targets that hit the weakest nearby.",
  },
  {
    mode: "none",
    label: "Standby (no attacks)",
    description: "Do not attack; wander near the spawn point.",
  },
];

const DEFAULT_TARGETING_MODE: UnitTargetingMode = TARGETING_OPTIONS[0]!.mode;

export const UnitRosterView: React.FC<UnitRosterViewProps> = ({ state, automation }) => {
  const { app } = useAppLogic();
  const designer = useMemo(() => app.getUnitDesigner(), [app]);
  const automationModule = useMemo(() => app.getUnitAutomation(), [app]);

  const roster = state.activeRoster;
  const maxSlots = state.maxActiveUnits;
  const targetingByUnit = state.targetingByUnit ?? {};
  const targetingLookup = useMemo(() => {
    const map = new Map<UnitTargetingMode, (typeof TARGETING_OPTIONS)[number]>();
    TARGETING_OPTIONS.forEach((option) => {
      map.set(option.mode, option);
    });
    return map;
  }, []);

  const unitsById = useMemo(() => buildUnitMap(state.units), [state.units]);
  const rosterUnits = useMemo(
    () => roster.map((id) => unitsById.get(id) ?? null),
    [roster, unitsById]
  );
  const rosterFull = roster.length >= maxSlots;
  const automationLookup = useMemo(() => {
    const lookup = new Map<
      string,
      {
        enabled: boolean;
        weight: number;
      }
    >();
    automation.units.forEach((entry) => {
      lookup.set(entry.designId, { enabled: entry.enabled, weight: entry.weight });
    });
    return lookup;
  }, [automation.units]);

  const resolveTargetingMode = useCallback(
    (designId: string): UnitTargetingMode => targetingByUnit[designId]?.mode ?? DEFAULT_TARGETING_MODE,
    [targetingByUnit]
  );

  const [editingStrategyDesignId, setEditingStrategyDesignId] = useState<string | null>(null);
  const [draftMode, setDraftMode] = useState<UnitTargetingMode>(DEFAULT_TARGETING_MODE);

  useEffect(() => {
    if (!editingStrategyDesignId) {
      return;
    }
    setDraftMode(resolveTargetingMode(editingStrategyDesignId));
  }, [editingStrategyDesignId, resolveTargetingMode]);

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

  const handleAutomationWeightChange = useCallback(
    (unitId: string, weight: number) => {
      automationModule.setAutomationWeight(unitId, weight);
    },
    [automationModule]
  );

  const openStrategySettings = useCallback(
    (designId: string) => {
      setEditingStrategyDesignId(designId);
      setDraftMode(resolveTargetingMode(designId));
    },
    [resolveTargetingMode]
  );

  const handleCancelStrategy = useCallback(() => {
    setEditingStrategyDesignId(null);
  }, []);

  const handleConfirmStrategy = useCallback(() => {
    if (!editingStrategyDesignId) {
      return;
    }
    const currentMode = resolveTargetingMode(editingStrategyDesignId);
    if (draftMode !== currentMode) {
      designer.setDesignTargetingMode(editingStrategyDesignId, draftMode);
    }
    setEditingStrategyDesignId(null);
  }, [designer, draftMode, editingStrategyDesignId, resolveTargetingMode]);

  const handleSelectStrategy = useCallback((mode: UnitTargetingMode) => {
    setDraftMode(mode);
  }, []);

  const isStrategyOpen = editingStrategyDesignId !== null;
  const editingUnit = useMemo(
    () => (editingStrategyDesignId ? unitsById.get(editingStrategyDesignId) ?? null : null),
    [editingStrategyDesignId, unitsById]
  );
  const draftOption = targetingLookup.get(draftMode) ?? TARGETING_OPTIONS[0]!;

  return (
    <div className="unit-roster stack-lg">
      <header className="unit-roster__header">
        <div>
          <p className="body-md text-muted">
            Select up to {maxSlots} units to deploy and reorder them to prioritise
            deployment.
          </p>
        </div>
        <button
          type="button"
          className={classNames("danger-button", "button")}
          onClick={handleClearRoster}
          disabled={roster.length === 0}
        >
          Clear roster
        </button>
      </header>
      <div className="unit-roster__content">
        <section className="unit-roster__slots">
          <ol className="unit-roster__slot-list">
            {Array.from({ length: maxSlots }).map((_, index) => {
              const unit = rosterUnits[index] ?? null;
              const currentMode = unit ? resolveTargetingMode(unit.id) : DEFAULT_TARGETING_MODE;
              const currentOption = targetingLookup.get(currentMode) ?? TARGETING_OPTIONS[0]!;
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
                        <div className="unit-roster__slot-header">
                          <span className="unit-roster__slot-name">{unit.name}</span>
                          <button
                            type="button"
                            className={classNames(
                              "primary-button",
                              "small-button",
                              "button"
                            )}
                            onClick={() => openStrategySettings(unit.id)}
                            aria-haspopup="dialog"
                            aria-expanded={
                              isStrategyOpen && editingStrategyDesignId === unit.id
                            }
                          >
                            <span>Strategy: {currentOption.label}</span>
                          </button>
                        </div>
                        <span className="unit-roster__slot-meta">
                          {unit.modules.length} modules
                        </span>
                      </div>
                      <div className="unit-roster__slot-actions">
                        <div className="unit-roster__slot-controls">
                          <button
                            type="button"
                            className={classNames(
                              "secondary-button",
                              "small-button",
                              "button"
                            )}
                            onClick={() => handleMove(index, -1)}
                            disabled={index === 0}
                            aria-label={`Move ${unit.name} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className={classNames(
                              "secondary-button",
                              "small-button",
                              "button"
                            )}
                            onClick={() => handleMove(index, 1)}
                            disabled={index >= roster.length - 1}
                            aria-label={`Move ${unit.name} down`}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className={classNames(
                              "danger-button",
                              "small-button",
                              "button"
                            )}
                            onClick={() => handleClearSlot(index)}
                          >
                            Remove
                          </button>
                        </div>
                        {automation.unlocked ? (
                          <div className="unit-roster__automation-controls">
                            <label className="unit-roster__automation-toggle">
                              <input
                                type="checkbox"
                                checked={automationLookup.get(unit.id)?.enabled ?? false}
                                onChange={(event) =>
                                  handleToggleAutomation(unit.id, event.target.checked)
                                }
                              />
                              Automate
                            </label>
                            <label className="unit-roster__automation-weight">
                              <span>Weight</span>
                              <input
                                type="number"
                                min={1}
                                value={automationLookup.get(unit.id)?.weight ?? 1}
                                onChange={(event) => {
                                  const nextValue = Number.parseInt(event.target.value, 10);
                                  handleAutomationWeightChange(
                                    unit.id,
                                    Number.isNaN(nextValue) ? 1 : nextValue
                                  );
                                }}
                              />
                            </label>
                          </div>
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
                        className={classNames(
                          isActive ? "danger-button" : "primary-button",
                          "small-button",
                          "button"
                        )}
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
      {isStrategyOpen ? (
        <div className="unit-roster__strategy-layer" role="presentation">
          <div
            className="unit-roster__strategy-backdrop"
            onClick={handleCancelStrategy}
            role="presentation"
          />
          <div
            className="unit-roster__strategy-dialog surface-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unit-roster-strategy-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="unit-roster__strategy-header">
              <h3 id="unit-roster-strategy-title">Strategy settings</h3>
              <p className="unit-roster__strategy-description">
                {editingUnit ? (
                  <>
                    Choose how <strong>{editingUnit.name}</strong> prioritises its
                    targets during combat. Current selection:
                    <span className="unit-roster__strategy-current">
                      {draftOption.label}
                    </span>
                  </>
                ) : (
                  "Choose how deployed units prioritise their targets during combat."
                )}
              </p>
            </div>
            <div className="unit-roster__strategy-options">
              {TARGETING_OPTIONS.map((option) => {
                const active = draftMode === option.mode;
                return (
                  <label
                    key={option.mode}
                    className={classNames(
                      "unit-roster__strategy-option",
                      active && "unit-roster__strategy-option--active"
                    )}
                  >
                    <input
                      type="radio"
                      name="unit-roster-strategy"
                      value={option.mode}
                      checked={active}
                      onChange={() => handleSelectStrategy(option.mode)}
                    />
                    <div className="unit-roster__strategy-option-content">
                      <span className="unit-roster__strategy-option-label">
                        {option.label}
                      </span>
                      <span className="unit-roster__strategy-option-description">
                        {option.description}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="unit-roster__strategy-actions">
              <button
                type="button"
                className="unit-roster__strategy-cancel"
                onClick={handleCancelStrategy}
              >
                Cancel
              </button>
              <Button onClick={handleConfirmStrategy}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
