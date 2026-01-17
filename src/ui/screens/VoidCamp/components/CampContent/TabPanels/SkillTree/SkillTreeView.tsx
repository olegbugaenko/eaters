import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import type {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import {
  SkillNodeBridgePayload,
  SkillTreeBridgePayload,
} from "@logic/modules/camp/skill-tree/skill-tree.types";
import {
  DEFAULT_SKILL_TREE_STATE,
  SKILL_TREE_STATE_BRIDGE_KEY,
  SKILL_TREE_VIEW_TRANSFORM_BRIDGE_KEY,
} from "@logic/modules/camp/skill-tree/skill-tree.const";
import type { SkillTreeModuleUiApi } from "@logic/modules/camp/skill-tree/skill-tree.types";
import {
  RESOURCE_IDS,
  ResourceId,
  createEmptyResourceStockpile,
  getResourceConfig,
} from "@db/resources-db";
import { SkillId, getSkillConfig } from "@db/skills-db";
import { getAssetUrl } from "@shared/helpers/assets.helper";
import { ResourceCostDisplay } from "@ui-shared/ResourceCostDisplay";
import { BonusEffectsPreviewList } from "@ui-shared/BonusEffectsPreviewList";
import { classNames } from "@ui-shared/classNames";
import { useResizeObserver } from "@ui-shared/useResizeObserver";
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
// Use hysteresis: larger radius for entering hover (to start wobble stop),
// smaller radius for leaving hover (to resume wobble) to prevent flickering
const HOVER_SNAP_RADIUS_ENTER = NODE_RADIUS + WOBBLE_RADIUS;
const HOVER_SNAP_RADIUS_LEAVE = NODE_RADIUS + WOBBLE_RADIUS * 0.5;
// Fixed viewport size for initial calculation (prevents jump on first render)
const INITIAL_VIEWPORT_WIDTH = 2000;
const INITIAL_VIEWPORT_HEIGHT = 2000;

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
  return getAssetUrl(`images/skills/${hasExtension ? icon : `${icon}.svg`}`);
};

/**
 * Generates a phase offset for the wobble animation based on grid position.
 * Uses linear combination with irrational-ish multipliers and offset to ensure
 * neighboring nodes have visually distinct phases without symmetry issues.
 */
const getWobblePhaseSeed = (position: { x: number; y: number }): number => {
  // Offset by 10 to break symmetry around origin (avoids sin(-x) = -sin(x) issues)
  // Use different irrational-like multipliers for x and y
  const raw = position.x  +  3*position.y + 5*position.x * position.y + 0.5*position.x * position.x + 0.3*position.y * position.y;
  return raw % (Math.PI * 2);
};

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

const getMissingResourceNames = (
  missing: Record<ResourceId, number>
): string[] =>
  RESOURCE_IDS.filter((id) => (missing[id] ?? 0) > 0).map((id) =>
    getResourceConfig(id).name.toLowerCase()
  );

