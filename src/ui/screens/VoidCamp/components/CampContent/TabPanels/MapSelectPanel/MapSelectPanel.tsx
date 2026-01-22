import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { MapId, getMapConfig } from "@db/maps-db";
import { getAssetUrl } from "@shared/helpers/assets.helper";
import { MapListEntry } from "@logic/modules/active-map/map/map.types";
import { classNames } from "@ui-shared/classNames";
import { formatNumber } from "@ui-shared/format/number";
import { useResizeObserver } from "@ui-shared/useResizeObserver";
import { formatDuration } from "@ui/utils/formatDuration";
import type { MapUnlockCondition } from "@shared/types/unlocks";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { MAP_SELECT_VIEW_TRANSFORM_BRIDGE_KEY } from "@logic/modules/active-map/map/map.const";
import { BonusEffectsPreviewList } from "@ui-shared/BonusEffectsPreviewList";
import type { AchievementsBridgePayload } from "@logic/modules/shared/achievements/achievements.types";
import {
  DEFAULT_NEW_UNLOCKS_STATE,
  NEW_UNLOCKS_BRIDGE_KEY,
} from "@logic/services/new-unlock-notification/new-unlock-notification.const";
import type { NewUnlockNotificationBridgeState } from "@logic/services/new-unlock-notification/new-unlock-notification.types";
import { NewUnlockWrapper } from "@ui-shared/NewUnlockWrapper";
import "./MapSelectPanel.css";
import type { MapModuleUiApi } from "@logic/modules/active-map/map/map.types";

const CELL_SIZE_X = 200;
const CELL_SIZE_Y = 180;
const TREE_MARGIN = 120;
const DRAG_THRESHOLD = 3;
const MIN_SCALE = 0.6;
const MAX_SCALE = 2.2;
const ZOOM_SENSITIVITY = 0.0015;
// Minimum canvas dimensions (must match CSS min-width/min-height)
const MIN_CANVAS_WIDTH = 2000;
const MIN_CANVAS_HEIGHT = 2000;

interface MapTreeLayout {
  width: number;
  height: number;
  positions: Map<MapId, { x: number; y: number }>;
  edges: { id: string; from: MapId; to: MapId; currentLevel: number; requiredLevel: number; fulfilled: boolean }[];
}

interface MapSelectPanelProps {
  maps: MapListEntry[];
  clearedLevelsTotal: number;
  selectedMap: MapId | null;
  achievements: AchievementsBridgePayload;
  onSelectMap: (mapId: MapId) => void;
  onSelectLevel: (mapId: MapId, level: number) => void;
  onStartMap: (mapId: MapId) => void;
}

const computeLayout = (maps: MapListEntry[]): MapTreeLayout => {
  if (maps.length === 0) {
    return { width: 0, height: 0, positions: new Map(), edges: [] };
  }

  const mapSet = new Set(maps.map((map) => map.id));
  const mapById = new Map(maps.map((map) => [map.id, map]));
  const edges: { id: string; from: MapId; to: MapId; currentLevel: number; requiredLevel: number; fulfilled: boolean }[] = [];

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

  // Calculate base dimensions from node positions
  const baseWidth = (maxX - minX) * CELL_SIZE_X + TREE_MARGIN * 2;
  const baseHeight = (maxY - minY) * CELL_SIZE_Y + TREE_MARGIN * 2;
  
  // Ensure dimensions meet minimum canvas size requirements
  const width = Math.max(baseWidth, MIN_CANVAS_WIDTH);
  const height = Math.max(baseHeight, MIN_CANVAS_HEIGHT);

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
        const requiredId = requiredMapId as MapId;
        if (mapSet.has(requiredId) && requiredLevel && requiredLevel > 0) {
          const requiredMap = mapById.get(requiredId);
          const clearedLevels = requiredMap?.clearedLevels ?? 0;
          const fulfilled = clearedLevels >= requiredLevel;
          edges.push({
            id: `${requiredId}->${map.id}`,
            from: requiredId,
            to: map.id,
            currentLevel: clearedLevels, // clearedLevels is the number of completed levels
            requiredLevel,
            fulfilled,
          });
        }
      });
    }
  });

  return { width, height, positions, edges };
};

const getMapIconPath = (icon?: string): string | null => {
  if (!icon) {
    return null;
  }
  const hasExtension = icon.includes(".");
  return getAssetUrl(`images/maps/${hasExtension ? icon : `${icon}.svg`}`);
};

