import {
  DynamicPrimitive,
  DynamicPrimitiveUpdate,
  ObjectRegistration,
  ObjectRenderer,
  StaticPrimitive,
  VERTEX_COMPONENTS,
} from "./ObjectRenderer";
import {
  SceneFill,
  SceneObjectInstance,
  SceneStroke,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { SceneUiApi } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { cloneStroke } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.helpers";
import { cloneSceneFill } from "@shared/helpers/scene-fill.helper";
import { TiedObjectsRegistry } from "./TiedObjectsRegistry";

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
  // Individual primitives that need per-frame updates (e.g., particle emitters)
  private readonly autoAnimatingPrimitives = new Map<DynamicPrimitive, { objectId: string }>();
  private readonly interpolatedPositions = new Map<string, SceneVector2>();
  private readonly bulletKeyToObjectId = new Map<string, string>();

  private staticData: Float32Array | null = null;
  private dynamicData: Float32Array | null = null;

  private staticVertexCount = 0;
  private dynamicVertexCount = 0;

  private staticDirty = false;
  private dynamicLayoutDirty = false;
  private autoAnimatingNeedsUpload = false;
  private pendingDynamicUpdates: DynamicBufferUpdate[] = [];
  private pendingDynamicUpdateLength = 0;
  private lastDynamicRebuildMs = 0;
  private static readonly DYNAMIC_REBUILD_COOLDOWN_MS = 0;
  private static readonly DYNAMIC_UPDATE_THRESHOLD_RATIO = 0.25;
  private static readonly DEBUG_LOG_INTERVAL_MS = 1000;

  private debugStatsEnabled = false;
  private debugFrames = 0;
  private debugLastLogMs = 0;
  private debugChanges = { added: 0, updated: 0, removed: 0 };
  private debugUpdateCallsByType = new Map<string, number>();
  private debugInterpolationsByType = new Map<string, number>();

  // Stats
  private dynamicBytesAllocated = 0;
  private dynamicReallocations = 0;

  constructor(
    private readonly renderers: Map<string, ObjectRenderer>,
    private readonly tiedObjects: TiedObjectsRegistry
  ) {}

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
    this.autoAnimatingPrimitives.clear();
    this.bulletKeyToObjectId.clear();
    this.staticEntries.length = 0;
    this.dynamicEntries.length = 0;
    this.dynamicEntryByPrimitive.clear();
    this.tiedObjects.clear();
    this.staticData = null;
    this.dynamicData = null;
    this.staticVertexCount = 0;
    this.dynamicVertexCount = 0;
    this.staticDirty = false;
    this.dynamicLayoutDirty = false;
    this.autoAnimatingNeedsUpload = false;
    this.pendingDynamicUpdates = [];
    this.pendingDynamicUpdateLength = 0;
    this.lastDynamicRebuildMs = 0;
    this.dynamicBytesAllocated = 0;
    this.dynamicReallocations = 0;
    this.resetDebugStats();
  }

  /**
   * Get all object IDs that are tied to a parent object.
   * Used for applying interpolated positions to tied children.
   */
  public getTiedChildren(parentId: string): ReadonlySet<string> | undefined {
    return this.tiedObjects.getChildren(parentId);
  }

  public applyChanges(
    changes: ReturnType<SceneUiApi["flushChanges"]>
  ): void {
    if (this.debugStatsEnabled) {
      this.debugChanges.added += changes.added.length;
      this.debugChanges.updated += changes.updated.length;
      this.debugChanges.removed += changes.removed.length;
    }
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

  public applyInterpolatedBulletPositions(
    positions: Map<string, SceneVector2>
  ): void {
    if (positions.size === 0) {
      return;
    }
    const mapped = new Map<string, SceneVector2>();
    positions.forEach((position, bulletKey) => {
      const objectId = this.bulletKeyToObjectId.get(bulletKey);
      if (!objectId) {
        return;
      }
      mapped.set(objectId, position);
    });
    if (mapped.size > 0) {
      this.applyInterpolatedPositions(mapped);
    }
  }

  public applyInterpolatedPositions(positions: Map<string, SceneVector2>): void {
    if (positions.size === 0) {
      return;
    }
    positions.forEach((position, objectId) => {
      this.interpolatedPositions.set(objectId, { x: position.x, y: position.y });
    });
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
      
      const updates = managed.renderer.updatePositionOnly(
        managed.instance,
        managed.registration
      );
      this.recordDebugUpdate(managed.instance.type);
      
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
        this.queueDynamicUpdate(entry, data);
      });
      this.recordDebugInterpolation(managed.instance.type);
    });
  }

  /**
   * Updates all auto-animating objects (those with customData.autoAnimate = true)
   * and individual primitives (those with primitive.autoAnimate = true).
   * Call this once per frame before consumeSyncInstructions().
   * 
   * OPTIMIZATION: Instead of pushing individual updates with data.slice() (which
   * creates new Float32Arrays every frame), we just update dynamicData in-place
   * and mark that a full dynamic buffer upload is needed.
   */
  public tickAutoAnimating(): void {
    const idsToRemove: string[] = [];
    const primitivesToRemove: DynamicPrimitive[] = [];
    const applyInterpolatedPosition = <T>(
      managed: ManagedObject,
      objectId: string,
      update: () => T
    ): T => {
      const interpolated = this.interpolatedPositions.get(objectId);
      if (!interpolated) {
        return update();
      }

      this.recordDebugInterpolation(managed.instance.type);
      const originalPosition = managed.instance.data.position;
      const origX = originalPosition.x;
      const origY = originalPosition.y;
      originalPosition.x = interpolated.x;
      originalPosition.y = interpolated.y;

      const result = update();

      originalPosition.x = origX;
      originalPosition.y = origY;
      return result;
    };
    
    // Update full objects with autoAnimate: true
    if (this.autoAnimatingIds.size > 0) {
      this.autoAnimatingIds.forEach((objectId) => {
        const managed = this.objects.get(objectId);
        if (!managed) {
          // Object was removed - defer deletion to avoid mutating during iteration
          idsToRemove.push(objectId);
          return;
        }
        
        // Trigger update using current instance (renderer will recompute based on time)
        const updates = applyInterpolatedPosition(managed, objectId, () =>
          managed.renderer.update(managed.instance, managed.registration)
        );
        this.recordDebugUpdate(managed.instance.type);
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
          this.queueDynamicUpdate(entry, data);
        });
      });
    }
    
    // Update individual primitives with autoAnimate: true
    if (this.autoAnimatingPrimitives.size > 0) {
      this.autoAnimatingPrimitives.forEach(({ objectId }, primitive) => {
        const managed = this.objects.get(objectId);
        if (!managed) {
          // Object was removed - defer deletion
          primitivesToRemove.push(primitive);
          return;
        }
        
        // Update only this specific primitive
        const data = applyInterpolatedPosition(managed, objectId, () =>
          primitive.update(managed.instance)
        );
        if (data) {
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
          this.queueDynamicUpdate(entry, data);
        }
      });
    }
    
    // Clean up removed objects and primitives
    for (const id of idsToRemove) {
      this.autoAnimatingIds.delete(id);
    }
    for (const primitive of primitivesToRemove) {
      this.autoAnimatingPrimitives.delete(primitive);
    }
    if (this.interpolatedPositions.size > 0) {
      this.interpolatedPositions.clear();
    }
    
  }

  public consumeSyncInstructions(): SyncInstructions {
    this.recordDebugFrame();
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
    this.pendingDynamicUpdateLength = 0;
    this.maybeLogDebugStats();

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

    // Register tied object relationship if present
    const tiedToObjectId = (instance.data.customData as { tiedToObjectId?: string } | undefined)?.tiedToObjectId;
    if (tiedToObjectId) {
      this.tiedObjects.register(instance.id, tiedToObjectId);
    }

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
      
      // Register primitive for auto-animation if it has autoAnimate flag
      if (primitive.autoAnimate === true) {
        this.autoAnimatingPrimitives.set(primitive, { objectId: instance.id });
      }
    });

    if (registration.dynamicPrimitives.length > 0) {
      this.dynamicLayoutDirty = true;
    }

    // Register for auto-animation if customData.autoAnimate is true
    const customData = instance.data.customData as Record<string, unknown> | undefined;
    if (customData?.autoAnimate === true) {
      this.autoAnimatingIds.add(instance.id);
    }
    const bulletGpuKey = customData?.bulletGpuKey;
    if (typeof bulletGpuKey === "string" && bulletGpuKey.length > 0) {
      this.bulletKeyToObjectId.set(bulletGpuKey, instance.id);
    }
  }

  private updateObject(instance: SceneObjectInstance): void {
    const managed = this.objects.get(instance.id);
    if (!managed) {
      return;
    }
    const previousInstance = managed.instance;
    const isTransformOnly = this.isTransformOnlyUpdate(previousInstance, instance);
    managed.instance = instance;
    const customData = instance.data.customData as Record<string, unknown> | undefined;
    const bulletGpuKey = customData?.bulletGpuKey;
    if (typeof bulletGpuKey === "string" && bulletGpuKey.length > 0) {
      this.bulletKeyToObjectId.set(bulletGpuKey, instance.id);
    }
    const updates = isTransformOnly
      ? managed.renderer.updatePositionOnly(instance, managed.registration)
      : managed.renderer.update(instance, managed.registration);
    this.recordDebugUpdate(managed.instance.type);
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
      this.queueDynamicUpdate(entry, data);
    });
  }

  private removeObject(id: string): void {
    const managed = this.objects.get(id);
    if (!managed) {
      return;
    }
    const customData = managed.instance.data.customData as Record<string, unknown> | undefined;
    const bulletGpuKey = customData?.bulletGpuKey;
    if (typeof bulletGpuKey === "string" && bulletGpuKey.length > 0) {
      this.bulletKeyToObjectId.delete(bulletGpuKey);
    }
    this.objects.delete(id);
    this.autoAnimatingIds.delete(id);

    // Unregister from tied objects (handles both parent and child cases)
    this.tiedObjects.unregisterChild(id);
    this.tiedObjects.unregisterParent(id);
    
    // Remove all primitives from this object from auto-animating list
    managed.registration.dynamicPrimitives.forEach((primitive) => {
      this.autoAnimatingPrimitives.delete(primitive);
    });

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
    this.pendingDynamicUpdateLength = 0;
    this.dynamicBytesAllocated = data.byteLength;
  }

  private queueDynamicUpdate(entry: DynamicEntry, data: Float32Array): void {
    if (this.dynamicLayoutDirty || this.autoAnimatingNeedsUpload || !this.dynamicData) {
      return;
    }
    const threshold =
      this.dynamicData.length *
      ObjectsRendererManager.DYNAMIC_UPDATE_THRESHOLD_RATIO;

    this.pendingDynamicUpdates.push({ offset: entry.offset, data });
    this.pendingDynamicUpdateLength += data.length;

    if (this.pendingDynamicUpdateLength >= threshold) {
      this.autoAnimatingNeedsUpload = true;
      this.pendingDynamicUpdates = [];
      this.pendingDynamicUpdateLength = 0;
    }
  }

  public setDebugStatsEnabled(enabled: boolean): void {
    if (this.debugStatsEnabled === enabled) {
      return;
    }
    this.debugStatsEnabled = enabled;
    this.resetDebugStats();
  }

  private recordDebugUpdate(type: string): void {
    if (!this.debugStatsEnabled) {
      return;
    }
    this.debugUpdateCallsByType.set(
      type,
      (this.debugUpdateCallsByType.get(type) ?? 0) + 1
    );
  }

  private recordDebugInterpolation(type: string): void {
    if (!this.debugStatsEnabled) {
      return;
    }
    this.debugInterpolationsByType.set(
      type,
      (this.debugInterpolationsByType.get(type) ?? 0) + 1
    );
  }

  private recordDebugFrame(): void {
    if (!this.debugStatsEnabled) {
      return;
    }
    this.debugFrames += 1;
  }

  private maybeLogDebugStats(nowMs: number = Date.now()): void {
    if (!this.debugStatsEnabled) {
      return;
    }
    if (this.debugLastLogMs === 0) {
      this.debugLastLogMs = nowMs;
      return;
    }
    const elapsedMs = nowMs - this.debugLastLogMs;
    if (elapsedMs < ObjectsRendererManager.DEBUG_LOG_INTERVAL_MS) {
      return;
    }
    const elapsedSec = elapsedMs / 1000;
    const frames = Math.max(this.debugFrames, 1);

    const changesPerFrame = {
      added: this.debugChanges.added / frames,
      updated: this.debugChanges.updated / frames,
      removed: this.debugChanges.removed / frames,
    };
    const changesPerSecond = {
      added: this.debugChanges.added / elapsedSec,
      updated: this.debugChanges.updated / elapsedSec,
      removed: this.debugChanges.removed / elapsedSec,
    };

    const updatesByType = Array.from(this.debugUpdateCallsByType.entries())
      .map(([type, count]) => {
        const perFrame = count / frames;
        const perSecond = count / elapsedSec;
        return `${type}: ${perFrame.toFixed(2)}/frame, ${perSecond.toFixed(2)}/s`;
      })
      .join(" | ");

    const interpolationsByType = Array.from(
      this.debugInterpolationsByType.entries()
    )
      .map(([type, count]) => {
        const perFrame = count / frames;
        const perSecond = count / elapsedSec;
        return `${type}: ${perFrame.toFixed(2)}/frame, ${perSecond.toFixed(2)}/s`;
      })
      .join(" | ");

    console.info(
      `[ObjectsRendererManager][debug] changes avg/frame a:${changesPerFrame.added.toFixed(
        2
      )} u:${changesPerFrame.updated.toFixed(
        2
      )} d:${changesPerFrame.removed.toFixed(
        2
      )} | avg/sec a:${changesPerSecond.added.toFixed(
        2
      )} u:${changesPerSecond.updated.toFixed(
        2
      )} d:${changesPerSecond.removed.toFixed(
        2
      )} | update calls: ${updatesByType || "none"} | interpolations: ${
        interpolationsByType || "none"
      }`
    );

    this.resetDebugStats();
    this.debugLastLogMs = nowMs;
  }

  private resetDebugStats(): void {
    this.debugFrames = 0;
    this.debugLastLogMs = 0;
    this.debugChanges = { added: 0, updated: 0, removed: 0 };
    this.debugUpdateCallsByType.clear();
    this.debugInterpolationsByType.clear();
  }

  private isTransformOnlyUpdate(
    previous: SceneObjectInstance,
    next: SceneObjectInstance
  ): boolean {
    if (previous.type !== next.type || previous.id !== next.id) {
      return false;
    }
    const prevData = previous.data;
    const nextData = next.data;
    const positionChanged =
      prevData.position.x !== nextData.position.x ||
      prevData.position.y !== nextData.position.y;
    const prevRotation = prevData.rotation ?? 0;
    const nextRotation = nextData.rotation ?? 0;
    const rotationChanged = prevRotation !== nextRotation;
    if (!positionChanged && !rotationChanged) {
      return false;
    }
    const sizeEqual =
      prevData.size === nextData.size ||
      (!prevData.size && !nextData.size) ||
      (prevData.size?.width === nextData.size?.width &&
        prevData.size?.height === nextData.size?.height);
    const colorEqual =
      prevData.color === nextData.color ||
      (!prevData.color && !nextData.color) ||
      (prevData.color?.r === nextData.color?.r &&
        prevData.color?.g === nextData.color?.g &&
        prevData.color?.b === nextData.color?.b &&
        (prevData.color?.a ?? 1) === (nextData.color?.a ?? 1));
    const fillEqual = prevData.fill === nextData.fill;
    const strokeEqual = prevData.stroke === nextData.stroke;
    const customDataEqual = prevData.customData === nextData.customData;
    return sizeEqual && colorEqual && fillEqual && strokeEqual && customDataEqual;
  }

  private cloneInstance(instance: SceneObjectInstance): SceneObjectInstance {
    return {
      id: instance.id,
      type: instance.type,
      data: {
        position: { ...instance.data.position },
        size: instance.data.size ? { ...instance.data.size } : undefined,
        color: instance.data.color ? { ...instance.data.color } : undefined,
        fill: cloneSceneFill(instance.data.fill),
        stroke: cloneStroke(instance.data.stroke),
        rotation:
          typeof instance.data.rotation === "number"
            ? instance.data.rotation
            : undefined,
      },
    };
  }
}
