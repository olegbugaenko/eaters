import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
  StaticPrimitive,
  VERTEX_COMPONENTS,
} from "./ObjectRenderer";
import {
  FILL_TYPES,
  SceneFill,
  SceneObjectInstance,
  SceneObjectManager,
  SceneStroke,
  SceneVector2,
} from "../../../logic/services/SceneObjectManager";

interface ManagedObject {
  instance: SceneObjectInstance;
  renderer: ObjectRenderer;
  registration: ObjectRegistration;
}

interface StaticEntry {
  objectId: string;
  primitive: StaticPrimitive;
}

interface DynamicEntry {
  objectId: string;
  primitive: DynamicPrimitive;
  offset: number;
  length: number;
}

export interface DynamicBufferUpdate {
  offset: number;
  data: Float32Array;
}

export interface SyncInstructions {
  staticData: Float32Array | null;
  dynamicData: Float32Array | null;
  dynamicUpdates: DynamicBufferUpdate[];
}

export interface DynamicBufferStats {
  bytesAllocated: number;
  reallocations: number;
}

export interface DynamicBufferBreakdownItem {
  type: string;
  bytes: number;
  count: number;
}

export class ObjectsRendererManager {
  private readonly objects = new Map<string, ManagedObject>();
  private readonly staticEntries: StaticEntry[] = [];
  private readonly dynamicEntries: DynamicEntry[] = [];
  private readonly dynamicEntryByPrimitive = new Map<DynamicPrimitive, DynamicEntry>();

  // Objects that need per-frame updates (e.g., time-based animations)
  private readonly autoAnimatingIds = new Set<string>();

  private staticData: Float32Array | null = null;
  private dynamicData: Float32Array | null = null;

  private staticVertexCount = 0;
  private dynamicVertexCount = 0;

  private staticDirty = false;
  private dynamicLayoutDirty = false;
  private autoAnimatingNeedsUpload = false;
  private pendingDynamicUpdates: DynamicBufferUpdate[] = [];
  private lastDynamicRebuildMs = 0;
  private static readonly DYNAMIC_REBUILD_COOLDOWN_MS = 0;

  // Stats
  private dynamicBytesAllocated = 0;
  private dynamicReallocations = 0;

  constructor(private readonly renderers: Map<string, ObjectRenderer>) {}

  public bootstrap(instances: readonly SceneObjectInstance[]): void {
    instances.forEach((instance) => {
      if (this.objects.has(instance.id)) {
        return;
      }
      this.registerObject(instance, true);
    });
  }

  public dispose(): void {
    Array.from(this.objects.keys()).forEach((id) => {
      this.removeObject(id);
    });

    this.objects.clear();
    this.autoAnimatingIds.clear();
    this.staticEntries.length = 0;
    this.dynamicEntries.length = 0;
    this.dynamicEntryByPrimitive.clear();
    this.staticData = null;
    this.dynamicData = null;
    this.staticVertexCount = 0;
    this.dynamicVertexCount = 0;
    this.staticDirty = false;
    this.dynamicLayoutDirty = false;
    this.autoAnimatingNeedsUpload = false;
    this.pendingDynamicUpdates = [];
    this.lastDynamicRebuildMs = 0;
    this.dynamicBytesAllocated = 0;
    this.dynamicReallocations = 0;
  }

  public applyChanges(
    changes: ReturnType<SceneObjectManager["flushChanges"]>
  ): void {
    changes.removed.forEach((id) => {
      this.removeObject(id);
    });
    changes.added.forEach((instance) => {
      this.addObject(instance);
    });
    changes.updated.forEach((instance) => {
      this.updateObject(instance);
    });
  }