export const MapSelectPanel: React.FC<MapSelectPanelProps> = ({
  maps,
  clearedLevelsTotal,
  selectedMap,
  achievements,
  onSelectMap,
  onSelectLevel,
  onStartMap,
}) => {
  const { uiApi, bridge } = useAppLogic();
  const savedViewTransform = useBridgeValue(
    bridge,
    MAP_SELECT_VIEW_TRANSFORM_BRIDGE_KEY,
    null as { scale: number; worldX: number; worldY: number } | null
  );
  const newUnlocksState = useBridgeValue(
    bridge,
    NEW_UNLOCKS_BRIDGE_KEY,
    DEFAULT_NEW_UNLOCKS_STATE as NewUnlockNotificationBridgeState
  );
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [hoveredId, setHoveredId] = useState<MapId | null>(null);
  const panStateRef = useRef({
    isDown: false,
    isPanning: false,
    pointerId: null as number | null,
    lastX: 0,
    lastY: 0,
  });
  const didPanRef = useRef(false);
  const [popover, setPopover] = useState<
    | { mapId: MapId; canDecrease: boolean; canIncrease: boolean }
    | null
  >(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const layout = useMemo(() => computeLayout(maps), [maps]);
  const mapById = useMemo(() => new Map(maps.map((map) => [map.id, map])), [maps]);
  const unseenPaths = useMemo(
    () => new Set(newUnlocksState.unseenPaths),
    [newUnlocksState.unseenPaths]
  );
  const hasInitializedViewRef = useRef(false);
  const previousViewportSizeRef = useRef({ width: 0, height: 0 });
  const popoverHoverTimeoutRef = useRef<number | null>(null);
  const previousPopoverMapIdRef = useRef<MapId | null>(null);

  // Compute initial view transform synchronously using fixed viewport size
  // This prevents visible jump on first render
  // Use saved viewTransform if available, otherwise compute centered position
  const initialViewTransform = useMemo(() => {
    if (layout.positions.size === 0) {
      return { scale: 0.9, offsetX: 0, offsetY: 0 };
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

    const scale = 0.9;
    // Use fixed viewport size for initial calculation
    return {
      scale,
      offsetX: MIN_CANVAS_WIDTH / 2 - x * scale,
      offsetY: MIN_CANVAS_HEIGHT / 2 - y * scale,
    };
  }, [layout, maps]);

  // Use saved viewTransform if available, otherwise use computed initial
  const [viewTransform, setViewTransform] = useState(initialViewTransform);

  // Save viewTransform when it changes (but not during initialization)
  const saveViewTransformRef = useRef(false);
  useEffect(() => {
    if (hasInitializedViewRef.current && saveViewTransformRef.current && viewportSize.width && viewportSize.height) {
      // Convert viewport offset to world coordinates for saving
      const worldX = (viewportSize.width / 2 - viewTransform.offsetX) / viewTransform.scale;
      const worldY = (viewportSize.height / 2 - viewTransform.offsetY) / viewTransform.scale;
      (uiApi.map as MapModuleUiApi).setMapSelectViewTransform({
        scale: viewTransform.scale,
        worldX,
        worldY,
      });
    }
  }, [viewTransform, uiApi.map, viewportSize.width, viewportSize.height]);

  useResizeObserver(viewportRef, ({ width, height }) => {
    setViewportSize({ width, height });
  });

  // Update view transform when real viewport size becomes available
  useEffect(() => {
    if (hasInitializedViewRef.current) {
      return;
    }

    if (!viewportSize.width || !viewportSize.height || layout.positions.size === 0) {
      return;
    }

    // If we have a saved viewTransform, use it to restore position
    if (savedViewTransform) {
      // Convert world coordinates to viewport offset
      const scale = savedViewTransform.scale;
      setViewTransform({
        scale,
        offsetX: viewportSize.width / 2 - savedViewTransform.worldX * scale,
        offsetY: viewportSize.height / 2 - savedViewTransform.worldY * scale,
      });
    } else {
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

      const scale = viewTransform.scale;
      setViewTransform({
        scale,
        offsetX: viewportSize.width / 2 - x * scale,
        offsetY: viewportSize.height / 2 - y * scale,
      });
    }
    previousViewportSizeRef.current = viewportSize;
    hasInitializedViewRef.current = true;
    saveViewTransformRef.current = true;
  }, [layout, maps, viewportSize, savedViewTransform]);

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

  // Clear hoveredId when popover closes (only if it was set by the popover)
  useEffect(() => {
    if (popover) {
      previousPopoverMapIdRef.current = popover.mapId;
    } else if (previousPopoverMapIdRef.current && hoveredId === previousPopoverMapIdRef.current) {
      // Only clear if hoveredId matches the closed popover's mapId
      setHoveredId(null);
      previousPopoverMapIdRef.current = null;
    }
  }, [popover, hoveredId]);

  const activeId = hoveredId ?? selectedMap ?? null;
  const activeMap = (activeId ? mapById.get(activeId) : undefined) ?? null;
  const activeAchievement = useMemo(() => {
    if (!activeMap) {
      return null;
    }
    const achievementId = getMapConfig(activeMap.id).achievementId;
    if (!achievementId) {
      return null;
    }
    return achievements.achievements.find((entry) => entry.id === achievementId) ?? null;
  }, [achievements.achievements, activeMap]);

  const setPopoverForMap = useCallback(
    (map: MapListEntry) => {
      setPopover({
        mapId: map.id,
        canDecrease: map.selectedLevel > 1,
        canIncrease: map.selectedLevel < map.currentLevel,
      });
    },
    []
  );

  const handleNodeClick = useCallback(
    (map: MapListEntry, event: ReactMouseEvent<HTMLButtonElement>) => {
      if (didPanRef.current) {
        return;
      }
      onSelectMap(map.id);
    },
    [onSelectMap]
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
    event.currentTarget.setPointerCapture(pointerId);
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
    event.currentTarget.releasePointerCapture(event.pointerId);
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
      const map = mapById.get(current.mapId);
      if (!map) {
        return null;
      }
      return {
        ...current,
        canDecrease: map.selectedLevel > 1,
        canIncrease: map.selectedLevel < map.currentLevel,
      };
    });
  }, [mapById]);

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
                // Calculate midpoint for counter label
                const midX = (from.x + to.x) / 2;
                const midY = (from.y + to.y) / 2;
                
                return (
                  <g key={edge.id}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      className={edge.fulfilled ? "map-tree__link map-tree__link--fulfilled" : "map-tree__link map-tree__link--locked"}
                    />
                    <g className="map-tree__link-counter">
                      <circle
                        cx={midX}
                        cy={midY}
                        r="20"
                        className={edge.fulfilled ? "map-tree__link-counter-bg map-tree__link-counter-bg--fulfilled" : "map-tree__link-counter-bg map-tree__link-counter-bg--locked"}
                      />
                      <text
                        x={midX}
                        y={midY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="map-tree__link-counter-text"
                      >
                        {edge.currentLevel}/{edge.requiredLevel}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
            {maps.map((map) => {
              const position = layout.positions.get(map.id);
              if (!position) {
                return null;
              }
              const isSelected = map.id === selectedMap;
              const mapConfig = getMapConfig(map.id);
              const hasAchievement = !!mapConfig.achievementId;
              
              const nodeClasses = classNames(
                "map-tree-node",
                isSelected && "map-tree-node--active",
                !map.selectable && "map-tree-node--locked",
                hasAchievement && "map-tree-node--achievement"
              );

              const getMapInitials = (name: string): string =>
                name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2);

              const initials = getMapInitials(map.name);
              const iconSrc = getMapIconPath(map.icon);

              const handleDoubleClick = () => {
                if (didPanRef.current) {
                  return;
                }
                onSelectMap(map.id);
                onStartMap(map.id);
                setPopover(null);
              };
              const unlockPath = `maps.${map.id}`;

              // Calculate progress arcs
              const nodeSize = 70; // Reduced by 10%
              const progressOffset = 0; // Inner radius of progress = outer radius of button (nodeSize/2)
              const progressRadius = nodeSize / 2 + progressOffset;
              const progressStrokeWidth = 12;
              // SVG needs to be large enough to fit the full circle including full stroke width
              // Outer radius = progressRadius + progressStrokeWidth
              const svgSize = (progressRadius + progressStrokeWidth) * 2;
              const svgCenter = svgSize / 2;
              
              // Calculate angles
              const completedLevels = map.clearedLevels; // Number of fully completed levels
              const totalLevels = map.maxLevel;
              const unlockedLevel = map.currentLevel; // Highest unlocked level

              // Check if map is maxed (all levels completed)
              const isMaxed = completedLevels >= totalLevels;

              // Each level represents 1/totalLevels of the circle
              const levelAngle = 360 / totalLevels;

              // SVG path calculations (starting from top, going clockwise)
              const startAngle = -90; // Start from top

              let completedAngle = 0;
              let currentLevelAngle = 0;
              let completedEndAngle = startAngle;
              let currentEndAngle = startAngle;

              if (isMaxed) {
                // All levels completed - full circle (use 359.999 to avoid SVG treating 360 as 0)
                completedAngle = 359.999;
                completedEndAngle = startAngle + completedAngle;
                currentEndAngle = completedEndAngle;
              } else {
                // Completed levels arc (opacity 1.0)
                const clampedCompletedLevels = Math.min(completedLevels, totalLevels);
                completedAngle = clampedCompletedLevels * levelAngle;
                completedEndAngle = startAngle + completedAngle;

                // Current level arc (opacity 0.75) - the highest unlocked level beyond completed ones
                const hasCurrentLevel = unlockedLevel > clampedCompletedLevels;
                currentLevelAngle = hasCurrentLevel ? levelAngle : 0;
                currentEndAngle = completedEndAngle + currentLevelAngle;
              }
              
              const createArc = (start: number, end: number, radius: number, center: number) => {
                if(end - start >= 359.999) {
                  end = 359.999 + start;
                }
                const startRad = (start * Math.PI) / 180;
                const endRad = (end * Math.PI) / 180;
                const x1 = center + radius * Math.cos(startRad);
                const y1 = center + radius * Math.sin(startRad);
                const x2 = center + radius * Math.cos(endRad);
                const y2 = center + radius * Math.sin(endRad);
                const largeArc = end - start > 180 ? 1 : 0;
                return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
              };
              // console.log('MP: ',startAngle, completedEndAngle, currentEndAngle);
              return (
                <div
                  key={map.id}
                  className="map-tree-node-wrapper"
                  style={{ 
                    left: `${position.x}px`, 
                    top: `${position.y}px`,
                    width: `${svgSize}px`,
                    height: `${svgSize}px`,
                  }}
                >
                  <svg
                    className="map-tree-node__progress"
                    width={svgSize}
                    height={svgSize}
                    viewBox={`0 0 ${svgSize} ${svgSize}`}
                  >
                    {/* Background arc (remaining) - only show if not maxed */}
                    {!isMaxed && (
                      <path
                        d={createArc(currentEndAngle, startAngle + 360, progressRadius + 0.5*progressStrokeWidth, svgCenter)}
                        fill="none"
                        stroke="#477A85"
                        strokeWidth={progressStrokeWidth}
                        strokeLinecap="round"
                        opacity={0.2}
                      />
                    )}
                    {/* Completed levels arc - always show if there are completed levels or if maxed */}
                    {(completedAngle > 0 || isMaxed) && (
                      <path
                        d={createArc(startAngle, completedEndAngle, progressRadius + 0.5*progressStrokeWidth, svgCenter)}
                        fill="none"
                        stroke="#87BAC5"
                        strokeWidth={progressStrokeWidth}
                        strokeLinecap="round"
                        opacity={1.0}
                      />
                    )}
                    {!isMaxed && currentLevelAngle > 0 && (
                      <path
                        d={createArc(completedEndAngle, currentEndAngle, progressRadius + 0.5*progressStrokeWidth, svgCenter)}
                        fill="none"
                        stroke="#477A85"
                        strokeWidth={progressStrokeWidth}
                        strokeLinecap="round"
                        opacity={0.75}
                      />
                    )}
                  </svg>
                  <button
                    type="button"
                    className={nodeClasses}
                    data-map-id={map.id}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}
                    onMouseEnter={() => {
                      setHoveredId(map.id);
                      setPopoverForMap(map);
                      // Clear any pending close timeout
                      if (popoverHoverTimeoutRef.current) {
                        clearTimeout(popoverHoverTimeoutRef.current);
                        popoverHoverTimeoutRef.current = null;
                      }
                    }}
                    onMouseLeave={(event) => {
                      setHoveredId((current) => (current === map.id ? null : current));
                      // Check if mouse is moving to popover
                      const relatedTarget = event.relatedTarget;
                      if (relatedTarget && relatedTarget instanceof Node && popoverRef.current?.contains(relatedTarget)) {
                        return; // Mouse is moving to popover, don't close
                      }
                      // Close popover after a small delay to allow moving to popover
                      popoverHoverTimeoutRef.current = window.setTimeout(() => {
                        setPopover(null);
                        popoverHoverTimeoutRef.current = null;
                      }, 100);
                    }}
                    disabled={!map.selectable}
                    onClick={(event) => handleNodeClick(map, event)}
                    onDoubleClick={handleDoubleClick}
                    aria-label={`${map.name} level ${map.selectedLevel} of ${map.currentLevel}`}
                  >
                    <NewUnlockWrapper
                      path={unlockPath}
                      hasNew={unseenPaths.has(unlockPath)}
                      markOnHover
                      className="new-unlock-wrapper--fill"
                    >
                      <div className="map-tree-node__level">
                        {map.selectedLevel} / {map.currentLevel}
                      </div>
                      <div className="map-tree-node__icon">
                        {iconSrc ? (
                          <img
                            src={iconSrc}
                            alt=""
                            aria-hidden="true"
                            className="map-tree-node__image"
                          />
                        ) : (
                          initials
                        )}
                      </div>
                    </NewUnlockWrapper>
                  </button>
                </div>
              );
            })}
            {maps.length === 0 && (
              <div className="map-tree__empty">No maps available yet.</div>
            )}
            {(() => {
              if (!popover) {
                return null;
              }
              const mapPosition = layout.positions.get(popover.mapId);
              if (!mapPosition) {
                return null;
              }
              const popoverMap = mapById.get(popover.mapId);
              if (!popoverMap) {
                return null;
              }
              const nodeSize = 78;
              const nodeTop = mapPosition.y - nodeSize / 2; // Top of the node
              // Position popover so its bottom aligns with node top
              // We need to measure popover height, but for now use a reasonable offset
              const popoverOffset = 8; // Gap between popover and node
              const popoverStyle = {
                left: `${mapPosition.x}px`,
                bottom: `${layout.height - nodeTop + popoverOffset}px`,
                transform: 'translateX(-50%)',
              };
              return (
                <div
                  ref={popoverRef}
                  className="map-tree__popover"
                  style={popoverStyle}
                  onMouseEnter={() => {
                    // Set hoveredId to show map details in sidebar
                    setHoveredId(popover.mapId);
                    // Clear any pending close timeout
                    if (popoverHoverTimeoutRef.current) {
                      clearTimeout(popoverHoverTimeoutRef.current);
                      popoverHoverTimeoutRef.current = null;
                    }
                  }}
                  onMouseLeave={(event) => {
                    // Check if mouse is moving to map node
                    const relatedTarget = event.relatedTarget;
                    if (relatedTarget && relatedTarget instanceof Node) {
                      const mapNode = document.querySelector(
                        `[data-map-id="${popover.mapId}"]`
                      );
                      if (
                        mapNode &&
                        (mapNode.contains(relatedTarget) || mapNode === relatedTarget)
                      ) {
                        return; // Mouse is moving to map node, don't close
                      }
                    }
                    // Close popover when leaving it
                    setPopover(null);
                  }}
                >
                  <div className={classNames(
                    "map-tree__popover-name",
                    getMapConfig(popoverMap.id).achievementId && "map-tree__popover-name--achievement"
                  )}>
                    {popoverMap.name}
                  </div>
                  <div className="map-tree__popover-level">
                    Level {popoverMap.selectedLevel} / {popoverMap.currentLevel}
                  </div>
                  <div className="map-tree__popover-actions">
                    <button
                      type="button"
                      className={classNames(
                        "button",
                        "secondary-button",
                        "small-button"
                      )}
                      disabled={!popover.canDecrease}
                      onClick={() =>
                        onSelectLevel(popover.mapId, popoverMap.selectedLevel - 1)
                      }
                    >
                      -
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "button",
                        "secondary-button",
                        "small-button"
                      )}
                      disabled={!popover.canIncrease}
                      onClick={() =>
                        onSelectLevel(popover.mapId, popoverMap.selectedLevel + 1)
                      }
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="button primary-button"
                    onClick={() => onStartMap(popover.mapId)}
                  >
                    Start
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
        <aside className="map-tree__details">
          {activeMap ? (
            <>
              <div className="map-tree__details-header">
                <h2 className={classNames(
                  getMapConfig(activeMap.id).achievementId && "map-tree__details-title--achievement"
                )}>
                  {activeMap.name}
                </h2>
                <span className="map-tree__details-level">
                  Level {activeMap.selectedLevel} / {activeMap.currentLevel}
                </span>
              </div>
              {getMapConfig(activeMap.id).achievementId && (
                <div className="map-tree__details-achievement-notice">
                  <strong>🏆 Challenge Map</strong>
                  <p>Completing levels on this map grants permanent bonuses through achievements!</p>
                </div>
              )}
              {activeAchievement ? (
                <div className="map-tree__details-achievement-bonuses">
                  <div className="map-tree__details-achievement-bonuses-title">
                    Bonus now → next level
                  </div>
                  <BonusEffectsPreviewList
                    effects={activeAchievement.bonusEffects}
                    emptyLabel="No bonuses yet."
                  />
                </div>
              ) : null}
              <div className="map-tree__details-list">
                <span className="map-tree__details-level">
                  Max. Level Available: {activeMap.maxLevel}
                </span>
                <p>Everytime you complete a level, you unlock the next level up to max level.</p>
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
                  disabled={activeMap.selectedLevel <= 1}
                  onClick={() => onSelectLevel(activeMap.id, Math.max(activeMap.selectedLevel - 1, 1))}
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
