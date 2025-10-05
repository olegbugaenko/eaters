import { useMemo, useState } from "react";
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
import {
  RESOURCE_TOTALS_BRIDGE_KEY,
  ResourceAmountPayload,
} from "../../../logic/modules/ResourcesModule";
import "./MapSelectScreen.css";

interface MapSelectScreenProps {
  onStart: () => void;
  onExit: () => void;
}

type MapSelectTab = "maps" | "skills";

const formatTime = (timeMs: number): string => {
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const SkillTreePlaceholder: React.FC = () => (
  <div className="map-select-skill-placeholder">
    <h2>Skill Tree</h2>
    <p>Research in progress. Unlocks and upgrades will appear here in a future update.</p>
  </div>
);

export const MapSelectScreen: React.FC<MapSelectScreenProps> = ({ onStart, onExit }) => {
  const { app, bridge } = useAppLogic();
  const [activeTab, setActiveTab] = useState<MapSelectTab>("maps");
  const timePlayed = useBridgeValue<number>(bridge, TIME_BRIDGE_KEY, 0);
  const brickCount = useBridgeValue<number>(bridge, BRICK_COUNT_BRIDGE_KEY, 0);
  const maps = useBridgeValue<MapListEntry[]>(bridge, MAP_LIST_BRIDGE_KEY, []);
  const selectedMap = useBridgeValue<MapId | null>(bridge, MAP_SELECTED_BRIDGE_KEY, null);
  const resources = useBridgeValue<ResourceAmountPayload[]>(
    bridge,
    RESOURCE_TOTALS_BRIDGE_KEY,
    []
  );

  const formatted = useMemo(() => formatTime(timePlayed), [timePlayed]);
  const canStart = maps.length > 0 && selectedMap !== null;

  return (
    <div className="map-select-screen">
      <div className="map-select-main">
        <header className="map-select-header">
          <h1>Command Center</h1>
          <div className="map-select-tabs">
            <button
              type="button"
              className={`map-select-tab${activeTab === "maps" ? " is-active" : ""}`}
              onClick={() => setActiveTab("maps")}
            >
              Map Selector
            </button>
            <button
              type="button"
              className={`map-select-tab${activeTab === "skills" ? " is-active" : ""}`}
              onClick={() => setActiveTab("skills")}
            >
              Skill Tree
            </button>
          </div>
        </header>

        <div className="map-select-panel">
          {activeTab === "maps" ? (
            <>
              <div className="map-select-stats">
                <div>
                  <span className="map-select-stats__label">Time played</span>
                  <span className="map-select-stats__value">{formatted}</span>
                </div>
                <div>
                  <span className="map-select-stats__label">Particles on map</span>
                  <span className="map-select-stats__value">{brickCount}</span>
                </div>
              </div>
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
                          <dt>Particles</dt>
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
                {maps.length === 0 && (
                  <div className="map-select-empty">No maps available yet.</div>
                )}
              </div>
              <div className="map-select-actions">
                <Button
                  onClick={() => {
                    if (!canStart) {
                      return;
                    }
                    app.restartCurrentMap();
                    onStart();
                  }}
                  disabled={!canStart}
                >
                  Start
                </Button>
                <Button onClick={onExit}>Main Menu</Button>
              </div>
            </>
          ) : (
            <SkillTreePlaceholder />
          )}
        </div>
      </div>

      <aside className="map-select-sidebar">
        <h2 className="map-select-sidebar__title">Resources</h2>
        {resources.length > 0 ? (
          <ul className="map-select-resources">
            {resources.map((resource) => (
              <li key={resource.id} className="map-select-resources__item">
                <span className="map-select-resources__name">{resource.name}</span>
                <span className="map-select-resources__value">{resource.amount}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="map-select-resources__empty">No resources collected yet.</p>
        )}
      </aside>
    </div>
  );
};
