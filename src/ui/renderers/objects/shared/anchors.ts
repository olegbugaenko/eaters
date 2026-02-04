import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type {
  RendererLayerAnchorConfig,
  RendererLayerJoinConfig,
} from "@shared/types/renderer.types";

export type RendererAnchorRecord = {
  id: string;
  position: SceneVector2;
};

const anchorRegistry = new Map<string, Map<string, SceneVector2>>();

const normalizeGroupId = (groupId: string | undefined): string => groupId ?? "default";

const buildRegistryKey = (instanceId: string, groupId: string | undefined): string => {
  return `${instanceId}::${normalizeGroupId(groupId)}`;
};

export const writeAnchorsForLayer = (
  instanceId: string,
  groupId: string | undefined,
  anchors: RendererAnchorRecord[]
): void => {
  if (anchors.length === 0) {
    return;
  }
  const key = buildRegistryKey(instanceId, groupId);
  const record = new Map<string, SceneVector2>();
  anchors.forEach((anchor) => {
    record.set(anchor.id, anchor.position);
  });
  anchorRegistry.set(key, record);
};

export const readAnchor = (
  instanceId: string,
  groupId: string | undefined,
  anchorId: string
): SceneVector2 | undefined => {
  return anchorRegistry.get(buildRegistryKey(instanceId, groupId))?.get(anchorId);
};

export const readAnchorsForLayer = (
  instanceId: string,
  groupId: string | undefined
): RendererAnchorRecord[] => {
  const record = anchorRegistry.get(buildRegistryKey(instanceId, groupId));
  if (!record) {
    return [];
  }
  return Array.from(record.entries()).map(([id, position]) => ({ id, position }));
};

export const mergeLayerAnchors = (
  anchors: RendererLayerAnchorConfig[] | undefined,
  connectionSlots: RendererLayerAnchorConfig[] | undefined
): RendererLayerAnchorConfig[] => {
  if (!anchors || anchors.length === 0) {
    return connectionSlots ?? [];
  }
  if (!connectionSlots || connectionSlots.length === 0) {
    return anchors;
  }
  return [...anchors, ...connectionSlots];
};

export const resolveJoinOffset = (options: {
  instanceId: string;
  join: RendererLayerJoinConfig | undefined;
  baseOffset: SceneVector2 | undefined;
}): SceneVector2 | undefined => {
  const join = options.join;
  if (!join) {
    return options.baseOffset;
  }
  const baseOffsetX = options.baseOffset?.x ?? 0;
  const baseOffsetY = options.baseOffset?.y ?? 0;
  const joinOffsetX = join.offset?.x ?? 0;
  const joinOffsetY = join.offset?.y ?? 0;
  const anchor = readAnchor(options.instanceId, join.targetGroupId, join.anchorId);
  if (!anchor) {
    return {
      x: baseOffsetX + joinOffsetX,
      y: baseOffsetY + joinOffsetY,
    };
  }
  return {
    x: anchor.x + baseOffsetX + joinOffsetX,
    y: anchor.y + baseOffsetY + joinOffsetY,
  };
};

const sampleSpineByT = (spine: SceneVector2[], t: number): SceneVector2 | null => {
  if (spine.length === 0) {
    return null;
  }
  if (spine.length === 1) {
    return spine[0] ?? null;
  }
  const clampedT = Math.max(0, Math.min(1, t));
  let totalLength = 0;
  const lengths = new Array<number>(spine.length - 1);
  for (let i = 0; i < spine.length - 1; i += 1) {
    const a = spine[i]!;
    const b = spine[i + 1]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    lengths[i] = length;
    totalLength += length;
  }
  if (totalLength <= 0) {
    return spine[0] ?? null;
  }
  let distance = clampedT * totalLength;
  for (let i = 0; i < lengths.length; i += 1) {
    const segmentLength = lengths[i] ?? 0;
    if (distance <= segmentLength || i === lengths.length - 1) {
      const a = spine[i]!;
      const b = spine[i + 1]!;
      const segmentT = segmentLength > 0 ? distance / segmentLength : 0;
      return {
        x: a.x + (b.x - a.x) * segmentT,
        y: a.y + (b.y - a.y) * segmentT,
      };
    }
    distance -= segmentLength;
  }
  return spine[spine.length - 1] ?? null;
};

export const resolveLayerAnchors = (
  anchors: RendererLayerAnchorConfig[] | undefined,
  vertices: SceneVector2[] | undefined,
  spine: SceneVector2[] | undefined,
  offset: SceneVector2 | undefined
): RendererAnchorRecord[] => {
  if (!anchors || anchors.length === 0) {
    return [];
  }
  const resolved: RendererAnchorRecord[] = [];
  const offsetX = offset?.x ?? 0;
  const offsetY = offset?.y ?? 0;
  anchors.forEach((anchor) => {
    if (anchor.mode === "vertex") {
      if (!vertices || vertices.length === 0 || typeof anchor.index !== "number") {
        return;
      }
      const vertex = vertices[anchor.index];
      if (!vertex) {
        return;
      }
      resolved.push({
        id: anchor.id,
        position: { x: vertex.x + offsetX, y: vertex.y + offsetY },
      });
      return;
    }
    if (!spine || spine.length === 0) {
      return;
    }
    let point: SceneVector2 | null = null;
    if (typeof anchor.index === "number") {
      point = spine[Math.max(0, Math.min(spine.length - 1, anchor.index))] ?? null;
    } else if (typeof anchor.t === "number") {
      point = sampleSpineByT(spine, anchor.t);
    }
    if (!point) {
      return;
    }
    resolved.push({
      id: anchor.id,
      position: { x: point.x + offsetX, y: point.y + offsetY },
    });
  });
  return resolved;
};
