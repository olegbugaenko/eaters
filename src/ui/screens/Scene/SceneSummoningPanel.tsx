import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  NecromancerResourcesPayload,
  NecromancerSpawnOption,
} from "../../../logic/modules/active-map/NecromancerModule";
import { createEmptyResourceAmount } from "../../../types/resources";
import { classNames } from "@shared/classNames";
import { ResourceDiamondMeter } from "./ResourceDiamondMeter";
import { ResourceCostDisplay } from "../../shared/ResourceCostDisplay";
import "./SceneSummoningPanel.css";
import { SceneTooltipContent } from "./SceneTooltipPanel";
import { formatNumber } from "../../shared/format/number";
import { createUnitTooltip } from "./tooltip-factory/createUnitTooltip";
import { createSpellTooltip } from "./tooltip-factory/createSpellTooltip";
import { UnitAutomationBridgeState } from "../../../logic/modules/active-map/UnitAutomationModule";
import {
  UnitDesignId,
  UnitDesignModuleDetail,
} from "../../../logic/modules/camp/UnitDesignModule";
import { formatUnitModuleBonusValue } from "../../shared/format/unitModuleBonus";
import { useBridgeValue } from "../../shared/useBridgeValue";
import { useAppLogic } from "../../contexts/AppLogicContext";
import { PLAYER_UNIT_COUNTS_BY_DESIGN_BRIDGE_KEY } from "../../../logic/modules/active-map/PlayerUnitsModule";
import { SpellOption } from "../../../logic/modules/active-map/SpellcastingModule";
import { SpellId } from "../../../db/spells-db";

interface SceneSummoningPanelProps {
  resources: NecromancerResourcesPayload;
  spawnOptions: readonly NecromancerSpawnOption[];
  spells: readonly SpellOption[];
  selectedSpellId: SpellId | null;
  onSelectSpell: (spellId: SpellId) => void;
  onSummon: (designId: UnitDesignId) => void;
  onHoverInfoChange: (content: SceneTooltipContent | null) => void;
  automation: UnitAutomationBridgeState;
  onToggleAutomation: (designId: UnitDesignId, enabled: boolean) => void;
}

const formatResourceValue = (
  current: number,
  max: number,
  _percent?: number,
): string =>
  `${formatNumber(current, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} / ${formatNumber(max, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`;

export const SceneSummoningPanel = forwardRef<
  HTMLDivElement,
  SceneSummoningPanelProps
