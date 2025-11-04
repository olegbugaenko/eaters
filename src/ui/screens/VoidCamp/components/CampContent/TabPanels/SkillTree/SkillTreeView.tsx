import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@shared/useBridgeValue";
import {
  DEFAULT_SKILL_TREE_STATE,
  SKILL_TREE_STATE_BRIDGE_KEY,
  SkillNodeBridgePayload,
  SkillTreeBridgePayload,
} from "@logic/modules/camp/SkillTreeModule";
import {
  RESOURCE_TOTALS_BRIDGE_KEY,
  ResourceAmountPayload,
} from "@logic/modules/shared/ResourcesModule";
import {
  RESOURCE_IDS,
  ResourceId,
  ResourceStockpile,
  createEmptyResourceStockpile,
  getResourceConfig,
} from "@db/resources-db";
import { SkillId, getSkillConfig } from "@db/skills-db";
import { ResourceCostDisplay } from "@shared/ResourceCostDisplay";
import { BonusEffectsPreviewList } from "@shared/BonusEffectsPreviewList";
import { classNames } from "@shared/classNames";
import "./SkillTreeView.css";

const CELL_SIZE_X = 180;
const CELL_SIZE_Y = 170;
const TREE_MARGIN = 120;
const DRAG_THRESHOLD = 3;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const ZOOM_SENSITIVITY = 0.0015;

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface SkillTreeEdge {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  fulfilled: boolean;
}

interface SkillTreeLayout {
  width: number;
  height: number;
  positions: Map<SkillId, { x: number; y: number }>;
  edges: SkillTreeEdge[];
}

const SKILL_TREE_RESOURCES = RESOURCE_IDS.map((id) => {
  const config = getResourceConfig(id);
  return { id: config.id, label: config.name };
});

const listResources = (names: string[]): string => {
  if (names.length === 0) {
    return "";
  }
  if (names.length === 1) {
    return names[0]!;
  }
  if (names.length === 2) {
    const [first, second] = names;
    return `${first!} and ${second!}`;
  }
  const last = names[names.length - 1]!;
  const others = names.slice(0, -1).map((name) => name!);
  return `${others.join(", ")}, and ${last}`;
};

