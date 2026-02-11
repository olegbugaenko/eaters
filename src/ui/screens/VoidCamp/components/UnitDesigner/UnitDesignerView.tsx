import { useCallback, useEffect, useMemo, useState } from "react";
import { classNames } from "@ui-shared/classNames";
import { ResourceCostDisplay } from "@ui-shared/ResourceCostDisplay";
import type { ResourceAmountPayload } from "@logic/modules/shared/resources/resources.types";
import { UnitDesignerBridgeState } from "@logic/modules/camp/unit-design/unit-design.types";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { formatUnitModuleBonusValue } from "@ui-shared/format/unitModuleBonus";
import { buildUnitStatEntries } from "@ui-shared/unitStats";
import { getPlayerUnitConfig, PlayerUnitType } from "@db/player-units-db";
import { UnitModuleId } from "@db/unit-modules-db";
import { Button } from "@ui-shared/Button";
import { ModuleDetailsCard } from "@ui-shared/ModuleDetailsCard";
import { StableInput } from "@ui-shared/StableInput";
import { UnitDesignerPreview } from "./UnitDesignerPreview";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import {
  DEFAULT_SKILL_TREE_STATE,
  SKILL_TREE_STATE_BRIDGE_KEY,
} from "@logic/modules/camp/skill-tree/skill-tree.const";
import { useLocalization } from "@ui/shared/useLocalization";
import "./UnitDesignerView.css";
import type { UnitDesignModuleUiApi } from "@logic/modules/camp/unit-design/unit-design.types";

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
  const { uiApi, bridge } = useAppLogic();
  const { t } = useLocalization();
  const designer = uiApi.unitDesign as UnitDesignModuleUiApi;
  const totals = useMemo(() => computeResourceTotals(resources), [resources]);
  const [selectedId, setSelectedId] = useState<string | null>(state.units[0]?.id ?? null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [preview, setPreview] = useState<{
    id: UnitModuleId;
    origin: "available" | "equipped";
  } | null>(null);
  const skillTreeState = useBridgeValue(
    bridge,
    SKILL_TREE_STATE_BRIDGE_KEY,
    DEFAULT_SKILL_TREE_STATE
  );

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

  useEffect(() => {
    setIsPreviewOpen(true);
  }, [selectedUnit?.id]);

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
      <div className="unit-designer stack-lg">
        <header className="unit-designer__header">
          <div>
            <h2 className="heading-2">{t("voidCamp.unitDesigner.title", "Unit Designer")}</h2>
            <p className="body-md text-muted">{t("voidCamp.unitDesigner.emptyHeader", "Create units once organs are available.")}</p>
          </div>
          <Button onClick={handleCreateUnit}>{t("voidCamp.unitDesigner.newUnit", "New Unit")}</Button>
        </header>
        <p className="body-md text-muted">{t("voidCamp.unitDesigner.noUnits", "No units available yet.")}</p>
      </div>
    );
  }

  const selectedModuleIds = selectedUnit.modules;
  const selectedDetails = selectedUnit.moduleDetails;
  const availableModules = useMemo(
    () => state.availableModules.filter((module) => module.level > 0),
    [state.availableModules]
  );
  const ownedSkills = useMemo(
    () => skillTreeState.nodes.filter((node) => node.level > 0).map((node) => node.id),
    [skillTreeState.nodes]
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
  const statEntries = buildUnitStatEntries(selectedUnit.blueprint, t);
  const isAtModuleCap = selectedModuleIds.length >= state.maxModules;

  return (
    <div className="unit-designer stack-lg">
      <div className="unit-designer__content">
        <div className="unit-designer__main surface-panel">
          <aside className="unit-designer__list">
            <div className="unit-designer__list-header">
              <h3 className="heading-4">{t("voidCamp.unitDesigner.units", "Units")}</h3>
              <Button onClick={handleCreateUnit}>{t("voidCamp.unitDesigner.newUnit", "New Unit")}</Button>
            </div>
            <ul className="unit-designer__list-items">
              {state.units.map((unit) => {
                const isActive = unit.id === selectedUnit.id;
                const listItemClassName = classNames(
                  "unit-designer__list-item",
                  isActive && "unit-designer__list-item--active"
                );
                return (
                  <li key={unit.id} className="unit-designer__list-entry">
                    <div
                      className={listItemClassName}
                      onClick={() => handleSelectUnit(unit.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleSelectUnit(unit.id);
                        }
                      }}
                    >
                      <div className="unit-designer__list-text">
                        <span className="unit-designer__list-name">
                          {unit.name || getPlayerUnitConfig(unit.type).name}
                        </span>
                        <span className="unit-designer__list-modules">
                          {unit.modules.length} {t("voidCamp.unitRoster.modules", "modules")}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={classNames("danger-button", "small-button", "button")}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteUnit(unit.id);
                        }}
                        aria-label={`${t("voidCamp.unitDesigner.delete", "Delete")} ${unit.name || getPlayerUnitConfig(unit.type).name}`}
                      >
                        {t("voidCamp.unitDesigner.delete", "Delete")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>
          <section className="unit-designer__editor">
          <div className="unit-designer__field">
            <label htmlFor="unit-designer-name" className="label">
              {t("voidCamp.unitDesigner.unitName", "Unit Name")}
            </label>
            <StableInput
              id="unit-designer-name"
              type="text"
              className="input"
              value={selectedUnit.name}
              onCommit={(value) => {
                const trimmed = value.trim();
                if (trimmed === "") {
                  const defaultName = getPlayerUnitConfig(selectedUnit.type).name;
                  handleRenameUnit(selectedUnit.id, defaultName);
                  return;
                }
                handleRenameUnit(selectedUnit.id, value);
              }}
            />
          </div>
          <div className="unit-designer__selected">
            <h4 className="heading-4">{t("voidCamp.unitDesigner.equipped", "Equipped Organs")}</h4>
            {selectedDetails.length === 0 ? (
              <p className="body-sm text-muted">{t("voidCamp.unitDesigner.noEquipped", "No organs equipped yet.")}</p>
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
                    </div>
                    <button
                      type="button"
                      className={classNames("danger-button", "small-button", "button")}
                      onClick={() => handleRemoveModule(selectedUnit.id, module.id, selectedModuleIds)}
                    >
                      {t("voidCamp.unitRoster.remove", "Remove")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="unit-designer__available">
            <h4 className="heading-4">{t("voidCamp.unitDesigner.available", "Available Organs")}</h4>
            <div className="unit-designer__available-scroll">
              {availableModules.length === 0 ? (
                <p className="body-sm text-muted">{t("voidCamp.unitDesigner.cultivate", "Cultivate organs to equip them here.")}</p>
              ) : (
                <ul className="unit-designer__available-list">
                  {availableModules.map((module) => {
                    const isSelected = selectedModuleIds.includes(module.id);
                    const disabled = isSelected || isAtModuleCap;
                    const label = isSelected
                      ? t("voidCamp.unitDesigner.equippedOne", "Equipped")
                      : isAtModuleCap
                      ? t("voidCamp.unitDesigner.maxSlots", "Max slots")
                      : t("voidCamp.unitDesigner.add", "Add");
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
                          <span className="unit-designer__available-level">{t("voidCamp.common.level", "Level")} {module.level}</span>
                        </button>
                        <button
                          type="button"
                          className={classNames(
                            "primary-button",
                            "small-button",
                            "button"
                          )}
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
        </div>
        <aside className="unit-designer__summary surface-sidebar">
          {!previewModule && (
            <>
              <div className="unit-designer__summary-header">
                <div className="unit-designer__summary-title heading-4">
                  {selectedUnit.name || getPlayerUnitConfig(selectedUnit.type).name}
                </div>
                <button
                  type="button"
                  className="unit-designer__summary-toggle"
                  aria-expanded={isPreviewOpen}
                  aria-label={
                    isPreviewOpen
                      ? t("voidCamp.unitDesigner.collapsePreview", "Collapse unit preview")
                      : t("voidCamp.unitDesigner.expandPreview", "Expand unit preview")
                  }
                  onClick={() => setIsPreviewOpen((current) => !current)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setIsPreviewOpen((current) => !current);
                    }
                  }}
                >
                  <span
                    className={classNames(
                      "unit-designer__summary-toggle-icon",
                      isPreviewOpen && "unit-designer__summary-toggle-icon--open"
                    )}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </button>
              </div>
              <UnitDesignerPreview
                isOpen={isPreviewOpen}
                unitType={selectedUnit.type}
                unitBlueprint={selectedUnit.blueprint}
                modules={selectedUnit.modules}
                skills={ownedSkills}
              />
            </>
          )}
          {previewModule ? (
            <ModuleDetailsCard
              className="unit-designer__module-card no-wrapper"
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
          ) : (
            <div className="unit-designer__summary-scroll">
              <div className="unit-designer__module-preview">
                <section className="unit-designer__cost">
                  <h5 className="heading-5">{t("voidCamp.unitDesigner.summoningCost", "Summoning Cost")}</h5>
                  <ResourceCostDisplay cost={selectedUnit.cost} />
                </section>
                <section className="unit-designer__stats">
                  <h5 className="heading-5">{t("voidCamp.unitDesigner.stats", "Stats")}</h5>
                  <dl>
                    {statEntries.map((entry) => (
                      <div key={entry.label} className="unit-designer__stat">
                        <dt>{entry.label}</dt>
                        <dd>
                          <span>{entry.value}</span>
                          {entry.hint ? (
                            <span className="unit-designer__stat-hint">{entry.hint}</span>
                          ) : null}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
