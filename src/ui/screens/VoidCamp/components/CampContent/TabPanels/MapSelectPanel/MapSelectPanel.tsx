import { MapId } from "@db/maps-db";
import { MapListEntry } from "@logic/modules/MapModule";
import { Button } from "@shared/Button";
import "./MapSelectPanel.css";

interface MapSelectPanelProps {
  maps: MapListEntry[];
  selectedMap: MapId | null;
  onSelectMap: (mapId: MapId) => void;
  onStart: () => void;
  onExit: () => void;
  formattedTime: string;
  brickCount: number;
}

export const MapSelectPanel: React.FC<MapSelectPanelProps> = ({
  maps,
  selectedMap,
  onSelectMap,
  onStart,
  onExit,
  formattedTime,
  brickCount,
}) => {
  const canStart = maps.length > 0 && selectedMap !== null;

  return (
    <div className="map-select-panel stack-lg">
      <div className="map-select-panel__stats two-column-grid">
        <div className="text-block">
          <span className="map-select-panel__label text-subtle">Time Played</span>
          <span className="map-select-panel__value text-strong">{formattedTime}</span>
        </div>
        <div className="text-block">
          <span className="map-select-panel__label text-subtle">Particles on Map</span>
          <span className="map-select-panel__value text-strong">{brickCount}</span>
        </div>
      </div>

      <div className="map-select-panel__list card-list">
        {maps.map((map) => {
          const isSelected = map.id === selectedMap;
          return (
            <article
              key={map.id}
              className={`map-select-card surface-card${
                isSelected ? " map-select-card--selected" : ""
              }`}
            >
              <header className="map-select-card__header">
                <h2 className="heading-3">{map.name}</h2>
                <Button onClick={() => onSelectMap(map.id)}>
                  {isSelected ? "Selected" : "Select"}
                </Button>
              </header>
              <dl className="map-select-card__details">
                <div>
                  <dt>Size</dt>
                  <dd>
                    {map.size.width} × {map.size.height}
                  </dd>
                </div>
                <div>
                  <dt>Level</dt>
                  <dd>{map.currentLevel}</dd>
                </div>
                <div>
                  <dt>Attempts</dt>
                  <dd>{map.attempts}</dd>
                </div>
                <div>
                  <dt>Types</dt>
                  <dd>{map.brickTypes.join(", ")}</dd>
                </div>
              </dl>
            </article>
          );
        })}
        {maps.length === 0 && (
          <div className="map-select-panel__empty text-block text-muted">
            No maps available yet.
          </div>
        )}
      </div>

      <div className="button-row">
        <Button onClick={onStart} disabled={!canStart}>
          Start
        </Button>
        <Button onClick={onExit}>Main Menu</Button>
      </div>
    </div>
  );
};
