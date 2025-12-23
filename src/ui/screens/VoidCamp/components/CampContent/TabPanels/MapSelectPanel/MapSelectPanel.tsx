import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { MapId, getMapConfig } from "@db/maps-db";
import { MapListEntry } from "@logic/modules/active-map/MapModule";
import { classNames } from "@shared/classNames";
import { formatNumber } from "@shared/format/number";
import { useResizeObserver } from "@shared/useResizeObserver";
import { formatDuration } from "@ui/utils/formatDuration";
import "./MapSelectPanel.css";

const CELL_SIZE_X = 200;
const CELL_SIZE_Y = 180;
const TREE_MARGIN = 120;
const DRAG_THRESHOLD = 3;
const MIN_SCALE = 0.6;
const MAX_SCALE = 2.2;
const ZOOM_SENSITIVITY = 0.0015;

interface MapTreeLayout {
  width: number;
  height: number;
  positions: Map<MapId, { x: number; y: number }>;
  edges: { id: string; from: MapId; to: MapId }[];
}

interface MapSelectPanelProps {
  maps: MapListEntry[];
  clearedLevelsTotal: number;
  selectedMap: MapId | null;
  onSelectMap: (mapId: MapId) => void;
  onSelectLevel: (mapId: MapId, level: number) => void;
  onStartMap: (mapId: MapId) => void;
}

const computeLayout = (maps: MapListEntry[]): MapTreeLayout => {
  if (maps.length === 0) {
    return { width: 0, height: 0, positions: new Map(), edges: [] };
  }

  const mapSet = new Set(maps.map((map) => map.id));
  const prerequisites = new Map<MapId, MapId[]>();

  maps.forEach((map) => {
    const config = getMapConfig(map.id);
    const deps = (config.unlockedBy ?? [])
      .filter((condition): condition is { type: "map"; id: MapId } =>
        condition.type === "map"
      )
      .map((condition) => condition.id)
      .filter((id) => mapSet.has(id));
    prerequisites.set(map.id, deps);
  });

  const depthCache = new Map<MapId, number>();
  const getDepth = (id: MapId): number => {
    const cached = depthCache.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const deps = prerequisites.get(id) ?? [];
    const depth = deps.reduce(
      (max, dep) => Math.max(max, getDepth(dep) + 1),
      0
    );
    depthCache.set(id, depth);
    return depth;
  };

  maps.forEach((map) => getDepth(map.id));

  const columns = new Map<number, MapId[]>();
  depthCache.forEach((depth, id) => {
    const list = columns.get(depth) ?? [];
    list.push(id);
    columns.set(depth, list);
  });

  const positions = new Map<MapId, { x: number; y: number }>();
  let maxColumnSize = 0;
  columns.forEach((ids) => {
    ids.sort();
    maxColumnSize = Math.max(maxColumnSize, ids.length);
  });

  columns.forEach((ids, depth) => {
    ids.forEach((id, index) => {
      positions.set(id, {
        x: TREE_MARGIN + depth * CELL_SIZE_X,
        y: TREE_MARGIN + index * CELL_SIZE_Y,
      });
    });
  });

  const maxDepth = Math.max(...Array.from(columns.keys()));
  const width = TREE_MARGIN * 2 + Math.max(maxDepth, 0) * CELL_SIZE_X;
  const height = TREE_MARGIN * 2 + Math.max(maxColumnSize - 1, 0) * CELL_SIZE_Y;

  const edges: { id: string; from: MapId; to: MapId }[] = [];
  prerequisites.forEach((deps, id) => {
    deps.forEach((dep) => {
      edges.push({ id: `${dep}->${id}`, from: dep, to: id });
    });
  });

  return { width, height, positions, edges };
};