export const SkillTreeView: React.FC = () => {
  const { uiApi, bridge } = useAppLogic();
  const skillTree = useBridgeValue(
    bridge,
    SKILL_TREE_STATE_BRIDGE_KEY,
    DEFAULT_SKILL_TREE_STATE
  );
  const savedViewTransform = useBridgeValue(
    bridge,
    SKILL_TREE_VIEW_TRANSFORM_BRIDGE_KEY,
    null as { scale: number; worldX: number; worldY: number } | null
  );
  const [pointerHoveredId, setPointerHoveredId] = useState<SkillId | null>(null);
  const [focusHoveredId, setFocusHoveredId] = useState<SkillId | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const previousCanvasSizeRef = useRef<{ width: number; height: number } | null>(null);
  const pendingLayoutKeyRef = useRef<string | null>(null);
  const [frozenCanvasSize, setFrozenCanvasSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
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
  const renderPositionsRef = useRef<
    Map<SkillId, { x: number; y: number }>
  >(new Map());
  const previousLayoutRef = useRef<SkillTreeLayout | null>(null);
  const layoutRef = useRef<SkillTreeLayout | null>(null);
  const edgesByNodeIdRef = useRef<Map<SkillId, SkillTreeEdge[]>>(new Map());
  const edgesByIdRef = useRef<Map<string, SkillTreeEdge>>(new Map());
  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const wobblePhaseRef = useRef<Map<SkillId, number>>(new Map());
  const lastAnimationTimestampRef = useRef<number | null>(null);
  const wobbleNodesRef = useRef<Array<{ id: SkillId; seed: number }>>([]);
  const previousLayoutKeyRef = useRef<string | null>(null);
  const skillTreeModule = useMemo(
    () => uiApi.skillTree as SkillTreeModuleUiApi,
    [uiApi.skillTree]
  );
  const [purchasedSkillId, setPurchasedSkillId] = useState<SkillId | null>(null);
  const hoveredIdRef = useRef<SkillId | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

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

  // Initialize wobble phase tracking for visible nodes
  useEffect(() => {
    const knownIds = new Set(visibleNodes.map((node) => node.id));
    visibleNodes.forEach((node) => {
      if (!wobblePhaseRef.current.has(node.id)) {
        wobblePhaseRef.current.set(node.id, 0);
      }
    });

    // Clean up phases for nodes that are no longer visible
    Array.from(wobblePhaseRef.current.keys()).forEach((id) => {
      if (!knownIds.has(id)) {
        wobblePhaseRef.current.delete(id);
      }
    });
  }, [visibleNodes]);

  const layout = useMemo(() => computeLayout(nodes), [nodes]);
  const hoveredId = pointerHoveredId ?? focusHoveredId;
  // Update ref directly instead of useEffect
  hoveredIdRef.current = hoveredId;
  layoutRef.current = layout;
  const layoutKey = useMemo(() => {
    const entries = Array.from(layout.positions.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    return entries
      .map(([id, position]) => `${id}:${position.x},${position.y}`)
      .join("|");
  }, [layout.positions]);
  const [activeLayoutKey, setActiveLayoutKey] = useState(layoutKey);

  // Compute initial view transform synchronously using fixed viewport size
  // This prevents visible jump on first render
  const initialViewTransform = useMemo(() => {
    if (layout.positions.size === 0) {
      return { scale: 0.8, offsetX: 0, offsetY: 0 };
    }

    // Find the node with position {x: 0, y: 0}
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

    const scale = 0.8;
    // Use fixed viewport size for initial calculation
    return {
      scale,
      offsetX: INITIAL_VIEWPORT_WIDTH / 2 - x * scale,
      offsetY: INITIAL_VIEWPORT_HEIGHT / 2 - y * scale,
    };
  }, [layout, visibleNodes]);

  // Use computed initial (already centered using fixed viewport size)
  const [viewTransform, setViewTransform] = useState<ViewTransform>(initialViewTransform);

  // Save viewTransform when it changes (but not during initialization)
  const saveViewTransformRef = useRef(false);
  useEffect(() => {
    if (hasInitializedViewRef.current && saveViewTransformRef.current && viewportSize.width && viewportSize.height) {
      // Convert viewport offset to world coordinates for saving
      const worldX = (viewportSize.width / 2 - viewTransform.offsetX) / viewTransform.scale;
      const worldY = (viewportSize.height / 2 - viewTransform.offsetY) / viewTransform.scale;
      skillTreeModule.setViewTransform({
        scale: viewTransform.scale,
        worldX,
        worldY,
      });
    }
  }, [viewTransform, skillTreeModule, viewportSize.width, viewportSize.height]);

  useResizeObserver(viewportRef, ({ width, height }) => {
    setViewportSize({ width, height });
  });

  useLayoutEffect(() => {
    const nextSize = {
      width: Math.max(layout.width, 360),
      height: Math.max(layout.height, 320),
    };
    const previousSize = previousCanvasSizeRef.current;

    if (
      previousSize &&
      !frozenCanvasSize &&
      (nextSize.width > previousSize.width || nextSize.height > previousSize.height)
    ) {
      setFrozenCanvasSize(previousSize);
      pendingLayoutKeyRef.current = layoutKey;
    } else if (!frozenCanvasSize && layoutKey !== activeLayoutKey) {
      setActiveLayoutKey(layoutKey);
    }

    previousCanvasSizeRef.current = nextSize;
  }, [activeLayoutKey, frozenCanvasSize, layout.height, layout.width, layoutKey]);

  useLayoutEffect(() => {
    if (!frozenCanvasSize || pendingLayoutKeyRef.current !== layoutKey) {
      return undefined;
    }

    const rafId = requestAnimationFrame(() => {
      setFrozenCanvasSize(null);
      setActiveLayoutKey(layoutKey);
      pendingLayoutKeyRef.current = null;
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [frozenCanvasSize, layoutKey]);

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
      // Find the node with position {x: 0, y: 0}
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
    setIsInitialized(true);
  }, [layout, visibleNodes, viewportSize, savedViewTransform]);

  // Update view position when viewport resizes
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

  const nodeAffordability = useMemo(() => {
    const map = new Map<SkillId, { affordable: boolean; purchasable: boolean }>();
    visibleNodes.forEach((node) => {
      map.set(node.id, { affordable: node.affordable, purchasable: node.purchasable });
    });
    return map;
  }, [visibleNodes]);

  const wobbleNodes = useMemo(() => {
    // Build a map of node positions for seed calculation
    const nodePositions = new Map(visibleNodes.map((n) => [n.id, n.position]));
    
    return Array.from(nodeAffordability.entries())
      .filter(([, value]) => value.purchasable)
      .map(([id]) => {
        // Compute seed synchronously using position (not from ref which may be stale)
        const position = nodePositions.get(id);
        const seed = position ? getWobblePhaseSeed(position) : 0;
        return { id, seed };
      });
  }, [nodeAffordability, visibleNodes]);

  const wobbleNodesCount = wobbleNodes.length;
  wobbleNodesRef.current = wobbleNodes;

  const edgesByNodeId = useMemo(() => {
    const map = new Map<SkillId, SkillTreeEdge[]>();
    layout.edges.forEach((edge) => {
      const fromEdges = map.get(edge.fromId) ?? [];
      fromEdges.push(edge);
      map.set(edge.fromId, fromEdges);
      const toEdges = map.get(edge.toId) ?? [];
      toEdges.push(edge);
      map.set(edge.toId, toEdges);
    });
    return map;
  }, [layout.edges]);

  const edgesById = useMemo(() => {
    const map = new Map<string, SkillTreeEdge>();
    layout.edges.forEach((edge) => {
      map.set(edge.id, edge);
    });
    return map;
  }, [layout.edges]);
  edgesByNodeIdRef.current = edgesByNodeId;
  edgesByIdRef.current = edgesById;

  const updateEdgePositions = useCallback((edge: SkillTreeEdge) => {
    const from =
      renderPositionsRef.current.get(edge.fromId) ?? edge.from;
    const to = renderPositionsRef.current.get(edge.toId) ?? edge.to;

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
  }, []);

  const initializeRenderPositions = useCallback(() => {
    const nextPositions = new Map<SkillId, { x: number; y: number }>();

    visibleNodes.forEach((node) => {
      const base = layout.positions.get(node.id);
      if (!base) {
        return;
      }
      nextPositions.set(node.id, { ...base });

      const element = nodeRefs.current.get(node.id);
      if (element) {
        element.style.transform = "translate3d(0px, 0px, 0) translate(-50%, -50%)";
      }
    });

    renderPositionsRef.current = nextPositions;

    layout.edges.forEach((edge) => {
      updateEdgePositions(edge);
    });
  }, [layout.edges, layout.positions, updateEdgePositions, visibleNodes]);

  const updateAnimatedPositions = useCallback(
    (timestamp: number, hoveredNodeId: SkillId | null) => {
      const lastTimestamp = lastAnimationTimestampRef.current;
      const deltaMs = lastTimestamp ? timestamp - lastTimestamp : 0;
      lastAnimationTimestampRef.current = timestamp;
      const nextPositions = renderPositionsRef.current;
      const affectedEdges = new Set<string>();

      const currentLayout = layoutRef.current;
      if (!currentLayout) {
        return;
      }

      wobbleNodesRef.current.forEach((node) => {
        const base = currentLayout.positions.get(node.id);
        if (!base) {
          return;
        }

        const shouldWobble = hoveredNodeId !== node.id;
        const currentPhase = wobblePhaseRef.current.get(node.id) ?? 0;
        const nextPhase = shouldWobble
          ? currentPhase + deltaMs * WOBBLE_SPEED
          : 0;
        wobblePhaseRef.current.set(node.id, nextPhase);
        const angle = node.seed + nextPhase;
        const offset = shouldWobble
          ? { x: Math.cos(angle) * WOBBLE_RADIUS, y: Math.sin(angle) * WOBBLE_RADIUS }
          : { x: 0, y: 0 };

        nextPositions.set(node.id, { x: base.x + offset.x, y: base.y + offset.y });

        const element = nodeRefs.current.get(node.id);
        if (element) {
          element.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0) translate(-50%, -50%)`;
        }

        const edges = edgesByNodeIdRef.current.get(node.id) ?? [];
        edges.forEach((edge) => affectedEdges.add(edge.id));
      });

      if (affectedEdges.size === 0) {
        return;
      }

      affectedEdges.forEach((edgeId) => {
        const edge = edgesByIdRef.current.get(edgeId);
        if (edge) {
          updateEdgePositions(edge);
        }
      });
    },
    [updateEdgePositions]
  );

  useEffect(() => {
    // Only reset positions when the active layout changes, not on every callback reference change
    if (previousLayoutKeyRef.current === activeLayoutKey) {
      return;
    }
    previousLayoutKeyRef.current = activeLayoutKey;
    initializeRenderPositions();
    lastAnimationTimestampRef.current = null;
  }, [initializeRenderPositions, activeLayoutKey]);

  useEffect(() => {
    if (wobbleNodesCount === 0) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return undefined;
    }

    const step = (timestamp: number) => {
      updateAnimatedPositions(timestamp, hoveredIdRef.current);
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
  }, [updateAnimatedPositions, wobbleNodesCount]);

  // Only show details for hovered node, no fallback to avoid confusion
  const activeNode = hoveredId ? visibleNodes.find((node) => node.id === hoveredId) ?? null : null;

  useEffect(() => {
    const previousLayout = previousLayoutRef.current;
    previousLayoutRef.current = layout;

    if (!hasInitializedViewRef.current || !previousLayout) {
      return;
    }

    const anchorId =
      hoveredIdRef.current ??
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
  }, [layout, visibleNodes]);

  const activeMissing = useMemo(
    () => activeNode?.missingResources ?? createEmptyResourceStockpile(),
    [activeNode]
  );
  const activeAffordable = useMemo(
    () => activeNode?.affordable ?? false,
    [activeNode]
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
        // Force React to immediately update UI with new bridge state
        flushSync(() => {
          setPurchasedSkillId(id);
        });
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
      let closestDistanceSquared = HOVER_SNAP_RADIUS_ENTER * HOVER_SNAP_RADIUS_ENTER;

      visibleNodes.forEach((node) => {
        // Use static position (without wobble) for hover detection to prevent flickering
        // when cursor is on the edge of a wobbling node
        const position = layout.positions.get(node.id);
        if (!position) {
          return;
        }
        const dx = worldX - position.x;
        const dy = worldY - position.y;
        const distanceSquared = dx * dx + dy * dy;
        
        // Use hysteresis: different thresholds for entering and leaving hover state
        // This prevents flickering when cursor is on the edge of a wobbling node
        const isCurrentlyHovered = pointerHoveredId === node.id;
        const thresholdSquared = isCurrentlyHovered
          ? HOVER_SNAP_RADIUS_LEAVE * HOVER_SNAP_RADIUS_LEAVE
          : HOVER_SNAP_RADIUS_ENTER * HOVER_SNAP_RADIUS_ENTER;
        
        if (distanceSquared <= thresholdSquared && distanceSquared <= closestDistanceSquared) {
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
    () => {
      const width = frozenCanvasSize?.width ?? Math.max(layout.width, 360);
      const height = frozenCanvasSize?.height ?? Math.max(layout.height, 320);

      return {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${viewTransform.offsetX}px, ${viewTransform.offsetY}px) scale(${viewTransform.scale})`,
        transformOrigin: "0 0",
      };
    },
    [frozenCanvasSize, layout.height, layout.width, viewTransform]
  );

  // Use base edge positions for initial render - animation updates via refs
  const renderEdges = layout.edges;
  const viewBoxWidth = Math.max(frozenCanvasSize?.width ?? layout.width, 1);
  const viewBoxHeight = Math.max(frozenCanvasSize?.height ?? layout.height, 1);

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
        <div
          className="skill-tree__canvas"
          style={{
            ...canvasStyle,
            opacity: isInitialized ? 1 : 0,
          }}
        >
            <svg
              className="skill-tree__links"
              viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
              preserveAspectRatio="xMidYMid meet"
              shapeRendering="crispEdges"
            >
          {renderEdges.map((edge) => {
            // Use base positions from layout - animation updates via refs
            const { from, to } = edge;
            // Calculate midpoint for counter label
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
              
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
                    >
                      {edge.currentLevel}/{edge.requiredLevel}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
          {visibleNodes.map((node) => {
            // Use base position from layout for left/top - wobble is applied via transform
            // by the animation frame. Don't use renderPositionsRef here to avoid double offset.
            const position = layout.positions.get(node.id);
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
              hoveredId === node.id && "skill-tree-node--active",
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
                <div className="skill-tree-node__content">
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
