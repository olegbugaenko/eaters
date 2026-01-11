import type {
  SceneVector2,
  SceneSize,
  SceneObjectData,
  SceneObjectInstance,
  SceneCameraState,
  SceneFill,
  SceneStroke,
  CustomDataCacheEntry,
} from "./scene-object-manager.types";
import {
  FILL_TYPES,
  DEFAULT_SIZE,
  DEFAULT_COLOR,
  MIN_MAP_SIZE,
  MAX_SCALE,
  REMOVALS_PER_FLUSH,
  REMOVAL_FLUSH_INTERVAL_MS,
} from "./scene-object-manager.const";
import {
  cloneCustomDataMutable,
  cloneCustomDataSnapshot,
  sanitizeFill,
  sanitizeColor,
  sanitizeStroke,
  createSolidFill,
  extractPrimaryColor,
  cloneStroke,
  strokesEqual,
} from "./scene-object-manager.helpers";

import { normalizeRotation } from "@shared/helpers/angle.helper";
import { clampNumber } from "@shared/helpers/numbers.helper";
import { cloneSceneFill } from "@shared/helpers/scene-fill.helper";
export class SceneObjectManager {
  private objects = new Map<string, SceneObjectInstance>();
  private ordered: SceneObjectInstance[] = [];
  private movableObjects = new Set<string>();
  private idCounter = 0;

  private customDataCache = new Map<string, CustomDataCacheEntry>();
  private strokeCache = new Map<string, SceneStroke | undefined>();

  private added = new Map<string, SceneObjectInstance>();
  private updated = new Map<string, SceneObjectInstance>();
  private removed = new Set<string>();
  // Defer removals to avoid frequent dynamic buffer reallocations in the renderer
  private pendingRemovals = new Set<string>();
  private static readonly REMOVALS_PER_FLUSH = REMOVALS_PER_FLUSH;
  private static readonly REMOVAL_FLUSH_INTERVAL_MS = REMOVAL_FLUSH_INTERVAL_MS;
  private lastRemovalFlushTimestampMs = 0;

  private mapSize: SceneSize = { width: MIN_MAP_SIZE, height: MIN_MAP_SIZE };
  private screenSize: SceneSize = { width: MIN_MAP_SIZE, height: MIN_MAP_SIZE };
  private camera: SceneCameraState = {
    position: { x: 0, y: 0 },
    viewportSize: { width: MIN_MAP_SIZE, height: MIN_MAP_SIZE },
    scale: 1,
  };

  public addObject(type: string, data: SceneObjectData): string {
    const id = `${type}-${++this.idCounter}`;
    const size = data.size ? { ...data.size } : { ...DEFAULT_SIZE };
    const fill = sanitizeFill(
      data.fill ?? (data.color ? createSolidFill(data.color) : undefined)
    );
    const color = data.color
      ? sanitizeColor(data.color)
      : extractPrimaryColor(fill);
    const stroke = sanitizeStroke(data.stroke);
    const customData =
      typeof data.customData !== "undefined"
        ? this.cloneCustomDataForInstance(id, data.customData)
        : undefined;
    const instance: SceneObjectInstance = {
      id,
      type,
      data: {
        position: { ...data.position },
        size,
        color,
        fill,
        rotation: normalizeRotation(data.rotation),
        stroke,
        customData,
      },
    };
    this.objects.set(id, instance);
    this.ordered.push(instance);
    this.added.set(id, instance);
    this.updated.delete(id);
    return id;
  }

  public markMovable(id: string): void {
    if (!this.objects.has(id)) {
      return;
    }
    this.movableObjects.add(id);
  }

  public unmarkMovable(id: string): void {
    this.movableObjects.delete(id);
  }

  public updateObject(id: string, data: SceneObjectData): void {
    const instance = this.objects.get(id);
    if (!instance) {
      return;
    }
    const previousData = instance.data;
    const previousFill = previousData.fill;

    const fill = data.fill
      ? sanitizeFill(data.fill)
      : data.color
      ? createSolidFill(data.color)
      : previousFill;
    const fillChanged = fill !== previousFill;
    const colorCandidate = data.color
      ? sanitizeColor(data.color)
      : fillChanged
      ? extractPrimaryColor(fill)
      : previousData.color;
    const color = colorCandidate ?? extractPrimaryColor(fill);
    const stroke =
      typeof data.stroke !== "undefined"
        ? sanitizeStroke(data.stroke)
        : previousData.stroke;
    const rotation =
      typeof data.rotation === "number"
        ? normalizeRotation(data.rotation)
        : typeof previousData.rotation === "number"
        ? previousData.rotation
        : 0;
    const hasCustomData = typeof data.customData !== "undefined";
    const customData = hasCustomData
      ? this.cloneCustomDataForInstance(id, data.customData)
      : previousData.customData;

    instance.data = {
      position: { ...data.position },
      size: data.size
        ? { ...data.size }
        : previousData.size ?? { ...DEFAULT_SIZE },
      color,
      fill,
      rotation,
      stroke,
      customData,
    };
    if (this.added.has(id)) {
      this.added.set(id, instance);
      return;
    }
    if (this.removed.has(id)) {
      return;
    }
    this.updated.set(id, instance);
  }

