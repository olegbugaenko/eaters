import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { MapId, getMapConfig } from "@db/maps-db";
import { MapListEntry } from "@logic/modules/active-map/MapModule";
import { classNames } from "@shared/classNames";
import { formatNumber } from "@shared/format/number";
import { useResizeObserver } from "@shared/useResizeObserver";
import { formatDuration } from "@ui/utils/formatDuration";
import type { MapUnlockCondition } from "types/unlocks";
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
  const edges: { id: string; from: MapId; to: MapId }[] = [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  // First pass: find min/max coordinates
  maps.forEach((map) => {
    const config = getMapConfig(map.id);
    const nodePos = config.nodePosition;
    minX = Math.min(minX, nodePos.x);
    maxX = Math.max(maxX, nodePos.x);
    minY = Math.min(minY, nodePos.y);
    maxY = Math.max(maxY, nodePos.y);
  });

  // Calculate offsets to normalize positions (so minX maps to TREE_MARGIN)
  const offsetX = TREE_MARGIN - minX * CELL_SIZE_X;
  const offsetY = TREE_MARGIN - minY * CELL_SIZE_Y;

  const width = (maxX - minX) * CELL_SIZE_X + TREE_MARGIN * 2;
  const height = (maxY - minY) * CELL_SIZE_Y + TREE_MARGIN * 2;

  // Second pass: calculate positions with offset
  const positions = new Map<MapId, { x: number; y: number }>();
  maps.forEach((map) => {
    const config = getMapConfig(map.id);
    const nodePos = config.nodePosition;
    positions.set(map.id, {
      x: offsetX + nodePos.x * CELL_SIZE_X,
      y: offsetY + nodePos.y * CELL_SIZE_Y,
    });

    // Build edges from mapsRequired
    if (config.mapsRequired) {
      Object.entries(config.mapsRequired).forEach(([requiredMapId, requiredLevel]) => {
        if (mapSet.has(requiredMapId as MapId) && requiredLevel > 0) {
          edges.push({
            id: `${requiredMapId}->${map.id}`,
            from: requiredMapId as MapId,
            to: map.id,
          });
        }
      });
    }
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
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const layout = useMemo(() => computeLayout(maps), [maps]);
  const hasInitializedViewRef = useRef(false);
  const previousViewportSizeRef = useRef({ width: 0, height: 0 });

  useResizeObserver(viewportRef, ({ width, height }) => {
    setViewportSize({ width, height });
  });

  // Initialize view to center on node at (0, 0) like in SkillTreeView
  useEffect(() => {
    if (hasInitializedViewRef.current) {
      return;
    }

    if (!viewportSize.width || !viewportSize.height || layout.positions.size === 0) {
      return;
    }

    // Find the map node with nodePosition {x: 0, y: 0}
    const originMap = maps.find((map) => {
      const config = getMapConfig(map.id);
      return config.nodePosition.x === 0 && config.nodePosition.y === 0;
    });
    const targetPosition = originMap
      ? layout.positions.get(originMap.id)
      : null;
    const fallbackPosition = {
      x: layout.width / 2,
      y: layout.height / 2,
    };
    const { x, y } = targetPosition ?? fallbackPosition;

    setViewTransform((current) => {
      const next = {
        ...current,
        offsetX: viewportSize.width / 2 - x * current.scale,
        offsetY: viewportSize.height / 2 - y * current.scale,
      };
      return next;
    });
    previousViewportSizeRef.current = viewportSize;
    hasInitializedViewRef.current = true;
  }, [layout, maps, viewportSize]);

  // Update view position when viewport resizes (maintain center on origin node)
  useEffect(() => {
    if (!hasInitializedViewRef.current) {
      previousViewportSizeRef.current = viewportSize;
      return;
    }

    const previousSize = previousViewportSizeRef.current;
    if (
      previousSize.width === viewportSize.width &&
      previousSize.height === viewportSize.height
    ) {
      return;
    }

    // Find the map node with nodePosition {x: 0, y: 0}
    const originMap = maps.find((map) => {
      const config = getMapConfig(map.id);
      return config.nodePosition.x === 0 && config.nodePosition.y === 0;
    });
    const targetPosition = originMap
      ? layout.positions.get(originMap.id)
      : null;
    const fallbackPosition = {
      x: layout.width / 2,
      y: layout.height / 2,
    };
    const { x, y } = targetPosition ?? fallbackPosition;

    setViewTransform((current) => {
      const focusWorldX = (previousSize.width / 2 - current.offsetX) / current.scale;
      const focusWorldY = (previousSize.height / 2 - current.offsetY) / current.scale;

      // If the focus point was the origin node, keep it centered
      const originPosition = targetPosition ?? fallbackPosition;
      const wasCenteredOnOrigin =
        Math.abs(focusWorldX - originPosition.x) < 1 &&
        Math.abs(focusWorldY - originPosition.y) < 1;

      if (wasCenteredOnOrigin) {
        return {
          ...current,
          offsetX: viewportSize.width / 2 - x * current.scale,
          offsetY: viewportSize.height / 2 - y * current.scale,
        };
      }

      // Otherwise, maintain the same world position
      return {
        ...current,
        offsetX: viewportSize.width / 2 - focusWorldX * current.scale,
        offsetY: viewportSize.height / 2 - focusWorldY * current.scale,
      };
    });

    previousViewportSizeRef.current = viewportSize;
  }, [layout, maps, viewportSize]);

  const activeId = hoveredId ?? selectedMap ?? null;
  const activeMap = maps.find((map) => map.id === activeId) ?? null;

  const setPopoverForMap = useCallback(
    (map: MapListEntry, event: ReactMouseEvent<HTMLButtonElement>) => {
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
    (map: MapListEntry, event: ReactMouseEvent<HTMLButtonElement>) => {
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

  // Close popover when clicking outside
  useEffect(() => {
    if (!popover) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setPopover(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [popover]);

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

              const getMapInitials = (name: string): string =>
                name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2);

              const initials = getMapInitials(map.name);

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
                  <div className="map-tree-node__level">
                    {map.selectedLevel} / {map.currentLevel}
                  </div>
                  <div className="map-tree-node__icon">{initials}</div>
                </button>
              );
            })}
            {maps.length === 0 && (
              <div className="map-tree__empty">No maps available yet.</div>
            )}
            {popover && (
              <div
                ref={popoverRef}
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