const computeLayout = (nodes: SkillNodeBridgePayload[]): SkillTreeLayout => {
  if (nodes.length === 0) {
    return {
      width: 0,
      height: 0,
      positions: new Map(),
      edges: [],
    };
  }

  const first = nodes[0];
  if (!first) {
    return {
      width: 0,
      height: 0,
      positions: new Map(),
      edges: [],
    };
  }

  let minX = first.position.x;
  let maxX = first.position.x;
  let minY = first.position.y;
  let maxY = first.position.y;

  nodes.forEach((node) => {
    minX = Math.min(minX, node.position.x);
    maxX = Math.max(maxX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxY = Math.max(maxY, node.position.y);
  });

  const width = (maxX - minX) * CELL_SIZE_X + TREE_MARGIN * 2;
  const height = (maxY - minY) * CELL_SIZE_Y + TREE_MARGIN * 2;
  const offsetX = TREE_MARGIN - minX * CELL_SIZE_X;
  const offsetY = TREE_MARGIN - minY * CELL_SIZE_Y;

  const positions = new Map<SkillId, { x: number; y: number }>();
  nodes.forEach((node) => {
    positions.set(node.id, {
      x: offsetX + node.position.x * CELL_SIZE_X,
      y: offsetY + node.position.y * CELL_SIZE_Y,
    });
  });

  const edges: SkillTreeEdge[] = [];
  nodes.forEach((node) => {
    const to = positions.get(node.id);
    if (!to) {
      return;
    }
    node.requirements.forEach((requirement) => {
      const from = positions.get(requirement.id);
      if (!from) {
        return;
      }
      edges.push({
        id: `${requirement.id}->${node.id}`,
        from,
        to,
        fulfilled: requirement.currentLevel >= requirement.requiredLevel,
      });
    });
  });

  return {
    width,
    height,
    positions,
    edges,
  };
};

const toTotalsMap = (totals: ResourceAmountPayload[]): Record<ResourceId, number> => {
  const map = createEmptyResourceStockpile();
  totals.forEach((resource) => {
    const id = resource.id as ResourceId;
    map[id] = resource.amount;
  });
  return map;
};

const computeMissing = (
  cost: ResourceStockpile | null,
  totals: Record<ResourceId, number>
): Record<ResourceId, number> => {
  const missing = createEmptyResourceStockpile();
  if (!cost) {
    return missing;
  }
  RESOURCE_IDS.forEach((id) => {
    const required = cost[id] ?? 0;
    const available = totals[id] ?? 0;
    missing[id] = Math.max(required - available, 0);
  });
  return missing;
};

const canAffordCost = (
  cost: ResourceStockpile | null,
  totals: Record<ResourceId, number>
): boolean => {
  if (!cost) {
    return false;
  }
  return RESOURCE_IDS.every((id) => (totals[id] ?? 0) >= (cost[id] ?? 0));
};

const getMissingResourceNames = (
  missing: Record<ResourceId, number>
): string[] =>
  RESOURCE_IDS.filter((id) => (missing[id] ?? 0) > 0).map((id) =>
    getResourceConfig(id).name.toLowerCase()
  );

export const SkillTreeView: React.FC = () => {
  const { app, bridge } = useAppLogic();
  const skillTree = useBridgeValue<SkillTreeBridgePayload>(
    bridge,
    SKILL_TREE_STATE_BRIDGE_KEY,
    DEFAULT_SKILL_TREE_STATE
  );
  const totals = useBridgeValue<ResourceAmountPayload[]>(
    bridge,
    RESOURCE_TOTALS_BRIDGE_KEY,
    []
  );
  const [hoveredId, setHoveredId] = useState<SkillId | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef({
    isDown: false,
    isPanning: false,
    pointerId: null as number | null,
    lastX: 0,
    lastY: 0,
  });
  const didPanRef = useRef(false);
  const hasInitializedViewRef = useRef(false);
  const previousViewportSizeRef = useRef({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [viewTransform, setViewTransform] = useState<ViewTransform>({
    scale: 0.8,
    offsetX: 0,
    offsetY: 0,
  });
  const skillTreeModule = useMemo(() => app.getSkillTree(), [app]);

  const nodes = skillTree.nodes;

  useEffect(() => {
    if (hoveredId && !nodes.some((node) => node.id === hoveredId)) {
      setHoveredId(null);
    }
  }, [hoveredId, nodes]);

  const totalsMap = useMemo(() => toTotalsMap(totals), [totals]);
  const layout = useMemo(() => computeLayout(nodes), [nodes]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;
          setViewportSize({ width, height });
        }
      });
      observer.observe(element);
      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener("resize", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  useEffect(() => {
    if (hasInitializedViewRef.current) {
      return;
    }

    if (!viewportSize.width || !viewportSize.height || layout.positions.size === 0) {
      return;
    }

    const originNode = nodes.find(
      (node) => node.position.x === 0 && node.position.y === 0
    );
    const targetPosition = originNode
      ? layout.positions.get(originNode.id)
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
  }, [layout, nodes, viewportSize]);

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

    setViewTransform((current) => {
      const focusWorldX =
        (previousSize.width / 2 - current.offsetX) / current.scale;
      const focusWorldY =
        (previousSize.height / 2 - current.offsetY) / current.scale;

      return {
        ...current,
        offsetX: viewportSize.width / 2 - focusWorldX * current.scale,
        offsetY: viewportSize.height / 2 - focusWorldY * current.scale,
      };
    });

    previousViewportSizeRef.current = viewportSize;
  }, [viewportSize]);

  const fallbackId: SkillId | null = nodes[0]?.id ?? null;
  const activeId = hoveredId ?? fallbackId;
  const activeNode = nodes.find((node) => node.id === activeId) ?? null;

  const activeMissing = useMemo(
    () => computeMissing(activeNode?.nextCost ?? null, totalsMap),
    [activeNode, totalsMap]
  );
  const activeAffordable = useMemo(
    () => canAffordCost(activeNode?.nextCost ?? null, totalsMap),
    [activeNode, totalsMap]
  );
  const missingResourceNames = useMemo(
    () => getMissingResourceNames(activeMissing),
    [activeMissing]
  );
  const gatherMoreHint = useMemo(() => {
    if (missingResourceNames.length === 0) {
      return "Gather more resources to upgrade.";
    }
    return `Gather more ${listResources(missingResourceNames)} to upgrade.`;
  }, [missingResourceNames]);

  const handleNodeClick = useCallback(
    (id: SkillId) => {
      skillTreeModule.tryPurchaseSkill(id);
    },
    [skillTreeModule]
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      const state = panStateRef.current;
      state.isDown = true;
      state.isPanning = false;
      state.pointerId = event.pointerId;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      didPanRef.current = false;
    },
    []
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = panStateRef.current;
      if (!state.isDown || state.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - state.lastX;
      const deltaY = event.clientY - state.lastY;

      if (!state.isPanning) {
        const distanceSquared = deltaX * deltaX + deltaY * deltaY;
        if (distanceSquared < DRAG_THRESHOLD * DRAG_THRESHOLD) {
          return;
        }

        state.isPanning = true;
        didPanRef.current = true;
        setIsDragging(true);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Ignore pointer capture errors.
        }
      }

      if (state.isPanning) {
        event.preventDefault();
        setViewTransform((current) => ({
          ...current,
          offsetX: current.offsetX + deltaX,
          offsetY: current.offsetY + deltaY,
        }));
      }

      state.lastX = event.clientX;
      state.lastY = event.clientY;
    },
    []
  );

  const endPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panStateRef.current;
    if (!state.isDown || state.pointerId !== event.pointerId) {
      return;
    }

    const wasPanning = state.isPanning;
    if (wasPanning) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore pointer capture errors.
      }
    }

    state.isDown = false;
    state.isPanning = false;
    state.pointerId = null;
    state.lastX = 0;
    state.lastY = 0;

    if (wasPanning) {
      setIsDragging(false);
      setTimeout(() => {
        didPanRef.current = false;
      }, 0);
    } else {
      didPanRef.current = false;
    }
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

        const focusWorldX =
          (viewportSize.width / 2 - current.offsetX) / current.scale;
        const focusWorldY =
          (viewportSize.height / 2 - current.offsetY) / current.scale;

        const offsetX = viewportSize.width / 2 - focusWorldX * nextScale;
        const offsetY = viewportSize.height / 2 - focusWorldY * nextScale;

        return {
          scale: nextScale,
          offsetX,
          offsetY,
        };
      });
    },
    [viewportSize]
  );

  const viewportClassName = useMemo(
    () =>
      isDragging
        ? "skill-tree__viewport skill-tree__viewport--dragging"
        : "skill-tree__viewport",
    [isDragging]
  );

  const canvasStyle = useMemo(
    () => ({
      width: `${Math.max(layout.width, 360)}px`,
      height: `${Math.max(layout.height, 320)}px`,
      transform: `translate(${viewTransform.offsetX}px, ${viewTransform.offsetY}px) scale(${viewTransform.scale})`,
      transformOrigin: "0 0",
    }),
    [layout.height, layout.width, viewTransform]
  );

  return (
    <div className="skill-tree">
      <div
        ref={viewportRef}
        className={viewportClassName}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onPointerLeave={endPan}
        onWheel={handleWheel}
      >
        <div className="skill-tree__canvas" style={canvasStyle}>
          <svg
            className="skill-tree__links"
            viewBox={`0 0 ${Math.max(layout.width, 1)} ${Math.max(layout.height, 1)}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {layout.edges.map((edge) => (
              <line
                key={edge.id}
                x1={edge.from.x}
                y1={edge.from.y}
                x2={edge.to.x}
                y2={edge.to.y}
                className={edge.fulfilled ? "skill-tree__link skill-tree__link--fulfilled" : "skill-tree__link skill-tree__link--locked"}
              />
            ))}
          </svg>
          {nodes.map((node) => {
            const position = layout.positions.get(node.id);
            if (!position) {
              return null;
            }
            const affordable = canAffordCost(node.nextCost, totalsMap);
            const locked = !node.unlocked;
            const inactive = locked || node.maxed || !affordable;
            const nodeClasses = classNames(
              "skill-tree-node",
              node.maxed && "skill-tree-node--maxed",
              node.unlocked ? "skill-tree-node--unlocked" : "skill-tree-node--locked",
              !node.maxed && node.unlocked && "skill-tree-node--available",
              !node.maxed && node.unlocked && affordable && "skill-tree-node--affordable",
              inactive && "skill-tree-node--inactive",
              activeId === node.id && "skill-tree-node--active"
            );

            return (
              <button
                key={node.id}
                type="button"
                className={nodeClasses}
                style={{ left: `${position.x}px`, top: `${position.y}px` }}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId((current) => (current === node.id ? null : current))}
                onFocus={() => setHoveredId(node.id)}
                onBlur={() => setHoveredId((current) => (current === node.id ? null : current))}
                onClick={() => {
                  if (!inactive && !didPanRef.current) {
                    handleNodeClick(node.id);
                  }
                }}
                aria-disabled={inactive}
                aria-label={`${node.name} level ${node.level} of ${node.maxLevel}`}
              >
                <div className="skill-tree-node__level">
                  {node.level} / {node.maxLevel}
                </div>
                <div className="skill-tree-node__icon">
                  {node.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </div>
              </button>
            );
          })}
          {nodes.length === 0 && (
            <div className="skill-tree__empty">No skills available yet.</div>
          )}
        </div>
      </div>
      <aside className="skill-tree__details">
        {activeNode ? (
          <>
            <div className="skill-tree__details-header">
              <h2>{activeNode.name}</h2>
              <span className="skill-tree__details-level">
                Level {activeNode.level} / {activeNode.maxLevel}
              </span>
            </div>
            <p className="skill-tree__details-description">{activeNode.description}</p>
            <div className="skill-tree__details-section">
              <h3>Bonuses</h3>
              <BonusEffectsPreviewList
                className="skill-tree__bonus-effects"
                effects={activeNode.bonusEffects}
                emptyLabel="No bonuses from this skill."
              />
            </div>
            <div className="skill-tree__details-section">
              <h3>Requirements</h3>
              {activeNode.requirements.length > 0 ? (
                <ul className="skill-tree__requirements">
                  {activeNode.requirements.map((requirement) => {
                    const config = getSkillConfig(requirement.id);
                    const met = requirement.currentLevel >= requirement.requiredLevel;
                    return (
                      <li
                        key={requirement.id}
                        className={met ? "skill-tree__requirement skill-tree__requirement--met" : "skill-tree__requirement"}
                      >
                        <span className="skill-tree__requirement-name">{config.name}</span>
                        <span className="skill-tree__requirement-level">
                          {requirement.currentLevel} / {requirement.requiredLevel}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="skill-tree__requirements-empty">No prerequisites.</div>
              )}
            </div>
            <div className="skill-tree__details-section">
              <h3>Next Level Cost</h3>
              {activeNode.maxed ? (
                <div className="skill-tree__maxed">Max level reached.</div>
              ) : activeNode.nextCost ? (
                <ResourceCostDisplay
                  className="skill-tree__details-cost"
                  cost={activeNode.nextCost}
                  missing={activeMissing}
                  resources={SKILL_TREE_RESOURCES}
                />
              ) : (
                <div className="skill-tree__requirements-empty">Meet prerequisites to reveal cost.</div>
              )}
            </div>
            {!activeNode.maxed && (
              <div className="skill-tree__hint">
                {activeNode.unlocked
                  ? activeAffordable
                    ? "Click a highlighted node to upgrade it."
                    : gatherMoreHint
                  : "Unlock prerequisites to make this upgrade available."}
              </div>
            )}
          </>
        ) : (
          <div className="skill-tree__details-empty">
            Hover over a skill node to inspect its details.
          </div>
        )}
      </aside>
    </div>
  );
};