  public removeObject(id: string): void {
    const instance = this.objects.get(id);
    if (!instance) {
      return;
    }
    this.unmarkMovable(id);
    this.customDataCache.delete(id);
    this.strokeCache.delete(id);
    // Mark for deferred removal and hide immediately (alpha = 0)
    // Forcefully hide via fully transparent SOLID fill to avoid gradient artifacts
    const transparentFill: SceneFill = {
      fillType: FILL_TYPES.SOLID,
      color: { r: 0, g: 0, b: 0, a: 0 },
    };

    instance.data = {
      ...instance.data,
      fill: transparentFill,
      // hide stroke immediately to avoid visible outlines before batched removal
      stroke: undefined,
      // release any heavy customData payloads while the instance awaits removal
      customData: undefined,
    } as SceneObjectData & { fill: SceneFill; stroke?: SceneStroke };
    this.pendingRemovals.add(id);
    this.updated.set(id, instance);
  }

  public clear(): void {
    const knownIds = new Set<string>();
    for (const id of this.objects.keys()) {
      knownIds.add(id);
    }
    for (const id of this.added.keys()) {
      knownIds.add(id);
    }
    for (const id of this.updated.keys()) {
      knownIds.add(id);
    }
    for (const id of this.pendingRemovals.values()) {
      knownIds.add(id);
    }
    this.objects.clear();
    this.ordered.length = 0;
    this.movableObjects.clear();
    this.idCounter = 0;
    this.added.clear();
    this.updated.clear();
    this.pendingRemovals.clear();
    this.customDataCache.clear();
    this.strokeCache.clear();
    for (const id of knownIds) {
      this.removed.add(id);
    }
    this.resetCamera();
  }

  public getObject(id: string): SceneObjectInstance | undefined {
    return this.objects.get(id);
  }

  public getObjects(): readonly SceneObjectInstance[] {
    return this.ordered;
  }

  public getMovableObjects(): readonly SceneObjectInstance[] {
    if (this.movableObjects.size === 0) {
      return [];
    }
    const result: SceneObjectInstance[] = [];
    this.movableObjects.forEach((id) => {
      const instance = this.objects.get(id);
      if (instance) {
        result.push(instance);
      }
    });
    return result;
  }

  public forEachMovableObject(callback: (instance: SceneObjectInstance) => void): void {
    this.movableObjects.forEach((id) => {
      const instance = this.objects.get(id);
      if (instance) {
        callback(instance);
      }
    });
  }

  public getMovableObjectCount(): number {
    return this.movableObjects.size;
  }

  public flushChanges(): {
    added: SceneObjectInstance[];
    updated: SceneObjectInstance[];
    removed: string[];
  } {
    // Gradually apply removals to reduce renderer buffer reallocations
    const actuallyRemoved: string[] = [];
    const now = Date.now();
    const shouldTimeFlush =
      this.pendingRemovals.size > 0 &&
      now - this.lastRemovalFlushTimestampMs >= SceneObjectManager.REMOVAL_FLUSH_INTERVAL_MS;
    if (this.pendingRemovals.size >= SceneObjectManager.REMOVALS_PER_FLUSH || shouldTimeFlush) {
      const quota = SceneObjectManager.REMOVALS_PER_FLUSH;
      let processed = 0;
      const iterator = this.pendingRemovals.values();
      while (processed < quota) {
        const next = iterator.next();
        if (next.done) break;
        const id = next.value as string;
        this.finalizeRemoval(id, actuallyRemoved);
        processed += 1;
      }
      this.lastRemovalFlushTimestampMs = now;
    }

    const added = Array.from(this.added.values()).map((instance) =>
      this.cloneInstance(instance)
    );
    const updated = Array.from(this.updated.values()).map((instance) =>
      this.cloneInstance(instance)
    );
    const removed = actuallyRemoved.length > 0
      ? actuallyRemoved
      : Array.from(this.removed.values());

    this.added.clear();
    this.updated.clear();
    this.removed.clear();
    // Note: pendingRemovals keeps remaining ids if quota wasn't enough
    return { added, updated, removed };
  }

