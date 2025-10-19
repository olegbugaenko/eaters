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

  private staticData: Float32Array | null = null;
  private dynamicData: Float32Array | null = null;

  private staticVertexCount = 0;
  private dynamicVertexCount = 0;

  private staticDirty = false;
  private dynamicLayoutDirty = false;
  private pendingDynamicUpdates: DynamicBufferUpdate[] = [];
  private lastDynamicRebuildMs = 0;
  private static readonly DYNAMIC_REBUILD_COOLDOWN_MS = 200;

  // Stats
  private dynamicBytesAllocated = 0;
  private dynamicReallocations = 0;
  private dynamicBytesByType = new Map<string, number>();
  private dynamicCountByType = new Map<string, number>();

  constructor(private readonly renderers: Map<string, ObjectRenderer>) {}

  public bootstrap(instances: readonly SceneObjectInstance[]): void {
    instances.forEach((instance) => {
      if (this.objects.has(instance.id)) {
        return;
      }
      this.registerObject(instance);
    });
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
      const now = Date.now();
      if (now - this.lastDynamicRebuildMs >= ObjectsRendererManager.DYNAMIC_REBUILD_COOLDOWN_MS) {
        this.rebuildDynamicData();
        this.lastDynamicRebuildMs = now;
        result.dynamicData = this.dynamicData;
      } else if (this.pendingDynamicUpdates.length > 0) {
        // While layout is dirty but cooldown not expired, still stream per-primitive updates
        result.dynamicUpdates = this.pendingDynamicUpdates;
      }
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
    const items: DynamicBufferBreakdownItem[] = [];
    this.dynamicBytesByType.forEach((bytes, type) => {
      const count = this.dynamicCountByType.get(type) ?? 0;
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

  private registerObject(instance: SceneObjectInstance): void {
    const renderer = this.renderers.get(instance.type);
    if (!renderer) {
      // console.warn(`No renderer registered for object type "${instance.type}".`);
      return;
    }
    const registration = renderer.register(instance);
    const managed: ManagedObject = {
      instance: this.cloneInstance(instance),
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
  }

  private updateObject(instance: SceneObjectInstance): void {
    const managed = this.objects.get(instance.id);
    if (!managed) {
      return;
    }
    managed.instance = this.cloneInstance(instance);
    const updates = managed.renderer.update(instance, managed.registration);
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
      // Even if layout is marked dirty (some entries changed length),
      // we can continue streaming updates for entries whose length did not change.
      // Only skip when buffer is not available yet.
      if (!this.dynamicData) {
        return;
      }
      this.dynamicData.set(data, entry.offset);
      // Avoid per-update allocations: upload the same data buffer this frame
      this.pendingDynamicUpdates.push({ offset: entry.offset, data });
    });
  }

  private removeObject(id: string): void {
    const managed = this.objects.get(id);
    if (!managed) {
      return;
    }
    this.objects.delete(id);

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
    const totalLength = this.dynamicEntries.reduce(
      (sum, entry) => sum + entry.primitive.data.length,
      0
    );
    // Ensure capacity only grows when strictly necessary; keep headroom on growth
    const currentCapacity = this.dynamicData?.length ?? 0;
    const needsRealloc = totalLength > currentCapacity || !this.dynamicData;
    if (needsRealloc) {
      const newCapacity = Math.ceil(totalLength * 1.5);
      this.dynamicData = new Float32Array(Math.max(newCapacity, totalLength));
      this.dynamicReallocations += 1;
    }
    const data = this.dynamicData!;
    let offset = 0;
    this.dynamicEntries.forEach((entry) => {
      entry.offset = offset;
      entry.length = entry.primitive.data.length;
      data.set(entry.primitive.data, offset);
      offset += entry.length;
    });
    this.dynamicData = data;
    this.dynamicVertexCount = totalLength / VERTEX_COMPONENTS;
    this.dynamicLayoutDirty = false;
    this.pendingDynamicUpdates = [];

    // stats
    this.dynamicBytesAllocated = data.byteLength;

    // per-type breakdown
    this.dynamicBytesByType.clear();
    this.dynamicCountByType.clear();
    this.dynamicEntries.forEach((entry) => {
      const bytes = entry.primitive.data.length * Float32Array.BYTES_PER_ELEMENT;
      const managed = this.objects.get(entry.objectId);
      const type = managed?.instance.type ?? "unknown";
      this.dynamicBytesByType.set(type, (this.dynamicBytesByType.get(type) ?? 0) + bytes);
      this.dynamicCountByType.set(type, (this.dynamicCountByType.get(type) ?? 0) + 1);
    });
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
