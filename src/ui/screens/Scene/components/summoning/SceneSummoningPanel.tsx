import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MAX_UNITS_ON_MAP,
  NECROMANCER_RESOURCES_BRIDGE_KEY,
  NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY,
} from "@logic/modules/active-map/necromancer/necromancer.const";
import type {
  NecromancerResourcesPayload,
  NecromancerSpawnOption,
} from "@logic/modules/active-map/necromancer/necromancer.types";
import { createEmptyResourceAmount } from "@shared/const/resources.const";
import { SpellOption } from "@logic/modules/active-map/spellcasting/spellcasting.types";
import {
  DEFAULT_SPELL_OPTIONS,
  SPELL_OPTIONS_BRIDGE_KEY,
} from "@logic/modules/active-map/spellcasting/spellcasting.const";
import {
  DEFAULT_UNIT_AUTOMATION_STATE,
  UNIT_AUTOMATION_STATE_BRIDGE_KEY,
} from "@logic/modules/active-map/unit-automation/unit-automation.const";
import {
  PLAYER_UNIT_COUNT_BRIDGE_KEY,
  PLAYER_UNIT_COUNTS_BY_DESIGN_BRIDGE_KEY,
} from "@logic/modules/active-map/player-units/player-units.const";
import {
  UnitDesignId,
  UnitDesignModuleDetail,
} from "@logic/modules/camp/unit-design/unit-design.types";
import { SpellId } from "@db/spells-db";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { classNames } from "@ui-shared/classNames";
import { formatNumber } from "@ui-shared/format/number";
import { formatUnitModuleBonusValue } from "@ui-shared/format/unitModuleBonus";
import { ResourceCostDisplay } from "@ui-shared/ResourceCostDisplay";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { ResourceDiamondMeter } from "./ResourceDiamondMeter";
import "./SceneSummoningPanel.css";
import { SceneTooltipContent } from "../tooltip/SceneTooltipPanel";
import { createUnitTooltip } from "./tooltip-factory/createUnitTooltip";
import { createSpellTooltip } from "./tooltip-factory/createSpellTooltip";

const DEFAULT_NECROMANCER_RESOURCES: NecromancerResourcesPayload = {
  mana: { current: 0, max: 0 },
  sanity: { current: 0, max: 0 },
};
const EMPTY_SPAWN_OPTIONS: NecromancerSpawnOption[] = [];

interface SceneSummoningPanelProps {
  selectedSpellId: SpellId | null;
  spellCastPulse: { id: SpellId; token: number } | null;
  onSelectSpell: (spellId: SpellId) => void;
  onSummon: (designId: UnitDesignId) => void;
  onHoverInfoChange: (content: SceneTooltipContent | null) => void;
  onToggleAutomation: (designId: UnitDesignId, enabled: boolean) => void;
}

