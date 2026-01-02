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
} from "@logic/modules/camp/skill-tree/skill-tree.module";
import {
  RESOURCE_TOTALS_BRIDGE_KEY,
  ResourceAmountPayload,
} from "@logic/modules/shared/resources/resources.module";
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
const NODE_RADIUS = 35; // Skill node is 70px wide with a -50% translate to center it
const WOBBLE_RADIUS = 5;
const WOBBLE_SPEED = 0.003;
// Use node hit radius plus wobble amplitude so the wobble halts as soon as the
// cursor enters the node area or the wobble path around it.
const HOVER_SNAP_RADIUS = NODE_RADIUS + WOBBLE_RADIUS;

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface SkillTreeEdge {
  id: string;
  fromId: SkillId;
  toId: SkillId;
  from: { x: number; y: number };
  to: { x: number; y: number };
  fulfilled: boolean;
  currentLevel: number;
  requiredLevel: number;
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

const getSkillInitials = (name: string): string =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

const getSkillIconPath = (icon?: string): string | null => {
  if (!icon) {
    return null;
  }
  const hasExtension = icon.includes(".");
  return `/images/skills/${hasExtension ? icon : `${icon}.svg`}`;
};

const getWobblePhaseSeed = (id: SkillId): number =>
  id
    .split("")
    .reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0) * 0.001;

/**
 * Determines if a skill node should be visible based on prerequisites.
 * A node is hidden if ALL of its prerequisites have currentLevel === 0.
 * A node is visible if:
 * - It has no prerequisites, OR
 * - At least one prerequisite has currentLevel > 0
 */
const isNodeVisible = (node: SkillNodeBridgePayload): boolean => {
  // Nodes with no requirements are always visible
  if (node.requirements.length === 0) {
    return true;
  }
  // Node is visible if at least one prerequisite has any level invested
  return node.requirements.some((req) => req.currentLevel > 0);
};

