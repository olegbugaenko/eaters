import type { KeyboardEvent } from "react";
import { MapId } from "@db/maps-db";
import { MapListEntry } from "@logic/modules/active-map/MapModule";
import { Button } from "@shared/Button";
import { classNames } from "@shared/classNames";
import { formatDuration } from "@ui/utils/formatDuration";
import "./MapSelectPanel.css";
import { formatNumber } from "@shared/format/number";

interface MapSelectPanelProps {
  maps: MapListEntry[];
  clearedLevelsTotal: number;
  selectedMap: MapId | null;
  onSelectMap: (mapId: MapId) => void;
  onSelectLevel: (mapId: MapId, level: number) => void;
  onStartMap: (mapId: MapId) => void;
}

export const MapSelectPanel: React.FC<MapSelectPanelProps> = ({
  maps,
  clearedLevelsTotal,
  selectedMap,
  onSelectMap,
  onSelectLevel,
  onStartMap,
}) => {
  return (
    <div className="map-select-panel stack-lg">
      <div className="map-select-panel__header">
        <p>Map Levels Cleared: {formatNumber(clearedLevelsTotal)}</p>
      </div>
      <div className="map-select-panel__list card-list">
        {maps.map((map) => {
          const isSelected = map.id === selectedMap;
          const canDecrease = map.selectedLevel > 0;
          const canIncrease = map.selectedLevel < map.currentLevel;
          const handleCardClick = () => {
            if (!isSelected) {
              onSelectMap(map.id);
            }
          };
          const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleCardClick();
            }
          };
          const handleStart = () => {
            onSelectMap(map.id);
            onStartMap(map.id);
          };
          return (
            <article
              key={map.id}
              className={`map-select-card surface-card${
                isSelected ? " map-select-card--selected" : ""
              }`}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={handleCardClick}
              onKeyDown={handleKeyDown}
            >
              <header className="map-select-card__header">
                <h2 className="heading-3">{map.name}</h2>
                {isSelected ? (
                  <span className="map-select-card__status">Selected</span>
                ) : null}
              </header>
              <dl className="map-select-card__details">
                <div>
                  <dt>Size</dt>
                  <dd>
                    {map.size.width} × {map.size.height}
                  </dd>
                </div>
                <div>
                  <dt>Selected Level</dt>
                  <dd>
                    <div className="map-select-card__level-control">
                      <button
                        type="button"
                        className={classNames(
                          "secondary-button",
                          "small-button",
                          "button",
                          "square",
                          "lg-font"
                        )}
                        onClick={() => onSelectLevel(map.id, map.selectedLevel - 1)}
                        disabled={!canDecrease}
                        aria-label="Decrease map level"
                      >
                        -
                      </button>
                      <span className="map-select-card__level-value">{map.selectedLevel}</span>
                      <button
                        type="button"
                        className={classNames(
                          "secondary-button",
                          "small-button",
                          "button",
                          "square",
                          "lg-font"
                        )}
                        onClick={() => onSelectLevel(map.id, map.selectedLevel + 1)}
                        disabled={!canIncrease}
                        aria-label="Increase map level"
                      >
                        +
                      </button>
                    </div>
                  </dd>
                </div>
                <div>
                  <dt>Max Level</dt>
                  <dd>{map.currentLevel}</dd>
                </div>
                <div>
                  <dt>Attempts</dt>
                  <dd>{map.attempts}</dd>
                </div>
                <div>
                  <dt>Best Time</dt>
                  <dd>
                    {map.bestTimeMs != null
                      ? formatDuration(map.bestTimeMs)
                      : "—"}
                  </dd>
                </div>
              </dl>
              <div className="map-select-card__actions">
                <Button onClick={handleStart}>Start Map</Button>
              </div>
            </article>
          );
        })}
        {maps.length === 0 && (
          <div className="map-select-panel__empty text-block text-muted">
            No maps available yet.
          </div>
        )}
      </div>
    </div>
  );
};
