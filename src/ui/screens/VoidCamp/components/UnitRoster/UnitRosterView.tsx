import { useCallback, useEffect, useMemo, useState } from "react";
import { classNames } from "@ui-shared/classNames";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import {
  UnitDesignerBridgeState,
  UnitDesignerUnitState,
} from "@logic/modules/camp/unit-design/unit-design.types";
import type { UnitDesignModuleUiApi } from "@logic/modules/camp/unit-design/unit-design.types";
import { Button } from "@ui-shared/Button";
import { HintTooltip } from "@ui-shared/HintTooltip";
import { useLocalization } from "@ui/shared/useLocalization";
import { UnitAutomationBridgeState } from "@logic/modules/active-map/unit-automation/unit-automation.types";
import { UnitTargetingMode } from "@shared/types/unit-targeting";
import "./UnitRosterView.css";
import type { UnitAutomationModuleUiApi } from "@logic/modules/active-map/unit-automation/unit-automation.types";

interface UnitRosterViewProps {
  state: UnitDesignerBridgeState;
  automation: UnitAutomationBridgeState;
  hasEnemyStrategies: boolean;
  maxUnitsOnMap: number;
}

const buildUnitMap = (
  units: readonly UnitDesignerUnitState[],
): Map<string, UnitDesignerUnitState> => {
  const map = new Map<string, UnitDesignerUnitState>();
  units.forEach((unit) => {
    map.set(unit.id, unit);
  });
  return map;
};

const TARGETING_MODE_DEFS: ReadonlyArray<{
  mode: UnitTargetingMode;
  labelKey: string;
  labelFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
}> = [
  {
    mode: "nearest",
    labelKey: "voidCamp.unitRoster.targeting.nearest.label",
    labelFallback: "Nearest target",
    descriptionKey: "voidCamp.unitRoster.targeting.nearest.desc",
    descriptionFallback: "Engage the closest target within reach.",
  },
  {
    mode: "firstBrick",
    labelKey: "voidCamp.unitRoster.targeting.firstBrick.label",
    labelFallback: "Brick first",
    descriptionKey: "voidCamp.unitRoster.targeting.firstBrick.desc",
    descriptionFallback: "Prioritise the nearest brick before enemies.",
  },
  {
    mode: "firstEnemy",
    labelKey: "voidCamp.unitRoster.targeting.firstEnemy.label",
    labelFallback: "Enemy first",
    descriptionKey: "voidCamp.unitRoster.targeting.firstEnemy.desc",
    descriptionFallback: "Prioritise the nearest enemy before bricks.",
  },
  {
    mode: "highestHp",
    labelKey: "voidCamp.unitRoster.targeting.highestHp.label",
    labelFallback: "Highest HP",
    descriptionKey: "voidCamp.unitRoster.targeting.highestHp.desc",
    descriptionFallback: "Prioritise nearby enemies with the most health.",
  },
  {
    mode: "lowestHp",
    labelKey: "voidCamp.unitRoster.targeting.lowestHp.label",
    labelFallback: "Lowest HP",
    descriptionKey: "voidCamp.unitRoster.targeting.lowestHp.desc",
    descriptionFallback: "Finish off weakened enemies first within range.",
  },
  {
    mode: "highestDamage",
    labelKey: "voidCamp.unitRoster.targeting.highestDamage.label",
    labelFallback: "Highest damage",
    descriptionKey: "voidCamp.unitRoster.targeting.highestDamage.desc",
    descriptionFallback: "Seek nearby threats that deal the most damage.",
  },
  {
    mode: "lowestDamage",
    labelKey: "voidCamp.unitRoster.targeting.lowestDamage.label",
    labelFallback: "Lowest damage",
    descriptionKey: "voidCamp.unitRoster.targeting.lowestDamage.desc",
    descriptionFallback: "Pick safer targets that hit the weakest nearby.",
  },
  {
    mode: "none",
    labelKey: "voidCamp.unitRoster.targeting.none.label",
    labelFallback: "Standby (no attacks)",
    descriptionKey: "voidCamp.unitRoster.targeting.none.desc",
    descriptionFallback: "Do not attack; wander near the spawn point.",
  },
];

const DEFAULT_TARGETING_MODE: UnitTargetingMode = "nearest";

const buildTargetingOptions = (hasEnemyStrategies: boolean) =>
  hasEnemyStrategies
    ? TARGETING_MODE_DEFS
    : TARGETING_MODE_DEFS.filter(
        (option) =>
          option.mode !== "firstBrick" && option.mode !== "firstEnemy",
      );