  public flushAllPendingRemovals(): string[] {
    if (this.pendingRemovals.size === 0) {
      return [];
    }
    const removed: string[] = [];
    for (const id of Array.from(this.pendingRemovals)) {
      this.finalizeRemoval(id, removed);
    }
    this.lastRemovalFlushTimestampMs = Date.now();
    return removed;
  }

  public getMapSize(): SceneSize {
    return { ...this.mapSize };
  }

  public setMapSize(size: SceneSize): void {
    const width = Math.max(MIN_MAP_SIZE, size.width);
    const height = Math.max(MIN_MAP_SIZE, size.height);
    if (width === this.mapSize.width && height === this.mapSize.height) {
      return;
    }
    this.mapSize = { width, height };
    const minScale = this.computeMinScale();
    if (this.camera.scale < minScale) {
      this.camera.scale = minScale;
      this.updateViewport();
      return;
    }
    this.clampCamera();
  }

  public setViewportScreenSize(width: number, height: number): void {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    this.screenSize = { width: safeWidth, height: safeHeight };
    const minScale = this.computeMinScale();
    if (this.camera.scale < minScale) {
      this.camera.scale = minScale;
    }
    this.updateViewport();
  }

  public setScale(scale: number): void {
    const limits = this.getScaleRange();
    const clamped = clampNumber(scale, limits.min, limits.max);
    if (clamped === this.camera.scale) {
      return;
    }
    this.camera.scale = clamped;
    this.updateViewport();
  }

  public getScaleRange(): { min: number; max: number } {
    const minScale = this.computeMinScale();
    return {
      min: minScale,
      max: MAX_SCALE,
    };
  }

  public getCamera(): SceneCameraState {
    return {
      position: { ...this.camera.position },
      viewportSize: { ...this.camera.viewportSize },
      scale: this.camera.scale,
    };
  }

  public setCameraPosition(x: number, y: number): void {
    const viewportWidth = this.camera.viewportSize.width;
    const viewportHeight = this.camera.viewportSize.height;
    
    let clampedX: number;
    let clampedY: number;
    
    // Якщо viewport більший за карту - центруємо (ігноруємо вхідні координати)
    if (viewportWidth >= this.mapSize.width) {
      clampedX = (this.mapSize.width - viewportWidth) / 2;
    } else {
      const maxX = this.mapSize.width - viewportWidth;
      clampedX = clampNumber(x, 0, maxX);
    }
    
    if (viewportHeight >= this.mapSize.height) {
      clampedY = (this.mapSize.height - viewportHeight) / 2;
    } else {
      const maxY = this.mapSize.height - viewportHeight;
      clampedY = clampNumber(y, 0, maxY);
    }
    
    if (clampedX === this.camera.position.x && clampedY === this.camera.position.y) {
      return;
    }
    this.camera.position = { x: clampedX, y: clampedY };
  }

  public panCamera(deltaX: number, deltaY: number): void {
    if (deltaX === 0 && deltaY === 0) {
      return;
    }
    this.setCameraPosition(this.camera.position.x + deltaX, this.camera.position.y + deltaY);
  }

  public resetCamera(): void {
    this.camera = {
      position: { x: 0, y: 0 },
      viewportSize: { ...this.camera.viewportSize },
      scale: this.camera.scale,
    };
    this.clampCamera();
  }

  private updateViewport(): void {
    const width = this.screenSize.width / this.camera.scale;
    const height = this.screenSize.height / this.camera.scale;
    this.camera = {
      ...this.camera,
      viewportSize: {
        width: Math.max(1, width),
        height: Math.max(1, height),
      },
    };
    this.clampCamera();
  }

  private computeMinScale(): number {
    const safeScreenWidth = Math.max(1, this.screenSize.width);
    const safeScreenHeight = Math.max(1, this.screenSize.height);
    const safeMapWidth = Math.max(1, this.mapSize.width);
    const safeMapHeight = Math.max(1, this.mapSize.height);
    const minScaleWidth = safeScreenWidth / safeMapWidth;
    const minScaleHeight = safeScreenHeight / safeMapHeight;
    // Use Math.min to ensure map fits in viewport without scrolling
    const minScale = Math.min(minScaleWidth, minScaleHeight);
    // Allow slightly smaller zoom (multiply by 0.75)
    return clampNumber(minScale * 0.75, 0.1, MAX_SCALE);
  }