  public applyInterpolatedPositions(positions: Map<string, SceneVector2>): void {
    if (positions.size === 0) {
      return;
    }
    let anyUpdated = false;
    positions.forEach((position, objectId) => {
      const managed = this.objects.get(objectId);
      if (!managed) {
        return;
      }
      // OPTIMIZATION: Mutate position in-place instead of creating new objects
      // Save original position to restore after update
      const originalPosition = managed.instance.data.position;
      const origX = originalPosition.x;
      const origY = originalPosition.y;
      originalPosition.x = position.x;
      originalPosition.y = position.y;
      
      const updates = managed.renderer.update(
        managed.instance,
        managed.registration
      );
      
      // Restore original position
      originalPosition.x = origX;
      originalPosition.y = origY;
      
      updates.forEach(({ primitive, data }) => {
        const entry = this.dynamicEntryByPrimitive.get(primitive);
        if (!entry || entry.length !== data.length) {
          return;
        }
        if (!this.dynamicData) {
          return;
        }
        // Update in-place, no copy needed - will do full upload at end
        this.dynamicData.set(data, entry.offset);
        anyUpdated = true;
      });
    });
    // Mark for full dynamic upload instead of many small bufferSubData calls
    if (anyUpdated && !this.dynamicLayoutDirty) {
      this.autoAnimatingNeedsUpload = true;
    }
  }

  /**
   * Updates all auto-animating objects (those with customData.autoAnimate = true).
   * Call this once per frame before consumeSyncInstructions().
   * 
   * OPTIMIZATION: Instead of pushing individual updates with data.slice() (which
   * creates new Float32Arrays every frame), we just update dynamicData in-place
   * and mark that a full dynamic buffer upload is needed.
   */
  public tickAutoAnimating(): void {
    if (this.autoAnimatingIds.size === 0) {
      return;
    }
    
    let anyUpdated = false;
    const idsToRemove: string[] = [];
    
    this.autoAnimatingIds.forEach((objectId) => {
      const managed = this.objects.get(objectId);
      if (!managed) {
        // Object was removed - defer deletion to avoid mutating during iteration
        idsToRemove.push(objectId);
        return;
      }
      
      // Trigger update using current instance (renderer will recompute based on time)
      const updates = managed.renderer.update(managed.instance, managed.registration);
      updates.forEach(({ primitive, data }) => {
        const entry = this.dynamicEntryByPrimitive.get(primitive);
        if (!entry) {
          return;
        }
        if (entry.length !== data.length) {
          entry.length = data.length;
          this.dynamicLayoutDirty = true;
          return;
        }
        if (!this.dynamicData) {
          return;
        }
        // Update in-place, no copy needed
        this.dynamicData.set(data, entry.offset);
        anyUpdated = true;
      });
    });
    
    // Clean up removed objects
    for (const id of idsToRemove) {
      this.autoAnimatingIds.delete(id);
    }
    
    // If any auto-animating objects were updated, mark for full dynamic upload
    // This is more efficient than many small bufferSubData calls
    if (anyUpdated && !this.dynamicLayoutDirty) {
      this.autoAnimatingNeedsUpload = true;
    }
  }

  public consumeSyncInstructions(): SyncInstructions {
    const result: SyncInstructions = {
      staticData: null,
      dynamicData: null,
      dynamicUpdates: [],
    };

    if (this.staticDirty) {
      this.rebuildStaticData();
      result.staticData = this.staticData;
    }

    if (this.dynamicLayoutDirty) {
      // Rebuild immediately when layout is dirty; streaming during this frame is disabled
      this.rebuildDynamicData();
      this.lastDynamicRebuildMs = Date.now();
      result.dynamicData = this.dynamicData;
    } else if (this.autoAnimatingNeedsUpload) {
      // Auto-animating objects updated in-place, upload full buffer (more efficient than many small updates)
      result.dynamicData = this.dynamicData;
      this.autoAnimatingNeedsUpload = false;
    } else if (this.pendingDynamicUpdates.length > 0) {
      result.dynamicUpdates = this.pendingDynamicUpdates;
    }

    this.pendingDynamicUpdates = [];

    return result;
  }

  public getStaticVertexCount(): number {
    return this.staticVertexCount;
  }

  public getDynamicVertexCount(): number {
    return this.dynamicVertexCount;
  }

  public getDynamicBufferStats(): DynamicBufferStats {
    return {
      bytesAllocated: this.dynamicBytesAllocated,
      reallocations: this.dynamicReallocations,
    };
  }