>(
  (
    {
      resources,
      spawnOptions,
      spells,
      selectedSpellId,
      onSelectSpell,
      onSummon,
      onHoverInfoChange,
      automation,
      onToggleAutomation,
    },
    ref,
  ) => {
    const { bridge } = useAppLogic();
    const unitCountsByDesign = useBridgeValue<Record<string, number>>(
      bridge,
      PLAYER_UNIT_COUNTS_BY_DESIGN_BRIDGE_KEY,
      {},
    );

    const available = {
      mana: resources.mana.current,
      sanity: resources.sanity.current,
    };

    const automationLookup = useMemo(() => {
      const map = new Map<UnitDesignId, { enabled: boolean }>();
      automation.units.forEach((entry) => {
        map.set(entry.designId, { enabled: entry.enabled });
      });
      return map;
    }, [automation]);

    const sanityConsuming = useResourceConsumptionPulse(
      resources.sanity.current,
    );
    const manaConsuming = useResourceConsumptionPulse(resources.mana.current);

    const hideTooltip = useCallback(() => {
      onHoverInfoChange(null);
    }, [onHoverInfoChange]);

    const showUnitTooltip = useCallback(
      (blueprint: NecromancerSpawnOption["blueprint"]) => {
        onHoverInfoChange(createUnitTooltip(blueprint));
      },
      [onHoverInfoChange],
    );

    const showSpellTooltip = useCallback(
      (spell: SpellOption) => {
        onHoverInfoChange(createSpellTooltip(spell));
      },
      [onHoverInfoChange],
    );

    const sanityResourceClassName = classNames(
      "scene-summoning-panel__resource",
      "scene-summoning-panel__resource--sanity",
      sanityConsuming && "scene-summoning-panel__resource--consuming",
    );

    const manaResourceClassName = classNames(
      "scene-summoning-panel__resource",
      "scene-summoning-panel__resource--mana",
      manaConsuming && "scene-summoning-panel__resource--consuming",
    );

    return (
      <div
        ref={ref}
        className="scene-summoning-panel"
        onPointerLeave={hideTooltip}
      >
        <div className="scene-summoning-panel__summon">
          <div className="scene-summoning-panel__section scene-summoning-panel__section--left">
            <div id="sanity-resource" className={sanityResourceClassName}>
              <ResourceDiamondMeter
                id="sanity"
                className="scene-summoning-panel__resource-meter scene-summoning-panel__resource-meter--sanity"
                current={resources.sanity.current}
                max={resources.sanity.max}
                gradientStops={[
                  { offset: 0, color: "#581c87" },
                  { offset: 0.55, color: "#8b21a8" },
                  { offset: 1, color: "#c084fc" },
                ]}
                outlineColor="rgba(236, 72, 153, 0.5)"
                glowColor="rgba(168, 85, 247, 0.35)"
                formatValue={formatResourceValue}
                title="Sanity"
              />
            </div>
          </div>
          <div className="scene-summoning-panel__section scene-summoning-panel__section--center">
          <div className="scene-summoning-panel__spells-header">Summoning</div>
            <div className="scene-summoning-panel__unit-list">
              {spawnOptions.map((option) => {
                const missing = computeMissing(option.cost, available);
                const canAfford = missing.mana <= 0 && missing.sanity <= 0;
                const actionClassName = classNames(
                  "scene-summoning-panel__unit-action",
                  !canAfford && "scene-summoning-panel__unit-action--disabled",
                );
                const automationEntry = automationLookup.get(option.designId);
                const automationEnabled = automationEntry?.enabled ?? false;
                return (
                  <div
                    key={option.designId}
                    className="scene-summoning-panel__unit"
                  >
                    <div
                      className={actionClassName}
                      onMouseEnter={() => showUnitTooltip(option.blueprint)}
                      onMouseLeave={hideTooltip}
                      onClick={(e) => {
                        if (canAfford && !(e.target as HTMLElement).closest('.scene-summoning-panel__automation-toggle')) {
                          onSummon(option.designId);
                        }
                      }}
                      onFocus={() => showUnitTooltip(option.blueprint)}
                      onBlur={hideTooltip}
                      role="button"
                      tabIndex={canAfford ? 0 : -1}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && canAfford) {
                          e.preventDefault();
                          if (!(e.target as HTMLElement).closest('.scene-summoning-panel__automation-toggle')) {
                            onSummon(option.designId);
                          }
                        }
                      }}
                      aria-disabled={!canAfford}
                    >
                      <div className="scene-summoning-panel__unit-header">
                        <div className="scene-summoning-panel__unit-name-wrapper">
                          <span className="scene-summoning-panel__unit-name">
                            {option.name}
                          </span>
                          {(unitCountsByDesign[option.designId] ?? 0) > 0 && (
                            <span className="scene-summoning-panel__unit-count">
                              ({unitCountsByDesign[option.designId]})
                            </span>
                          )}
                        </div>
                        {automation.unlocked && (
                          <label className="scene-summoning-panel__automation-toggle" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={automationEnabled}
                              onChange={(event) =>
                                onToggleAutomation(
                                  option.designId,
                                  event.target.checked,
                                )
                              }
                            />
                            <span>Automate</span>
                          </label>
                        )}
                      </div>
                      <div className="scene-summoning-panel__unit-cost">
                        <ResourceCostDisplay
                          cost={option.cost}
                          missing={missing}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="scene-summoning-panel__spells-area">
          <div className="scene-summoning-panel__spells-header">Spellbook</div>
          {spells.length === 0 ? (
            <div className="scene-summoning-panel__spells-placeholder">
              Spellcasting rituals will appear here soon.
            </div>
          ) : (
            <div className="scene-summoning-panel__spell-list">
              {spells.map((spell) => {
                const missing = computeMissing(spell.cost, available);
                const canAfford = missing.mana <= 0 && missing.sanity <= 0;
                const onCooldown = spell.remainingCooldownMs > 0;
                const isSelected = selectedSpellId === spell.id;
                const spellClassName = classNames(
                  "scene-summoning-panel__spell",
                  !canAfford && "scene-summoning-panel__spell--disabled",
                  onCooldown && "scene-summoning-panel__spell--cooldown",
                  isSelected && "scene-summoning-panel__spell--selected",
                );
                const statusLabel = onCooldown
                  ? `Ready in ${formatCooldownRemaining(spell.remainingCooldownMs)}`
                  : canAfford
                  ? isSelected
                    ? "Selected"
                    : "Ready"
                  : "Need resources";
                return (
                  <div
                    key={spell.id}
                    className={spellClassName}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectSpell(spell.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectSpell(spell.id);
                      }
                    }}
                    onMouseEnter={() => showSpellTooltip(spell)}
                    onMouseLeave={hideTooltip}
                    onFocus={() => showSpellTooltip(spell)}
                    onBlur={hideTooltip}
                  >
                    <div className="scene-summoning-panel__spell-header">
                      <span className="scene-summoning-panel__spell-name">{spell.name}</span>
                      <span className="scene-summoning-panel__spell-status">{statusLabel}</span>
                    </div>
                    <div className="scene-summoning-panel__spell-cost">
                      <ResourceCostDisplay cost={spell.cost} missing={missing} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="scene-summoning-panel__section scene-summoning-panel__section--right">
          <div id="mana-resource" className={manaResourceClassName}>
            <ResourceDiamondMeter
              id="mana"
              className="scene-summoning-panel__resource-meter scene-summoning-panel__resource-meter--mana"
              current={resources.mana.current}
              max={resources.mana.max}
              gradientStops={[
                { offset: 0, color: "#1e3a8a" },
                { offset: 0.45, color: "#2563eb" },
                { offset: 1, color: "#22d3ee" },
              ]}
              outlineColor="rgba(59, 130, 246, 0.6)"
              glowColor="rgba(56, 189, 248, 0.35)"
              formatValue={formatResourceValue}
              title="Mana"
            />
          </div>
        </div>
      </div>
    );
  },
);

SceneSummoningPanel.displayName = "SceneSummoningPanel";

const computeMissing = (
  cost: NecromancerSpawnOption["cost"],
  available: { mana: number; sanity: number },
) => {
  const missing = createEmptyResourceAmount();
  missing.mana = Math.max(cost.mana - available.mana, 0);
  missing.sanity = Math.max(cost.sanity - available.sanity, 0);
  return missing;
};

const formatModuleSummary = (module: UnitDesignModuleDetail): string =>
  `${module.bonusLabel}: ${formatUnitModuleBonusValue(module.bonusType, module.bonusValue)}`;

const formatCooldownRemaining = (remainingMs: number): string =>
  `${formatNumber(Math.max(remainingMs, 0) / 1000, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}s`;

const RESOURCE_CONSUMPTION_THRESHOLD = 0.01;
const RESOURCE_CONSUMPTION_PULSE_DURATION_MS = 360;

const useResourceConsumptionPulse = (value: number): boolean => {
  const [pulseMarker, setPulseMarker] = useState(0);
  const previousValueRef = useRef(value);

  useEffect(() => {
    const previousValue = previousValueRef.current;
    if (value < previousValue - RESOURCE_CONSUMPTION_THRESHOLD) {
      setPulseMarker(Date.now());
    }
    previousValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (pulseMarker === 0) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const timer = window.setTimeout(() => {
      setPulseMarker(0);
    }, RESOURCE_CONSUMPTION_PULSE_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pulseMarker]);

  return pulseMarker !== 0;
};
