import React from "react";
import { PlayerUnitType } from "../../../db/player-units-db";
import {
  NecromancerResourcesPayload,
  NecromancerSpawnOption,
} from "../../../logic/modules/NecromancerModule";
import { createEmptyResourceAmount } from "../../../types/resources";
import { ProgressBar } from "../../shared/ProgressBar";
import { ResourceCostDisplay } from "../../shared/ResourceCostDisplay";
import "./SceneSummoningPanel.css";

interface SceneSummoningPanelProps {
  resources: NecromancerResourcesPayload;
  spawnOptions: readonly NecromancerSpawnOption[];
  onSummon: (type: PlayerUnitType) => void;
}

const formatResourceValue = (current: number, max: number): string =>
  `${current.toFixed(1)} / ${max.toFixed(1)}`;

export const SceneSummoningPanel: React.FC<SceneSummoningPanelProps> = ({
  resources,
  spawnOptions,
  onSummon,
}) => {
  const available = {
    mana: resources.mana.current,
    sanity: resources.sanity.current,
  };

  return (
    <div className="scene-summoning-panel">
      <div className="scene-summoning-panel__section scene-summoning-panel__section--left">
        <div className="scene-summoning-panel__resource">
          <div className="scene-summoning-panel__resource-label">Sanity</div>
          <ProgressBar
            className="scene-summoning-panel__resource-bar scene-summoning-panel__resource-bar--sanity"
            current={resources.sanity.current}
            max={resources.sanity.max}
            formatValue={(current, max) => formatResourceValue(current, max)}
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
        <div className="scene-summoning-panel__resource">
          <div className="scene-summoning-panel__resource-label">Mana</div>
          <ProgressBar
            className="scene-summoning-panel__resource-bar scene-summoning-panel__resource-bar--mana"
            current={resources.mana.current}
            max={resources.mana.max}
            formatValue={(current, max) => formatResourceValue(current, max)}
          />
        </div>
      </div>
    </div>
  );
};

const computeMissing = (
  cost: NecromancerSpawnOption["cost"],
  available: { mana: number; sanity: number }
) => {
  const missing = createEmptyResourceAmount();
  missing.mana = Math.max(cost.mana - available.mana, 0);
  missing.sanity = Math.max(cost.sanity - available.sanity, 0);
  return missing;
};