  public getDynamicBufferBreakdown(): DynamicBufferBreakdownItem[] {
    // OPTIMIZATION: Compute breakdown on-demand instead of every rebuild
    const bytesByType = new Map<string, number>();
    const countByType = new Map<string, number>();
    
    this.dynamicEntries.forEach((entry) => {
      const bytes = entry.primitive.data.length * Float32Array.BYTES_PER_ELEMENT;
      const managed = this.objects.get(entry.objectId);
      const type = managed?.instance.type ?? "unknown";
      bytesByType.set(type, (bytesByType.get(type) ?? 0) + bytes);
      countByType.set(type, (countByType.get(type) ?? 0) + 1);
    });
    
    const items: DynamicBufferBreakdownItem[] = [];
    bytesByType.forEach((bytes, type) => {
      const count = countByType.get(type) ?? 0;
      items.push({ type, bytes, count });
    });
    items.sort((a, b) => b.bytes - a.bytes);
    return items;
  }

  private addObject(instance: SceneObjectInstance): void {
    if (this.objects.has(instance.id)) {
      this.updateObject(instance);
      return;
    }
    this.registerObject(instance);
  }

  private registerObject(instance: SceneObjectInstance, cloneInstance = false): void {
    const renderer = this.renderers.get(instance.type);
    if (!renderer) {
      // console.warn(`No renderer registered for object type "${instance.type}".`);
      return;
    }
    const registration = renderer.register(instance);
    const storedInstance = cloneInstance ? this.cloneInstance(instance) : instance;
    const managed: ManagedObject = {
      instance: storedInstance,
      renderer,
      registration,
    };
    this.objects.set(instance.id, managed);

    registration.staticPrimitives.forEach((primitive) => {
      this.staticEntries.push({ objectId: instance.id, primitive });
    });

    if (registration.staticPrimitives.length > 0) {
      this.staticDirty = true;
    }

    registration.dynamicPrimitives.forEach((primitive) => {
      const entry: DynamicEntry = {
        objectId: instance.id,
        primitive,
        offset: 0,
        length: primitive.data.length,
      };
      this.dynamicEntries.push(entry);
      this.dynamicEntryByPrimitive.set(primitive, entry);
    });

    if (registration.dynamicPrimitives.length > 0) {
      this.dynamicLayoutDirty = true;
    }

    // Register for auto-animation if customData.autoAnimate is true
    const customData = instance.data.customData as Record<string, unknown> | undefined;
    if (customData?.autoAnimate === true) {
      this.autoAnimatingIds.add(instance.id);
    }
  }

  private updateObject(instance: SceneObjectInstance): void {
    const managed = this.objects.get(instance.id);
    if (!managed) {
      return;
    }
    managed.instance = instance;
    const updates = managed.renderer.update(instance, managed.registration);
    let anyUpdated = false;
    updates.forEach(({ primitive, data }) => {
      const entry = this.dynamicEntryByPrimitive.get(primitive);
      if (!entry) {
        return;
      }
      if (entry.length !== data.length) {
        entry.length = data.length;
        this.dynamicLayoutDirty = true;
        return;
      }
      // Continue streaming updates; offsets remain valid until rebuild happens
      if (!this.dynamicData) {
        return;
      }
      // Update in-place, no copy needed - will do full upload
      this.dynamicData.set(data, entry.offset);
      anyUpdated = true;
    });
    // Mark for full dynamic upload instead of per-update copies
    if (anyUpdated && !this.dynamicLayoutDirty) {
      this.autoAnimatingNeedsUpload = true;
    }
  }

  private removeObject(id: string): void {
    const managed = this.objects.get(id);
    if (!managed) {
      return;
    }
    this.objects.delete(id);
    this.autoAnimatingIds.delete(id);

    this.staticDirty =
      this.staticDirty || managed.registration.staticPrimitives.length > 0;
    this.dynamicLayoutDirty =
      this.dynamicLayoutDirty || managed.registration.dynamicPrimitives.length > 0;

    this.removeStaticEntries(id);
    this.removeDynamicEntries(id);

    managed.registration.dynamicPrimitives.forEach((primitive) => {
      if (typeof primitive.dispose === "function") {
        primitive.dispose();
      }
    });

    managed.renderer.remove(managed.instance, managed.registration);
  }