export const MapSelectPanel: React.FC<MapSelectPanelProps> = ({
  maps,
  clearedLevelsTotal,
  selectedMap,
  onSelectMap,
  onSelectLevel,
  onStartMap,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [hoveredId, setHoveredId] = useState<MapId | null>(null);
  const [viewTransform, setViewTransform] = useState({
    scale: 0.9,
    offsetX: 0,
    offsetY: 0,
  });
  const panStateRef = useRef({
    isDown: false,
    isPanning: false,
    pointerId: null as number | null,
    lastX: 0,
    lastY: 0,
  });
  const didPanRef = useRef(false);
  const [popover, setPopover] = useState<
    | { mapId: MapId; x: number; y: number; canDecrease: boolean; canIncrease: boolean }
    | null
  >(null);

  const layout = useMemo(() => computeLayout(maps), [maps]);

  useResizeObserver(viewportRef, ({ width, height }) => {
    setViewportSize({ width, height });
    setViewTransform((current) => ({
      ...current,
      offsetX: width / 2 - layout.width / 2,
      offsetY: height / 2 - layout.height / 2,
    }));
  });

  const activeId = hoveredId ?? selectedMap ?? null;
  const activeMap = maps.find((map) => map.id === activeId) ?? null;

  const setPopoverForMap = useCallback(
    (map: MapListEntry, event: ReactPointerEvent<HTMLButtonElement>) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      const x = event.clientX - (rect?.left ?? 0);
      const y = event.clientY - (rect?.top ?? 0);
      setPopover({
        mapId: map.id,
        x,
        y,
        canDecrease: map.selectedLevel > 0,
        canIncrease: map.selectedLevel < map.currentLevel,
      });
    },
    []
  );

  const handleNodeClick = useCallback(
    (map: MapListEntry, event: ReactPointerEvent<HTMLButtonElement>) => {
      onSelectMap(map.id);
      if (didPanRef.current) {
        return;
      }
      setPopoverForMap(map, event);
    },
    [onSelectMap, setPopoverForMap]
  );

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const { pointerId, clientX, clientY } = event;
    panStateRef.current = {
      isDown: true,
      isPanning: false,
      pointerId,
      lastX: clientX,
      lastY: clientY,
    };
    didPanRef.current = false;
    (event.target as HTMLElement).setPointerCapture(pointerId);
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panStateRef.current;
    if (!state.isDown || state.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - state.lastX;
    const deltaY = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;

    if (!state.isPanning) {
      const distance = Math.hypot(deltaX, deltaY);
      if (distance < DRAG_THRESHOLD) {
        return;
      }
      state.isPanning = true;
    }

    didPanRef.current = true;
    setViewTransform((current) => ({
      ...current,
      offsetX: current.offsetX + deltaX,
      offsetY: current.offsetY + deltaY,
    }));
  }, []);

  const endPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panStateRef.current;
    if (state.pointerId !== event.pointerId) {
      return;
    }
    panStateRef.current = {
      isDown: false,
      isPanning: false,
      pointerId: null,
      lastX: 0,
      lastY: 0,
    };
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
  }, []);

  const handlePointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (panStateRef.current.pointerId !== event.pointerId) {
      return;
    }
    panStateRef.current.isDown = false;
  }, []);

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!viewportSize.width || !viewportSize.height) {
        return;
      }
      event.preventDefault();
      const zoomFactor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY);
      setViewTransform((current) => {
        const proposedScale = current.scale * zoomFactor;
        const nextScale = Math.min(Math.max(proposedScale, MIN_SCALE), MAX_SCALE);
        if (Math.abs(nextScale - current.scale) < 0.0001) {
          return current;
        }
        const focusWorldX = (viewportSize.width / 2 - current.offsetX) / current.scale;
        const focusWorldY = (viewportSize.height / 2 - current.offsetY) / current.scale;

        const offsetX = viewportSize.width / 2 - focusWorldX * nextScale;
        const offsetY = viewportSize.height / 2 - focusWorldY * nextScale;

        return {
          scale: nextScale,
          offsetX,
          offsetY,
        };
      });
    },
    [viewportSize.height, viewportSize.width]
  );

  useEffect(() => {
    setPopover((current) => {
      if (!current) {
        return null;
      }
      const map = maps.find((entry) => entry.id === current.mapId);
      if (!map) {
        return null;
      }
      return {
        ...current,
        canDecrease: map.selectedLevel > 0,
        canIncrease: map.selectedLevel < map.currentLevel,
      };
    });
  }, [maps]);

  useEffect(() => {
    if (selectedMap && hoveredId === selectedMap) {
      return;
    }
    setHoveredId((current) => (current && current === selectedMap ? null : current));
  }, [hoveredId, selectedMap]);

  const canvasStyle = useMemo(
    () => ({
      width: `${Math.max(layout.width, 360)}px`,
      height: `${Math.max(layout.height, 320)}px`,
      transform: `translate(${viewTransform.offsetX}px, ${viewTransform.offsetY}px) scale(${viewTransform.scale})`,
      transformOrigin: "0 0",
    }),
    [layout.height, layout.width, viewTransform.offsetX, viewTransform.offsetY, viewTransform.scale]
  );

  return (
    <div className="map-tree">
      <header className="map-tree__header">
        <div className="map-tree__cleared">Map Levels Cleared: {formatNumber(clearedLevelsTotal)}</div>
        <div className="map-tree__hint">Click to pick a level, double click to start.</div>
      </header>
      <div className="map-tree__body">
        <div
          ref={viewportRef}
          className="map-tree__viewport"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPan}
          onPointerCancel={handlePointerLeave}
          onPointerLeave={handlePointerLeave}
          onWheel={handleWheel}
        >
          <div className="map-tree__canvas" style={canvasStyle}>
            <svg
              className="map-tree__links"
              viewBox={`0 0 ${Math.max(layout.width, 1)} ${Math.max(layout.height, 1)}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {layout.edges.map((edge) => {
                const from = layout.positions.get(edge.from);
                const to = layout.positions.get(edge.to);
                if (!from || !to) {
                  return null;
                }
                return (
                  <line
                    key={edge.id}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className="map-tree__link"
                  />
                );
              })}
            </svg>
            {maps.map((map) => {
              const position = layout.positions.get(map.id);
              if (!position) {
                return null;
              }
              const isSelected = map.id === selectedMap;
              const nodeClasses = classNames(
                "map-tree-node",
                isSelected && "map-tree-node--active"
              );

              const initials = map.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 3);

              const handleDoubleClick = () => {
                onSelectMap(map.id);
                onStartMap(map.id);
                setPopover(null);
              };

              return (
                <button
                  key={map.id}
                  type="button"
                  className={nodeClasses}
                  style={{ left: `${position.x}px`, top: `${position.y}px` }}
                  onMouseEnter={() => setHoveredId(map.id)}
                  onMouseLeave={() => setHoveredId((current) => (current === map.id ? null : current))}
                  onClick={(event) => handleNodeClick(map, event)}
                  onDoubleClick={handleDoubleClick}
                  aria-label={`${map.name} level ${map.selectedLevel} of ${map.currentLevel}`}
                >
                  <div className="map-tree-node__levels">
                    {map.selectedLevel} / {map.currentLevel}
                  </div>
                  <div className="map-tree-node__icon">{initials}</div>
                  <div className="map-tree-node__name">{map.name}</div>
                </button>
              );
            })}
            {maps.length === 0 && (
              <div className="map-tree__empty">No maps available yet.</div>
            )}
            {popover && (
              <div
                className="map-tree__popover"
                style={{ left: `${popover.x}px`, top: `${popover.y}px` }}
              >
                <div className="map-tree__popover-level">Level {maps.find((m) => m.id === popover.mapId)?.selectedLevel ?? 0}</div>
                <div className="map-tree__popover-actions">
                  <button
                    type="button"
                    className={classNames("button", "secondary-button", "small-button")}
                    disabled={!popover.canDecrease}
                    onClick={() =>
                      onSelectLevel(
                        popover.mapId,
                        (maps.find((m) => m.id === popover.mapId)?.selectedLevel ?? 0) - 1
                      )
                    }
                  >
                    -
                  </button>
                  <button
                    type="button"
                    className={classNames("button", "secondary-button", "small-button")}
                    disabled={!popover.canIncrease}
                    onClick={() =>
                      onSelectLevel(
                        popover.mapId,
                        (maps.find((m) => m.id === popover.mapId)?.selectedLevel ?? 0) + 1
                      )
                    }
                  >
                    +
                  </button>
                </div>
                <button type="button" className="button primary-button" onClick={() => onStartMap(popover.mapId)}>
                  Start
                </button>
              </div>
            )}
          </div>
        </div>
        <aside className="map-tree__details">
          {activeMap ? (
            <>
              <div className="map-tree__details-header">
                <h2>{activeMap.name}</h2>
                <span className="map-tree__details-level">
                  Level {activeMap.selectedLevel} / {activeMap.currentLevel}
                </span>
              </div>
              <dl className="map-tree__details-list">
                <div>
                  <dt>Size</dt>
                  <dd>
                    {activeMap.size.width} × {activeMap.size.height}
                  </dd>
                </div>
                <div>
                  <dt>Attempts</dt>
                  <dd>{activeMap.attempts}</dd>
                </div>
                <div>
                  <dt>Best Time</dt>
                  <dd>
                    {activeMap.bestTimeMs != null
                      ? formatDuration(activeMap.bestTimeMs)
                      : "—"}
                  </dd>
                </div>
              </dl>
              <div className="map-tree__details-actions">
                <button
                  type="button"
                  className={classNames("button", "secondary-button")}
                  onClick={() => onSelectLevel(activeMap.id, Math.max(activeMap.selectedLevel - 1, 0))}
                >
                  Level -
                </button>
                <button
                  type="button"
                  className={classNames("button", "secondary-button")}
                  onClick={() =>
                    onSelectLevel(activeMap.id, Math.min(activeMap.selectedLevel + 1, activeMap.currentLevel))
                  }
                >
                  Level +
                </button>
                <button
                  type="button"
                  className={classNames("button", "primary-button")}
                  onClick={() => onStartMap(activeMap.id)}
                >
                  Start Map
                </button>
              </div>
            </>
          ) : (
            <div className="map-tree__details-empty">
              Hover over a map node to inspect its details.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
