import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayerUnitType } from "../../../db/player-units-db";
import {
  NecromancerResourcesPayload,
  NecromancerSpawnOption,
} from "../../../logic/modules/NecromancerModule";
import { createEmptyResourceAmount } from "../../../types/resources";
import { ResourceDiamondMeter } from "./ResourceDiamondMeter";
import { ResourceCostDisplay } from "../../shared/ResourceCostDisplay";
import "./SceneSummoningPanel.css";
import { PlayerUnitBlueprintStats } from "../../../types/player-units";
import { SceneTooltipContent } from "./SceneTooltipPanel";
import { formatNumber } from "../../shared/format/number";
import { createUnitTooltip } from "./tooltip-factory/createUnitTooltip";

interface SceneSummoningPanelProps {
  resources: NecromancerResourcesPayload;
  spawnOptions: readonly NecromancerSpawnOption[];
  onSummon: (type: PlayerUnitType) => void;
  blueprints: readonly PlayerUnitBlueprintStats[];
  onHoverInfoChange: (content: SceneTooltipContent | null) => void;
}

const formatResourceValue = (
  current: number,
  max: number,
  _percent?: number
): string =>
  `${formatNumber(current, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} / ${formatNumber(max, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`;


export const SceneSummoningPanel = forwardRef<HTMLDivElement, SceneSummoningPanelProps>(
  ({ resources, spawnOptions, onSummon, blueprints, onHoverInfoChange }, ref) => {
    const available = {
      mana: resources.mana.current,
      sanity: resources.sanity.current,
    };

    const blueprintMap = useMemo(() => {
      const map = new Map<PlayerUnitType, PlayerUnitBlueprintStats>();
      blueprints.forEach((blueprint) => {
        map.set(blueprint.type, blueprint);
      });
      return map;
    }, [blueprints]);

    const sanityConsuming = useResourceConsumptionPulse(resources.sanity.current);
    const manaConsuming = useResourceConsumptionPulse(resources.mana.current);

    const hideTooltip = useCallback(() => {
      onHoverInfoChange(null);
    }, [onHoverInfoChange]);

    const showUnitTooltip = useCallback(
      (type: PlayerUnitType) => {
        const blueprint = blueprintMap.get(type);
        if (!blueprint) {
          onHoverInfoChange(null);
          return;
        }
        onHoverInfoChange(createUnitTooltip(blueprint));
      },
      [blueprintMap, onHoverInfoChange]
    );

    const sanityResourceClassName = [
      "scene-summoning-panel__resource",
      "scene-summoning-panel__resource--sanity",
      sanityConsuming ? "scene-summoning-panel__resource--consuming" : null,
    ]
      .filter(Boolean)
      .join(" ");

    const manaResourceClassName = [
      "scene-summoning-panel__resource",
      "scene-summoning-panel__resource--mana",
      manaConsuming ? "scene-summoning-panel__resource--consuming" : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div ref={ref} className="scene-summoning-panel" onPointerLeave={hideTooltip}>
        <div className="scene-summoning-panel__section scene-summoning-panel__section--left">
          <div className={sanityResourceClassName}>
            <div className="scene-summoning-panel__resource-label">Sanity</div>
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
            />
          </div>
        </div>
        <div className="scene-summoning-panel__section scene-summoning-panel__section--center">
          <div className="scene-summoning-panel__unit-list">
            {spawnOptions.map((option) => {
              const missing = computeMissing(option.cost, available);
              const canAfford = missing.mana <= 0 && missing.sanity <= 0;
              const itemClassName = [
                "scene-summoning-panel__unit",
                !canAfford ? "scene-summoning-panel__unit--disabled" : null,
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={option.type}
                  type="button"
                  className={itemClassName}
                  onClick={() => {
                    if (canAfford) {
                      onSummon(option.type);
                    }
                  }}
                  onMouseEnter={() => showUnitTooltip(option.type)}
                  onFocus={() => showUnitTooltip(option.type)}
                  onMouseLeave={hideTooltip}
                  onBlur={hideTooltip}
                  disabled={!canAfford}
                >
                  <div className="scene-summoning-panel__unit-name">{option.name}</div>
                  <ResourceCostDisplay cost={option.cost} missing={missing} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="scene-summoning-panel__section scene-summoning-panel__section--right">
          <div className={manaResourceClassName}>
            <div className="scene-summoning-panel__resource-label">Mana</div>
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
            />
          </div>
        </div>
      </div>
    );
  }
);

SceneSummoningPanel.displayName = "SceneSummoningPanel";

const computeMissing = (
  cost: NecromancerSpawnOption["cost"],
  available: { mana: number; sanity: number }
) => {
  const missing = createEmptyResourceAmount();
  missing.mana = Math.max(cost.mana - available.mana, 0);
  missing.sanity = Math.max(cost.sanity - available.sanity, 0);
  return missing;
};

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