  private finalizeRemoval(id: string, accumulator: string[]): void {
    if (!this.pendingRemovals.delete(id)) {
      return;
    }
    this.unmarkMovable(id);
    const had = this.objects.delete(id);
    if (had) {
      const index = this.ordered.findIndex((object) => object.id === id);
      if (index >= 0) {
        this.ordered.splice(index, 1);
      }
    }
    this.added.delete(id);
    this.updated.delete(id);
    this.strokeCache.delete(id);
    if (!this.removed.has(id)) {
      this.removed.add(id);
    }
    accumulator.push(id);
  }

  private clampCamera(): void {
    const viewportWidth = this.camera.viewportSize.width;
    const viewportHeight = this.camera.viewportSize.height;
    
    let clampedX: number;
    let clampedY: number;
    
    // Якщо viewport більший за карту по ширині - центруємо по X
    if (viewportWidth >= this.mapSize.width) {
      clampedX = (this.mapSize.width - viewportWidth) / 2;
    } else {
      // Інакше - обмежуємо як зараз
      const maxX = this.mapSize.width - viewportWidth;
      clampedX = clampNumber(this.camera.position.x, 0, maxX);
    }
    
    // Якщо viewport більший за карту по висоті - центруємо по Y
    if (viewportHeight >= this.mapSize.height) {
      clampedY = (this.mapSize.height - viewportHeight) / 2;
    } else {
      // Інакше - обмежуємо як зараз
      const maxY = this.mapSize.height - viewportHeight;
      clampedY = clampNumber(this.camera.position.y, 0, maxY);
    }
    
    this.camera.position = { x: clampedX, y: clampedY };
  }

  private cloneInstance(instance: SceneObjectInstance): SceneObjectInstance {
    const cachedStroke = this.strokeCache.get(instance.id);
    const stroke = strokesEqual(instance.data.stroke, cachedStroke)
      ? cachedStroke
      : cloneStroke(instance.data.stroke);
    this.strokeCache.set(instance.id, stroke);
    return {
      id: instance.id,
      type: instance.type,
      data: {
        position: { ...instance.data.position },
        size: instance.data.size ? { ...instance.data.size } : { ...DEFAULT_SIZE },
        color: instance.data.color ? { ...instance.data.color } : { ...DEFAULT_COLOR },
        fill: cloneSceneFill(instance.data.fill),
        stroke,
        rotation:
          typeof instance.data.rotation === "number"
            ? normalizeRotation(instance.data.rotation)
            : 0,
        customData: this.getCustomDataSnapshot(instance.id, instance.data.customData),
      },
    };
  }

  private cloneCustomDataForInstance<T>(id: string, value: T): T {
    if (value === undefined || value === null) {
      this.customDataCache.delete(id);
      return value;
    }

    if (typeof value !== "object") {
      this.customDataCache.delete(id);
      return value;
    }

    const cached = this.customDataCache.get(id);
    const previousClone = cached?.clone;
    const result = cloneCustomDataMutable(value, previousClone);

    if (!cached) {
      this.customDataCache.set(id, {
        clone: result.clone,
        snapshot: undefined,
        version: 1,
        snapshotVersion: 0,
      });
    } else {
      cached.clone = result.clone;
      if (result.changed) {
        cached.version += 1;
        cached.snapshot = undefined;
        cached.snapshotVersion = 0;
      }
      this.customDataCache.set(id, cached);
    }

    return result.clone as T;
  }

  private getCustomDataSnapshot(id: string, value: unknown): unknown {
    if (value === undefined || value === null) {
      return value;
    }

    if (typeof value !== "object") {
      return value;
    }

    const cached = this.customDataCache.get(id);
    if (!cached) {
      const { clone } = cloneCustomDataMutable(value, undefined);
      const snapshot = cloneCustomDataSnapshot(clone);
      this.customDataCache.set(id, {
        clone,
        snapshot,
        version: 1,
        snapshotVersion: 1,
      });
      return snapshot;
    }

    if (cached.clone !== value) {
      const result = cloneCustomDataMutable(value, cached.clone);
      cached.clone = result.clone;
      if (result.changed) {
        cached.version += 1;
        cached.snapshot = undefined;
        cached.snapshotVersion = 0;
      }
      this.customDataCache.set(id, cached);
    }

    if (!cached.snapshot || cached.snapshotVersion !== cached.version) {
      cached.snapshot = cloneCustomDataSnapshot(cached.clone);
      cached.snapshotVersion = cached.version;
      this.customDataCache.set(id, cached);
    }

    return cached.snapshot;
  }
}
