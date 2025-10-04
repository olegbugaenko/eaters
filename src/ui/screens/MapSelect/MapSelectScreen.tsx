import { useMemo } from "react";
import { Button } from "../../shared/Button";
import { useAppLogic } from "../../contexts/AppLogicContext";
import { useBridgeValue } from "../../shared/useBridgeValue";
import { TIME_BRIDGE_KEY } from "../../../logic/modules/TestTimeModule";
import { BRICK_COUNT_BRIDGE_KEY } from "../../../logic/modules/BricksModule";
import {
  MAP_LIST_BRIDGE_KEY,
  MAP_SELECTED_BRIDGE_KEY,
  MapListEntry,
} from "../../../logic/modules/MapModule";
import { MapId } from "../../../db/maps-db";
import "./MapSelectScreen.css";

interface MapSelectScreenProps {
  onStart: () => void;
  onExit: () => void;
}

const formatTime = (timeMs: number): string => {
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export const MapSelectScreen: React.FC<MapSelectScreenProps> = ({ onStart, onExit }) => {
  const { app, bridge } = useAppLogic();
  const timePlayed = useBridgeValue<number>(bridge, TIME_BRIDGE_KEY, 0);
  const brickCount = useBridgeValue<number>(bridge, BRICK_COUNT_BRIDGE_KEY, 0);
  const maps = useBridgeValue<MapListEntry[]>(bridge, MAP_LIST_BRIDGE_KEY, []);
  const selectedMap = useBridgeValue<MapId | null>(bridge, MAP_SELECTED_BRIDGE_KEY, null);

  const formatted = useMemo(() => formatTime(timePlayed), [timePlayed]);
  const canStart = maps.length === 0 ? false : selectedMap !== null;

  return (
    <div className="map-select-screen">
      <h1>Map Selection</h1>
      <p>Time played: {formatted}</p>
      <p>Bricks on map: {brickCount}</p>
      <div className="map-select-list">
        {maps.map((map) => {
          const isSelected = map.id === selectedMap;
          return (
            <div
              key={map.id}
              className={`map-select-card${isSelected ? " is-selected" : ""}`}
            >
              <h2>{map.name}</h2>
              <dl className="map-select-details">
                <div>
                  <dt>Size</dt>
                  <dd>
                    {map.size.width} × {map.size.height}
                  </dd>
                </div>
                <div>
                  <dt>Bricks</dt>
                  <dd>{map.brickCount}</dd>
                </div>
                <div>
                  <dt>Types</dt>
                  <dd>{map.brickTypes.join(", ")}</dd>
                </div>
              </dl>
              <Button
                onClick={() => {
                  app.selectMap(map.id);
                }}
              >
                {isSelected ? "Selected" : "Select"}
              </Button>
            </div>
          );
        })}
      </div>
      <div className="map-select-actions">
        <Button onClick={onStart} disabled={!canStart}>
          Start
        </Button>
        <Button onClick={onExit}>Main Menu</Button>
      </div>
    </div>
  );
};
