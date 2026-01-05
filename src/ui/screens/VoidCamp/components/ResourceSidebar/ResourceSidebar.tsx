import { ResourceAmountPayload } from "@logic/modules/shared/resources/resources.module";
import { ResourceIcon } from "@ui-shared/icons/ResourceIcon";
import "./ResourceSidebar.css";
import { formatNumber } from "@ui-shared/format/number";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@ui/shared/useBridgeValue";
import { MAP_LAST_PLAYED_BRIDGE_KEY } from "@logic/modules/active-map/map/map.const";
import { getMapConfig, MapId } from "@db/maps-db";
import { useCallback } from "react";

interface ResourceSidebarProps {
  resources: ResourceAmountPayload[];
  onStart?: () => void;
}

export const ResourceSidebar: React.FC<ResourceSidebarProps> = ({ resources, onStart }) => {
  const { app, bridge } = useAppLogic();
  const lastPlayedMap = useBridgeValue(
    bridge,
    MAP_LAST_PLAYED_BRIDGE_KEY,
    null as { mapId: MapId; level: number } | null
  );

  const handleQuickStart = useCallback(() => {
    if (!lastPlayedMap) {
      return;
    }
    app.selectMap(lastPlayedMap.mapId);
    app.selectMapLevel(lastPlayedMap.mapId, lastPlayedMap.level);
    app.restartCurrentMap();
    onStart?.();
  }, [app, lastPlayedMap, onStart]);

  const mapName = lastPlayedMap ? getMapConfig(lastPlayedMap.mapId).name : null;

  return (
    <div className="resource-sidebar stack-lg">
      {resources.length > 0 ? (
        <ul className="resource-sidebar__list list-reset stack-sm">
          {resources.map((resource) => (
            <li key={resource.id} className="resource-sidebar__item surface-card">
              <ResourceIcon resourceId={resource.id} className="resource-sidebar__icon" label={resource.name} />
              <span className="resource-sidebar__value">{formatNumber(resource.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No resources collected yet.</p>
      )}
      {lastPlayedMap && mapName && (
        <button
          className="primary-button button pinned-bottom"
          onClick={handleQuickStart}
          type="button"
        >
          {mapName} ({lastPlayedMap.level})
        </button>
      )}
    </div>
  );
};