const computeLayout = (nodes: SkillNodeBridgePayload[]): SkillTreeLayout => {
  // Filter to only visible nodes for layout calculations
  const visibleNodes = nodes.filter(isNodeVisible);
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

  if (visibleNodes.length === 0) {
    return {
      width: 0,
      height: 0,
      positions: new Map(),
      edges: [],
    };
  }

  const first = visibleNodes[0];
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

  visibleNodes.forEach((node) => {
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
  visibleNodes.forEach((node) => {
    positions.set(node.id, {
      x: offsetX + node.position.x * CELL_SIZE_X,
      y: offsetY + node.position.y * CELL_SIZE_Y,
    });
  });

  const edges: SkillTreeEdge[] = [];
  visibleNodes.forEach((node) => {
    const to = positions.get(node.id);
    if (!to) {
      return;
    }
    node.requirements.forEach((requirement) => {
      // Only show edges to visible prerequisite nodes
      if (!visibleNodeIds.has(requirement.id)) {
        return;
      }
      const from = positions.get(requirement.id);
      if (!from) {
        return;
      }
      edges.push({
        id: `${requirement.id}->${node.id}`,
        fromId: requirement.id,
        toId: node.id,
        from,
        to,
        fulfilled: requirement.currentLevel >= requirement.requiredLevel,
        currentLevel: requirement.currentLevel,
        requiredLevel: requirement.requiredLevel,
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
  const [pointerHoveredId, setPointerHoveredId] = useState<SkillId | null>(null);
  const [focusHoveredId, setFocusHoveredId] = useState<SkillId | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Map<SkillId, HTMLButtonElement | null>>(new Map());
  const edgeLineRefs = useRef<Map<string, SVGLineElement | null>>(new Map());
  const edgeCounterRefs = useRef<
    Map<string, { circle: SVGCircleElement | null; text: SVGTextElement | null }>
  >(new Map());
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
  const animatedOffsetsRef = useRef<Map<SkillId, { x: number; y: number }>>(new Map());
  const renderPositionsRef = useRef<
    Map<SkillId, { x: number; y: number }>
  >(new Map());
  const previousLayoutRef = useRef<SkillTreeLayout | null>(null);
  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const wobblePhaseSeedsRef = useRef<Map<SkillId, number>>(new Map());
  const skillTreeModule = useMemo(() => app.services.skillTree, [app]);
  const [purchasedSkillId, setPurchasedSkillId] = useState<SkillId | null>(null);
  const hoveredIdRef = useRef<SkillId | null>(null);

  const nodes = skillTree.nodes;
  const visibleNodes = useMemo(() => nodes.filter(isNodeVisible), [nodes]);

  useEffect(() => {
    if (pointerHoveredId && !visibleNodes.some((node) => node.id === pointerHoveredId)) {
      setPointerHoveredId(null);
    }
    if (focusHoveredId && !visibleNodes.some((node) => node.id === focusHoveredId)) {
      setFocusHoveredId(null);
    }
  }, [focusHoveredId, pointerHoveredId, visibleNodes]);

  useEffect(() => {
    visibleNodes.forEach((node) => {
      if (!wobblePhaseSeedsRef.current.has(node.id)) {
        wobblePhaseSeedsRef.current.set(node.id, getWobblePhaseSeed(node.id));
      }
    });
  }, [visibleNodes]);

  const totalsMap = useMemo(() => toTotalsMap(totals), [totals]);
  const layout = useMemo(() => computeLayout(nodes), [nodes]);
  const hoveredId = pointerHoveredId ?? focusHoveredId;
  
  useEffect(() => {
    hoveredIdRef.current = hoveredId;
  }, [hoveredId]);

  const nodeAffordability = useMemo(() => {
    const map = new Map<SkillId, { affordable: boolean; purchasable: boolean }>();
    visibleNodes.forEach((node) => {
      const affordable = canAffordCost(node.nextCost, totalsMap);
      const purchasable = node.unlocked && !node.maxed && affordable;
      map.set(node.id, { affordable, purchasable });
    });
    return map;
  }, [totalsMap, visibleNodes]);

  const wobbleNodeIds = useMemo(() => {
    const ids = new Set<SkillId>();
    nodeAffordability.forEach((value, id) => {
      if (value.purchasable) {
        ids.add(id);
      }
    });
    return ids;
  }, [nodeAffordability]);

  const updateRenderPositions = useCallback(
    (offsets: Map<SkillId, { x: number; y: number }>) => {
      const nextPositions = new Map<SkillId, { x: number; y: number }>();

      visibleNodes.forEach((node) => {
        const base = layout.positions.get(node.id);
        if (!base) {
          return;
        }

        const offset = offsets.get(node.id) ?? { x: 0, y: 0 };
        const position = { x: base.x + offset.x, y: base.y + offset.y };
        nextPositions.set(node.id, position);

        const element = nodeRefs.current.get(node.id);
        if (element) {
          element.style.setProperty("--skill-node-wobble-x", `${offset.x}px`);
          element.style.setProperty("--skill-node-wobble-y", `${offset.y}px`);
        }
      });

      renderPositionsRef.current = nextPositions;

      layout.edges.forEach((edge) => {
        const from = nextPositions.get(edge.fromId) ?? edge.from;
        const to = nextPositions.get(edge.toId) ?? edge.to;

        const line = edgeLineRefs.current.get(edge.id);
        if (line) {
          line.setAttribute("x1", `${from.x}`);
          line.setAttribute("y1", `${from.y}`);
          line.setAttribute("x2", `${to.x}`);
          line.setAttribute("y2", `${to.y}`);
        }

        const counters = edgeCounterRefs.current.get(edge.id);
        if (counters) {
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;

          counters.circle?.setAttribute("cx", `${midX}`);
          counters.circle?.setAttribute("cy", `${midY}`);
          counters.text?.setAttribute("x", `${midX}`);
          counters.text?.setAttribute("y", `${midY}`);
        }
      });
    },
    [layout.edges, layout.positions, visibleNodes]
  );

  useEffect(() => {
    const offsets = animatedOffsetsRef.current;
    offsets.clear();

    const renderStillFrame = () => {
      visibleNodes.forEach((node) => {
        offsets.set(node.id, { x: 0, y: 0 });
      });
      updateRenderPositions(offsets);
    };

    if (wobbleNodeIds.size === 0) {
      renderStillFrame();
      return undefined;
    }

    const step = (timestamp: number) => {
      const currentHoveredId = hoveredIdRef.current;
      offsets.clear();

      visibleNodes.forEach((node) => {
        const shouldWobble = wobbleNodeIds.has(node.id) && currentHoveredId !== node.id;
        if (!shouldWobble) {
          offsets.set(node.id, { x: 0, y: 0 });
          return;
        }

        const seed = wobblePhaseSeedsRef.current.get(node.id) ?? 0;
        const angle = seed + timestamp * WOBBLE_SPEED;
        offsets.set(node.id, {
          x: Math.cos(angle) * WOBBLE_RADIUS,
          y: Math.sin(angle) * WOBBLE_RADIUS,
        });
      });

      updateRenderPositions(offsets);
      animationFrameRef.current = requestAnimationFrame(step);
    };

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [updateRenderPositions, visibleNodes, wobbleNodeIds]);

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

    const originNode = visibleNodes.find(
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
  }, [layout, visibleNodes, viewportSize]);

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

  const fallbackId: SkillId | null = visibleNodes[0]?.id ?? null;
  const activeId = hoveredId ?? fallbackId;
  const activeNode = visibleNodes.find((node) => node.id === activeId) ?? null;

  useEffect(() => {
    const previousLayout = previousLayoutRef.current;
    previousLayoutRef.current = layout;

    if (!hasInitializedViewRef.current || !previousLayout) {
      return;
    }

    const anchorId =
      hoveredIdRef.current ??
      activeNode?.id ??
      visibleNodes.find((node) =>
        previousLayout.positions.has(node.id) && layout.positions.has(node.id)
      )?.id ??
      null;

    if (!anchorId) {
      return;
    }

    const previousPosition = previousLayout.positions.get(anchorId);
    const nextPosition = layout.positions.get(anchorId);

    if (!previousPosition || !nextPosition) {
      return;
    }

    const deltaX = nextPosition.x - previousPosition.x;
    const deltaY = nextPosition.y - previousPosition.y;

    if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
      return;
    }

    setViewTransform((current) => ({
      ...current,
      offsetX: current.offsetX - deltaX * current.scale,
      offsetY: current.offsetY - deltaY * current.scale,
    }));
  }, [activeNode, layout, visibleNodes]);

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
      const success = skillTreeModule.tryPurchaseSkill(id);
      if (success) {
        setPurchasedSkillId(id);
        // Reset after animation completes
        setTimeout(() => {
          setPurchasedSkillId(null);
        }, 600);
      }
    },
    [skillTreeModule]
  );

  const updatePointerHover = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "mouse") {
        return;
      }

      // Don't update hover if cursor is over a button (button's onMouseEnter handles it)
      const target = event.target as HTMLElement;
      if (target.closest("button.skill-tree-node")) {
        return;
      }

      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const worldX = (event.clientX - rect.left - viewTransform.offsetX) / viewTransform.scale;
      const worldY = (event.clientY - rect.top - viewTransform.offsetY) / viewTransform.scale;
      pointerWorldRef.current = { x: worldX, y: worldY };

      let closestId: SkillId | null = null;
      let closestDistanceSquared = HOVER_SNAP_RADIUS * HOVER_SNAP_RADIUS;

      visibleNodes.forEach((node) => {
        const position =
          renderPositionsRef.current.get(node.id) ?? layout.positions.get(node.id);
        if (!position) {
          return;
        }
        const dx = worldX - position.x;
        const dy = worldY - position.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= closestDistanceSquared) {
          closestId = node.id;
          closestDistanceSquared = distanceSquared;
        }
      });

      setPointerHoveredId(closestId);
    },
    [layout.positions, viewTransform.offsetX, viewTransform.offsetY, viewTransform.scale, visibleNodes]
  );

  const clearPointerHover = useCallback(() => {
    pointerWorldRef.current = null;
    setPointerHoveredId(null);
  }, []);

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
      if (event.pointerType === "mouse") {
        updatePointerHover(event);
      } else {
        clearPointerHover();
      }
    },
    [clearPointerHover, updatePointerHover]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = panStateRef.current;
      if (!state.isDown || state.pointerId !== event.pointerId) {
        updatePointerHover(event);
        return;
      }

      const deltaX = event.clientX - state.lastX;
      const deltaY = event.clientY - state.lastY;

      if (!state.isPanning) {
        const distanceSquared = deltaX * deltaX + deltaY * deltaY;
        if (distanceSquared < DRAG_THRESHOLD * DRAG_THRESHOLD) {
          updatePointerHover(event);
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
      } else {
        updatePointerHover(event);
      }

      state.lastX = event.clientX;
      state.lastY = event.clientY;
    },
    [updatePointerHover]
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

  const handlePointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      clearPointerHover();
      endPan(event);
    },
    [clearPointerHover, endPan]
  );

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

  const renderEdges = useMemo(
    () =>
      layout.edges.map((edge) => {
        const from = renderPositionsRef.current.get(edge.fromId) ?? edge.from;
        const to = renderPositionsRef.current.get(edge.toId) ?? edge.to;
        return { ...edge, from, to };
      }),
    [layout.edges]
  );

  return (
    <div className="skill-tree">
      <div
        ref={viewportRef}
        className={viewportClassName}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={handlePointerLeave}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
      >
        <div className="skill-tree__canvas" style={canvasStyle}>
            <svg
              className="skill-tree__links"
              viewBox={`0 0 ${Math.max(layout.width, 1)} ${Math.max(layout.height, 1)}`}
              preserveAspectRatio="xMidYMid meet"
              shapeRendering="crispEdges"
            >
          {renderEdges.map((edge) => {
            // Calculate midpoint for counter label
            const midX = (edge.from.x + edge.to.x) / 2;
            const midY = (edge.from.y + edge.to.y) / 2;
              
              return (
                <g key={edge.id}>
                  <line
                    ref={(element) => {
                      if (element) {
                        edgeLineRefs.current.set(edge.id, element);
                      } else {
                        edgeLineRefs.current.delete(edge.id);
                      }
                    }}
                    x1={edge.from.x}
                    y1={edge.from.y}
                    x2={edge.to.x}
                    y2={edge.to.y}
                    className={edge.fulfilled ? "skill-tree__link skill-tree__link--fulfilled" : "skill-tree__link skill-tree__link--locked"}
                  />
                  <g className="skill-tree__link-counter">
                    <circle
                      ref={(element) => {
                        const existing = edgeCounterRefs.current.get(edge.id) ?? {
                          circle: null,
                          text: null,
                        };

                        if (!element) {
                          const next = { ...existing, circle: null };
                          if (!next.text) {
                            edgeCounterRefs.current.delete(edge.id);
                          } else {
                            edgeCounterRefs.current.set(edge.id, next);
                          }
                          return;
                        }

                        edgeCounterRefs.current.set(edge.id, {
                          circle: element,
                          text: existing.text,
                        });
                      }}
                      cx={midX}
                      cy={midY}
                      r="16"
                      className={edge.fulfilled ? "skill-tree__link-counter-bg skill-tree__link-counter-bg--fulfilled" : "skill-tree__link-counter-bg skill-tree__link-counter-bg--locked"}
                      shapeRendering="crispEdges"
                    />
                    <text
                      ref={(element) => {
                        const existing = edgeCounterRefs.current.get(edge.id) ?? {
                          circle: null,
                          text: null,
                        };

                        if (!element) {
                          const next = { ...existing, text: null };
                          if (!next.circle) {
                            edgeCounterRefs.current.delete(edge.id);
                          } else {
                            edgeCounterRefs.current.set(edge.id, next);
                          }
                          return;
                        }

                        edgeCounterRefs.current.set(edge.id, {
                          circle: existing.circle,
                          text: element,
                        });
                      }}
                      x={midX}
                      y={midY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="skill-tree__link-counter-text"
                      textRendering="optimizeLegibility"
                      shapeRendering="crispEdges"
                    >
                      {edge.currentLevel}/{edge.requiredLevel}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
          {visibleNodes.map((node) => {
            const position =
              renderPositionsRef.current.get(node.id) ?? layout.positions.get(node.id);
            if (!position) {
              return null;
            }
            const affordability = nodeAffordability.get(node.id);
            const affordable = affordability?.affordable ?? false;
            const locked = !node.unlocked;
            const inactive = locked || node.maxed || !affordable;
            const nodeClasses = classNames(
              "skill-tree-node",
              node.maxed && "skill-tree-node--maxed",
              node.unlocked ? "skill-tree-node--unlocked" : "skill-tree-node--locked",
              !node.maxed && node.unlocked && "skill-tree-node--available",
              !node.maxed && node.unlocked && affordable && "skill-tree-node--affordable",
              inactive && "skill-tree-node--inactive",
              activeId === node.id && "skill-tree-node--active",
              purchasedSkillId === node.id && "skill-tree-node--purchased"
            );
            const iconSrc = getSkillIconPath(node.icon);
            const nodeInitials = getSkillInitials(node.name);

            return (
              <button
                key={node.id}
                type="button"
                className={nodeClasses}
                style={{ left: `${position.x}px`, top: `${position.y}px` }}
                ref={(element) => {
                  if (element) {
                    nodeRefs.current.set(node.id, element);
                  } else {
                    nodeRefs.current.delete(node.id);
                  }
                }}
                onMouseEnter={() => {
                  setPointerHoveredId(node.id);
                }}
                onMouseLeave={() =>
                  setPointerHoveredId((current) =>
                    current === node.id ? null : current
                  )
                }
                onFocus={() => setFocusHoveredId(node.id)}
                onBlur={() =>
                  setFocusHoveredId((current) =>
                    current === node.id ? null : current
                  )
                }
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
                  {iconSrc ? (
                    <img
                      src={iconSrc}
                      alt=""
                      aria-hidden="true"
                      className="skill-tree-node__image"
                    />
                  ) : (
                    nodeInitials
                  )}
                </div>
              </button>
            );
          })}
          {visibleNodes.length === 0 && (
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