  private removeStaticEntries(objectId: string): void {
    for (let i = this.staticEntries.length - 1; i >= 0; i -= 1) {
      if (this.staticEntries[i]?.objectId === objectId) {
        this.staticEntries.splice(i, 1);
      }
    }
  }

  private removeDynamicEntries(objectId: string): void {
    for (let i = this.dynamicEntries.length - 1; i >= 0; i -= 1) {
      const entry = this.dynamicEntries[i];
      if (entry?.objectId === objectId) {
        this.dynamicEntryByPrimitive.delete(entry.primitive);
        this.dynamicEntries.splice(i, 1);
      }
    }
  }

  private rebuildStaticData(): void {
    const totalLength = this.staticEntries.reduce(
      (sum, entry) => sum + entry.primitive.data.length,
      0
    );
    const data = new Float32Array(totalLength);
    let offset = 0;
    this.staticEntries.forEach((entry) => {
      data.set(entry.primitive.data, offset);
      offset += entry.primitive.data.length;
    });
    this.staticData = data;
    this.staticVertexCount = this.staticData.length / VERTEX_COMPONENTS;
    this.staticDirty = false;
  }

  private rebuildDynamicData(): void {
    // OPTIMIZATION: Single pass - calculate total length and copy data in one loop
    const entries = this.dynamicEntries;
    const entriesCount = entries.length;
    
    // First pass: calculate total length (needed to check if realloc is required)
    let totalLength = 0;
    for (let i = 0; i < entriesCount; i += 1) {
      totalLength += entries[i]!.primitive.data.length;
    }
    
    // Ensure capacity only grows when strictly necessary; keep headroom on growth
    const currentCapacity = this.dynamicData?.length ?? 0;
    const needsRealloc = totalLength > currentCapacity || !this.dynamicData;
    if (needsRealloc) {
      const newCapacity = Math.ceil(totalLength * 1.5);
      this.dynamicData = new Float32Array(Math.max(newCapacity, totalLength));
      this.dynamicReallocations += 1;
    }
    
    // Second pass: copy data
    const data = this.dynamicData!;
    let offset = 0;
    for (let i = 0; i < entriesCount; i += 1) {
      const entry = entries[i]!;
      entry.offset = offset;
      entry.length = entry.primitive.data.length;
      data.set(entry.primitive.data, offset);
      offset += entry.length;
    }
    
    this.dynamicVertexCount = totalLength / VERTEX_COMPONENTS;
    this.dynamicLayoutDirty = false;
    this.pendingDynamicUpdates = [];
    this.dynamicBytesAllocated = data.byteLength;
  }

  private cloneInstance(instance: SceneObjectInstance): SceneObjectInstance {
    return {
      id: instance.id,
      type: instance.type,
      data: {
        position: { ...instance.data.position },
        size: instance.data.size ? { ...instance.data.size } : undefined,
        color: instance.data.color ? { ...instance.data.color } : undefined,
        fill: cloneFill(instance.data.fill),
        stroke: cloneStroke(instance.data.stroke),
        rotation:
          typeof instance.data.rotation === "number"
            ? instance.data.rotation
            : undefined,
      },
    };
  }
}

const cloneFill = (fill: SceneFill): SceneFill => {
  switch (fill.fillType) {
    case FILL_TYPES.SOLID:
      return {
        fillType: FILL_TYPES.SOLID,
        color: { ...fill.color },
        ...(fill.noise ? { noise: { ...fill.noise } } : {}),
      };
    case FILL_TYPES.LINEAR_GRADIENT:
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end ? { ...fill.end } : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
        ...(fill.noise ? { noise: { ...fill.noise } } : {}),
      };
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT:
      return {
        fillType: fill.fillType,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
        ...(fill.noise ? { noise: { ...fill.noise } } : {}),
      };
    default:
      return {
        fillType: FILL_TYPES.SOLID,
        color: { r: 1, g: 1, b: 1, a: 1 },
      };
  }
};

const cloneStroke = (stroke: SceneStroke | undefined): SceneStroke | undefined => {
  if (!stroke) {
    return undefined;
  }
  return {
    color: { ...stroke.color },
    width: stroke.width,
  };
};