export const UnitRosterView: React.FC<UnitRosterViewProps> = ({
  state,
  automation,
  hasEnemyStrategies,
  maxUnitsOnMap,
}) => {
  const { uiApi } = useAppLogic();
  const { t } = useLocalization();
  const designer = uiApi.unitDesign as UnitDesignModuleUiApi;
  const automationModule = uiApi.unitAutomation as UnitAutomationModuleUiApi;

  const roster = state.activeRoster;
  const maxSlots = state.maxActiveUnits;
  const targetingByUnit = state.targetingByUnit ?? {};
  const targetingOptions = useMemo(
    () => buildTargetingOptions(hasEnemyStrategies),
    [hasEnemyStrategies],
  );
  const targetingLookup = useMemo(() => {
    const map = new Map<UnitTargetingMode, (typeof targetingOptions)[number]>();
    targetingOptions.forEach((option) => {
      map.set(option.mode, option);
    });
    return map;
  }, [targetingOptions]);

  const unitsById = useMemo(() => buildUnitMap(state.units), [state.units]);
  const rosterUnits = useMemo(
    () => roster.map((id) => unitsById.get(id) ?? null),
    [roster, unitsById],
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
      lookup.set(entry.designId, {
        enabled: entry.enabled,
        weight: entry.weight,
      });
    });
    return lookup;
  }, [automation.units]);

  const resolveTargetingMode = useCallback(
    (designId: string): UnitTargetingMode =>
      targetingByUnit[designId]?.mode ?? DEFAULT_TARGETING_MODE,
    [targetingByUnit],
  );

  const [editingStrategyDesignId, setEditingStrategyDesignId] = useState<
    string | null
  >(null);
  const [draftMode, setDraftMode] = useState<UnitTargetingMode>(
    DEFAULT_TARGETING_MODE,
  );

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
    [designer, roster, rosterFull],
  );

  const handleRemoveFromRoster = useCallback(
    (unitId: string) => {
      if (!roster.includes(unitId)) {
        return;
      }
      designer.setActiveRoster(roster.filter((entry) => entry !== unitId));
    },
    [designer, roster],
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
    [designer, roster],
  );

  const handleClearSlot = useCallback(
    (index: number) => {
      if (!roster[index]) {
        return;
      }
      const next = roster.filter((_, entryIndex) => entryIndex !== index);
      designer.setActiveRoster(next);
    },
    [designer, roster],
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
    [automationModule],
  );

  const handleAutomationWeightChange = useCallback(
    (unitId: string, weight: number) => {
      automationModule.setAutomationWeight(unitId, weight);
    },
    [automationModule],
  );

  const totalEnabledWeight = useMemo(() => {
    let total = 0;
    roster.forEach((id) => {
      if (automationLookup.get(id)?.enabled) {
        total += automationLookup.get(id)?.weight ?? 1;
      }
    });
    return total;
  }, [roster, automationLookup]);

  const getShareLabel = useCallback(
    (unitId: string): string | null => {
      const entry = automationLookup.get(unitId);
      if (!entry?.enabled || totalEnabledWeight <= 0) return null;
      const enabledCount = roster.filter(
        (id) => automationLookup.get(id)?.enabled,
      ).length;
      if (enabledCount < 2) return null;
      const approxCount = Math.round((entry.weight / totalEnabledWeight) * maxUnitsOnMap);
      return `≈${approxCount}/${maxUnitsOnMap}`;
    },
    [automationLookup, totalEnabledWeight, roster, maxUnitsOnMap],
  );

  const getShareTooltip = useCallback(
    (unitId: string): string => {
      const entry = automationLookup.get(unitId);
      if (!entry?.enabled || totalEnabledWeight <= 0) {
        return t("voidCamp.unitRoster.shareHint", "Share of this unit type in the auto-spawned army");
      }
      const percent = entry.weight / totalEnabledWeight;
      const approxCount = Math.round(percent * maxUnitsOnMap);
      return t(
        "voidCamp.unitRoster.shareTooltip",
        "approximately {{count}} out of {{max}} maximum units",
      )
        .replace("{{count}}", String(approxCount))
        .replace("{{max}}", String(maxUnitsOnMap));
    },
    [automationLookup, totalEnabledWeight, maxUnitsOnMap, t],
  );

  const handleWeightStep = useCallback(
    (unitId: string, delta: 1 | -1) => {
      const current = automationLookup.get(unitId)?.weight ?? 1;
      handleAutomationWeightChange(unitId, Math.max(1, current + delta));
    },
    [automationLookup, handleAutomationWeightChange],
  );

  const openStrategySettings = useCallback(
    (designId: string) => {
      setEditingStrategyDesignId(designId);
      setDraftMode(resolveTargetingMode(designId));
    },
    [resolveTargetingMode],
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
    () =>
      editingStrategyDesignId
        ? (unitsById.get(editingStrategyDesignId) ?? null)
        : null,
    [editingStrategyDesignId, unitsById],
  );
  const draftOption = targetingLookup.get(draftMode) ?? targetingOptions[0]!;

  return (
    <div className="unit-roster stack-lg">
      <header className="unit-roster__header">
        <div>
          <p className="body-md text-muted">
            {t(
              "voidCamp.unitRoster.subtitle",
              "Select up to {{maxSlots}} units to deploy and reorder them to prioritise deployment.",
            ).replace("{{maxSlots}}", String(maxSlots))}
          </p>
        </div>
        <button
          type="button"
          className={classNames("danger-button", "button")}
          onClick={handleClearRoster}
          disabled={roster.length === 0}
        >
          {t("voidCamp.unitRoster.clearRoster", "Clear roster")}
        </button>
      </header>
      <div className="unit-roster__content">
        <section className="unit-roster__slots">
          <ol className="unit-roster__slot-list">
            {Array.from({ length: maxSlots }).map((_, index) => {
              const unit = rosterUnits[index] ?? null;
              const currentMode = unit
                ? resolveTargetingMode(unit.id)
                : DEFAULT_TARGETING_MODE;
              const currentOption =
                targetingLookup.get(currentMode) ?? targetingOptions[0]!;
              return (
                <li
                  key={`roster-slot-${index}`}
                  className={classNames(
                    "unit-roster__slot",
                    unit && "unit-roster__slot--filled",
                  )}
                >
                  <span className="unit-roster__slot-index">{index + 1}</span>
                  {unit ? (
                    <div className="unit-roster__slot-body">
                      <div className="unit-roster__slot-info">
                        <div className="unit-roster__slot-header">
                          <span className="unit-roster__slot-name">
                            {unit.name}
                          </span>
                          <button
                            type="button"
                            className={classNames(
                              "primary-button",
                              "small-button",
                              "button",
                            )}
                            onClick={() => openStrategySettings(unit.id)}
                            aria-haspopup="dialog"
                            aria-expanded={
                              isStrategyOpen &&
                              editingStrategyDesignId === unit.id
                            }
                          >
                            <span>
                              {t(
                                "voidCamp.unitRoster.strategyPrefix",
                                "Strategy",
                              )}
                              :{" "}
                              {t(
                                currentOption.labelKey,
                                currentOption.labelFallback,
                              )}
                            </span>
                          </button>
                        </div>
                        <span className="unit-roster__slot-meta">
                          {unit.modules.length}{" "}
                          {t("voidCamp.unitRoster.modules", "modules")}
                        </span>
                      </div>
                      <div className="unit-roster__slot-actions">
                        <div className="unit-roster__slot-controls">
                          <button
                            type="button"
                            className={classNames(
                              "secondary-button",
                              "small-button",
                              "button",
                              "square",
                              "lg-font",
                            )}
                            onClick={() => handleMove(index, -1)}
                            disabled={index === 0}
                            aria-label={`${t("voidCamp.unitRoster.move", "Move")} ${unit.name} ${t("voidCamp.unitRoster.up", "up")}`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className={classNames(
                              "secondary-button",
                              "small-button",
                              "button",
                              "square",
                              "lg-font",
                            )}
                            onClick={() => handleMove(index, 1)}
                            disabled={index >= roster.length - 1}
                            aria-label={`${t("voidCamp.unitRoster.move", "Move")} ${unit.name} ${t("voidCamp.unitRoster.down", "down")}`}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className={classNames(
                              "danger-button",
                              "small-button",
                              "button",
                            )}
                            onClick={() => handleClearSlot(index)}
                          >
                            {t("voidCamp.unitRoster.remove", "Remove")}
                          </button>
                        </div>
                        {automation.unlocked ? (
                          <div className="unit-roster__automation-controls">
                            <label className="unit-roster__automation-toggle">
                              <input
                                type="checkbox"
                                checked={
                                  automationLookup.get(unit.id)?.enabled ??
                                  false
                                }
                                onChange={(event) =>
                                  handleToggleAutomation(
                                    unit.id,
                                    event.target.checked,
                                  )
                                }
                              />
                              {t("scene.summoning.automate", "Automate")}
                            </label>
                            <div
                              className="unit-roster__automation-weight"
                            >
                              <span className="unit-roster__automation-weight-label">
                                {t("voidCamp.unitRoster.weight", "Share")}
                              </span>
                              <div className="unit-roster__weight-stepper">
                                <button
                                  type="button"
                                  className="unit-roster__weight-step"
                                  onClick={() => handleWeightStep(unit.id, -1)}
                                  disabled={
                                    (automationLookup.get(unit.id)?.weight ??
                                      1) <= 1
                                  }
                                  aria-label="Decrease share"
                                >
                                  −
                                </button>
                                <span className="unit-roster__weight-value">
                                  {automationLookup.get(unit.id)?.weight ?? 1}
                                </span>
                                <button
                                  type="button"
                                  className="unit-roster__weight-step"
                                  onClick={() => handleWeightStep(unit.id, 1)}
                                  aria-label="Increase share"
                                >
                                  +
                                </button>
                              </div>
                              {getShareLabel(unit.id) !== null && (
                                <span className="unit-roster__weight-percent">
                                  {getShareLabel(unit.id)}
                                  <HintTooltip
                                    text={getShareTooltip(unit.id)}
                                    ariaLabel={t("voidCamp.unitRoster.shareHint", "Share of this unit type in the auto-spawned army")}
                                  />
                                </span>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="unit-roster__slot-empty">
                      {t("voidCamp.unitRoster.emptySlot", "Empty slot")}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
        <section className="unit-roster__available">
          <div className="unit-roster__available-header">
            <h3 className="heading-4">
              {t("voidCamp.unitRoster.availableUnits", "Available Units")}
            </h3>
            <p className="body-sm text-muted">
              {t(
                "voidCamp.unitRoster.availableHint",
                "Build designs in the Unit Designer, then add them to your battle roster here.",
              )}
            </p>
          </div>
          <ul className="unit-roster__list">
            {state.units.length === 0 ? (
              <li className="unit-roster__empty">
                {t("voidCamp.unitRoster.noUnits", "No units designed yet.")}
              </li>
            ) : (
              state.units.map((unit) => {
                const isActive = roster.includes(unit.id);
                const slotIndex = roster.indexOf(unit.id);
                const buttonLabel = isActive
                  ? t("voidCamp.unitRoster.remove", "Remove")
                  : rosterFull
                    ? t("voidCamp.unitRoster.rosterFull", "Roster full")
                    : t("voidCamp.unitRoster.addToRoster", "Add to roster");
                return (
                  <li
                    key={unit.id}
                    className={classNames(
                      "unit-roster__list-item",
                      isActive && "unit-roster__list-item--active",
                    )}
                  >
                    <div className="unit-roster__list-info">
                      <span className="unit-roster__list-name">
                        {unit.name}
                      </span>
                      <span className="unit-roster__list-meta">
                        {unit.modules.length}{" "}
                        {t("voidCamp.unitRoster.modules", "modules")}
                      </span>
                    </div>
                    <div className="unit-roster__list-actions">
                      {isActive ? (
                        <span className="unit-roster__list-badge">
                          {t("voidCamp.unitRoster.slot", "Slot")}{" "}
                          {slotIndex + 1}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className={classNames(
                          isActive ? "danger-button" : "primary-button",
                          "small-button",
                          "button",
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
              <h3 id="unit-roster-strategy-title">
                {t("voidCamp.unitRoster.strategy", "Strategy settings")}
              </h3>
              <p className="unit-roster__strategy-description">
                {editingUnit ? (
                  <>
                    {t("voidCamp.unitRoster.strategyHintForUnit", "Choose how")}{" "}
                    <strong>{editingUnit.name}</strong>{" "}
                    {t(
                      "voidCamp.unitRoster.strategyHintForUnitSuffix",
                      "prioritises its targets during combat. Current selection:",
                    )}
                    <span className="unit-roster__strategy-current">
                      {t(draftOption.labelKey, draftOption.labelFallback)}
                    </span>
                  </>
                ) : (
                  t(
                    "voidCamp.unitRoster.strategyHint",
                    "Choose how deployed units prioritise their targets during combat.",
                  )
                )}
              </p>
            </div>
            <div className="unit-roster__strategy-options">
              {targetingOptions.map((option) => {
                const active = draftMode === option.mode;
                return (
                  <label
                    key={option.mode}
                    className={classNames(
                      "unit-roster__strategy-option",
                      active && "unit-roster__strategy-option--active",
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
                        {t(option.labelKey, option.labelFallback)}
                      </span>
                      <span className="unit-roster__strategy-option-description">
                        {t(option.descriptionKey, option.descriptionFallback)}
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
                {t("settings.close", "Close")}
              </button>
              <Button onClick={handleConfirmStrategy}>
                {t("voidCamp.common.save", "Save")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