const SPELL_PULSE_PADDING = 14;

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
      selectedSpellId,
      spellCastPulse,
      onSelectSpell,
      onSummon,
      onHoverInfoChange,
      onToggleAutomation,
    },
    ref,
  ) => {
    const panelRef = useRef<HTMLDivElement | null>(null);
    const { bridge } = useAppLogic();
    const resources = useBridgeValue(
      bridge,
      NECROMANCER_RESOURCES_BRIDGE_KEY,
      DEFAULT_NECROMANCER_RESOURCES,
    );
    const spawnOptions = useBridgeValue(
      bridge,
      NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY,
      EMPTY_SPAWN_OPTIONS,
    );
    const spells = useBridgeValue(bridge, SPELL_OPTIONS_BRIDGE_KEY, DEFAULT_SPELL_OPTIONS);
    const automationState = useBridgeValue(
      bridge,
      UNIT_AUTOMATION_STATE_BRIDGE_KEY,
      DEFAULT_UNIT_AUTOMATION_STATE,
    );
    const unitCount = useBridgeValue(bridge, PLAYER_UNIT_COUNT_BRIDGE_KEY, 0);
    const unitCountsByDesign = useBridgeValue(
      bridge,
      PLAYER_UNIT_COUNTS_BY_DESIGN_BRIDGE_KEY,
      {} as Record<string, number>,
    );
    const [spellPulse, setSpellPulse] = useState<{
      token: number;
      rect: { x: number; y: number; width: number; height: number };
    } | null>(null);

    const available = {
      mana: resources.mana.current,
      sanity: resources.sanity.current,
    };
    const remainingUnitSlots = Math.max(MAX_UNITS_ON_MAP - unitCount, 0);
    const atUnitCap = remainingUnitSlots <= 0;

    useEffect(() => {
      if (!spellCastPulse) {
        return;
      }

      const panel = panelRef.current;
      const target = document.getElementById(`spell-option-${spellCastPulse.id}`);
      if (!panel || !target) {
        return;
      }

      const panelRect = panel.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const rect = {
        x: targetRect.left - panelRect.left - SPELL_PULSE_PADDING,
        y: targetRect.top - panelRect.top - SPELL_PULSE_PADDING,
        width: targetRect.width + SPELL_PULSE_PADDING * 2,
        height: targetRect.height + SPELL_PULSE_PADDING * 2,
      };

      setSpellPulse({ token: spellCastPulse.token, rect });
      const timeout = window.setTimeout(() => {
        setSpellPulse((current) =>
          current?.token === spellCastPulse.token ? null : current
        );
      }, 750);

      return () => {
        window.clearTimeout(timeout);
      };
    }, [spellCastPulse]);

    const automationLookup = useMemo(() => {
      const map = new Map<UnitDesignId, { enabled: boolean }>();
      automationState.units.forEach((entry) => {
        map.set(entry.designId, { enabled: entry.enabled });
      });
      return map;
    }, [automationState]);

    const sanityConsuming = useResourceConsumptionPulse(
      resources.sanity.current,
    );
    const manaConsuming = useResourceConsumptionPulse(resources.mana.current);

    const hideTooltip = useCallback(() => {
      onHoverInfoChange(null);
    }, [onHoverInfoChange]);

    const showUnitTooltip = useCallback(
      (blueprint: NecromancerSpawnOption["blueprint"]) => {
        onHoverInfoChange(createUnitTooltip(blueprint, spawnOptions.length > 1));
      },
      [onHoverInfoChange, spawnOptions],
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

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        panelRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    return (
      <div
        ref={setRefs}
        className="scene-summoning-panel"
        onPointerLeave={hideTooltip}
      >
        <div className="scene-summoning-panel__spell-pulse-layer" aria-hidden="true">
          {spellPulse && (
            <div
              key={spellPulse.token}
              className="scene-summoning-panel__spell-pulse"
              style={{
                left: `${spellPulse.rect.x}px`,
                top: `${spellPulse.rect.y}px`,
                width: `${spellPulse.rect.width}px`,
                height: `${spellPulse.rect.height}px`,
              }}
            />
          )}
        </div>
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
            <div className="scene-summoning-panel__unit-cap-indicator">
              Units: {unitCount}/{MAX_UNITS_ON_MAP} ·{" "}
              {atUnitCap ? "Cap reached" : `${remainingUnitSlots} slots left`}
            </div>
            {atUnitCap && (
              <div className="scene-summoning-panel__unit-cap-warning">
                Unit cap reached. Let creatures fall before summoning more.
              </div>
            )}
            <div id="summoning-unit-list" className="scene-summoning-panel__unit-list">
              {spawnOptions.map((option) => {
                const missing = computeMissing(option.cost, available);
                const canAfford = !atUnitCap && missing.mana <= 0 && missing.sanity <= 0;
                const actionClassName = classNames(
                  "scene-summoning-panel__unit-action",
                  !canAfford && "scene-summoning-panel__unit-action--disabled",
                );
                const automationEntry = automationLookup.get(option.designId);
                const automationEnabled = automationEntry?.enabled ?? false;
                const optionElementId =
                  option.type === "bluePentagon"
                    ? "summon-option-bluePentagon"
                    : `summon-option-${option.designId}`;
                return (
                  <div
                    key={option.designId}
                    id={optionElementId}
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
                        {automationState.unlocked && (
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
        <div id="spellbook-area" className="scene-summoning-panel__spells-area">
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
                  : isSelected
                  ? "Selected"
                  : "Ready";
                const spellElementId = `spell-option-${spell.id}`;
                return (
                  <div
                    key={spell.id}
                    id={spellElementId}
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
