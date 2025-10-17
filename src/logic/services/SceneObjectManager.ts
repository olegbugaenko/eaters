export interface SceneVector2 {
  x: number;
  y: number;
}

export interface SceneSize {
  width: number;
  height: number;
}

export interface SceneColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface SceneStroke {
  color: SceneColor;
  width: number;
}

export const FILL_TYPES = {
  SOLID: 0,
  LINEAR_GRADIENT: 1,
  RADIAL_GRADIENT: 2,
  DIAMOND_GRADIENT: 3,
} as const;

export type SceneFillType = (typeof FILL_TYPES)[keyof typeof FILL_TYPES];

export interface SceneGradientStop {
  offset: number;
  color: SceneColor;
}

export interface SceneSolidFill {
  fillType: typeof FILL_TYPES.SOLID;
  color: SceneColor;
}

export interface SceneLinearGradientFill {
  fillType: typeof FILL_TYPES.LINEAR_GRADIENT;
  start?: SceneVector2;
  end?: SceneVector2;
  stops: SceneGradientStop[];
}

export interface SceneRadialGradientFill {
  fillType: typeof FILL_TYPES.RADIAL_GRADIENT;
  start?: SceneVector2;
  end?: number;
  stops: SceneGradientStop[];
}

export interface SceneDiamondGradientFill {
  fillType: typeof FILL_TYPES.DIAMOND_GRADIENT;
  start?: SceneVector2;
  end?: number;
  stops: SceneGradientStop[];
}

export type SceneFill =
  | SceneSolidFill
  | SceneLinearGradientFill
  | SceneRadialGradientFill
  | SceneDiamondGradientFill;

export interface SceneObjectData {
  position: SceneVector2;
  size?: SceneSize;
  color?: SceneColor;
  fill?: SceneFill;
  rotation?: number;
  stroke?: SceneStroke;
  customData?: unknown;
}

export interface SceneObjectInstance {
  id: string;
  type: string;
  data: SceneObjectData & { fill: SceneFill; stroke?: SceneStroke };
}

export interface SceneCameraState {
  position: SceneVector2;
  viewportSize: SceneSize;
  scale: number;
}

const DEFAULT_SIZE: SceneSize = { width: 50, height: 50 };
const DEFAULT_COLOR: SceneColor = { r: 1, g: 1, b: 1, a: 1 };
const DEFAULT_FILL: SceneSolidFill = {
  fillType: FILL_TYPES.SOLID,
  color: { ...DEFAULT_COLOR },
};
const DEFAULT_ROTATION = 0;
const MIN_MAP_SIZE = 2000;
const MAX_SCALE = 4;

export class SceneObjectManager {
  private objects = new Map<string, SceneObjectInstance>();
  private ordered: SceneObjectInstance[] = [];
  private idCounter = 0;

  private added = new Map<string, SceneObjectInstance>();
  private updated = new Map<string, SceneObjectInstance>();
  private removed = new Set<string>();
  // Defer removals to avoid frequent dynamic buffer reallocations in the renderer
  private pendingRemovals = new Set<string>();
  private static readonly REMOVALS_PER_FLUSH = 128;
  private static readonly REMOVAL_FLUSH_INTERVAL_MS = 250;
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
        customData: cloneCustomData(data.customData),
      },
    };
    this.objects.set(id, instance);
    this.ordered.push(instance);
    this.added.set(id, instance);
    this.updated.delete(id);
    return id;
  }

  public updateObject(id: string, data: SceneObjectData): void {
    const instance = this.objects.get(id);
    if (!instance) {
      return;
    }
    const size = data.size
      ? { ...data.size }
      : instance.data.size
      ? { ...instance.data.size }
      : { ...DEFAULT_SIZE };
    const fill = data.fill
      ? sanitizeFill(data.fill)
      : data.color
      ? createSolidFill(data.color)
      : cloneFill(instance.data.fill);
    const color = data.color
      ? sanitizeColor(data.color)
      : extractPrimaryColor(fill);
    const stroke =
      typeof data.stroke !== "undefined"
        ? sanitizeStroke(data.stroke)
        : cloneStroke(instance.data.stroke);
    const rotation =
      typeof data.rotation === "number"
        ? normalizeRotation(data.rotation)
        : typeof instance.data.rotation === "number"
        ? normalizeRotation(instance.data.rotation)
        : DEFAULT_ROTATION;
    instance.data = {
      position: { ...data.position },
      size,
      color,
      fill,
      rotation,
      stroke,
      customData: cloneCustomData(
        typeof data.customData !== "undefined"
          ? data.customData
          : instance.data.customData
      ),
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
    this.idCounter = 0;
    this.added.clear();
    this.updated.clear();
    this.pendingRemovals.clear();
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
        this.pendingRemovals.delete(id);
        const had = this.objects.delete(id);
        if (had) {
          const index = this.ordered.findIndex((object) => object.id === id);
          if (index >= 0) {
            this.ordered.splice(index, 1);
          }
        }
        this.added.delete(id);
        this.updated.delete(id);
        this.removed.add(id);
        actuallyRemoved.push(id);
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
    const clamped = clamp(scale, limits.min, limits.max);
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
    const clampedX = clamp(x, 0, Math.max(0, this.mapSize.width - this.camera.viewportSize.width));
    const clampedY = clamp(y, 0, Math.max(0, this.mapSize.height - this.camera.viewportSize.height));
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
    const minScaleWidth = this.screenSize.width / this.mapSize.width;
    const minScaleHeight = this.screenSize.height / this.mapSize.height;
    return Math.max(Math.min(minScaleWidth, minScaleHeight, 1), 0.1);
  }

  private clampCamera(): void {
    const maxX = Math.max(0, this.mapSize.width - this.camera.viewportSize.width);
    const maxY = Math.max(0, this.mapSize.height - this.camera.viewportSize.height);
    const clampedX = clamp(this.camera.position.x, 0, maxX);
    const clampedY = clamp(this.camera.position.y, 0, maxY);
    this.camera.position = { x: clampedX, y: clampedY };
  }

  private cloneInstance(instance: SceneObjectInstance): SceneObjectInstance {
    return {
      id: instance.id,
      type: instance.type,
      data: {
        position: { ...instance.data.position },
        size: instance.data.size ? { ...instance.data.size } : { ...DEFAULT_SIZE },
        color: instance.data.color ? { ...instance.data.color } : { ...DEFAULT_COLOR },
        fill: cloneFill(instance.data.fill),
        stroke: cloneStroke(instance.data.stroke),
        rotation:
          typeof instance.data.rotation === "number"
            ? normalizeRotation(instance.data.rotation)
            : DEFAULT_ROTATION,
        customData: cloneCustomData(instance.data.customData),
      },
    };
  }
}

function cloneCustomData<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return value.slice(0) as T;
  }

  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView & { slice?: () => ArrayBufferView };
    if (typeof view.slice === "function") {
      return view.slice() as T;
    }
    const bufferCopy = view.buffer.slice(0);
    return new (view.constructor as { new (buffer: ArrayBufferLike): ArrayBufferView })(
      bufferCopy
    ) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneCustomData(item)) as T;
  }

  if (typeof value === "object") {
    const source = value as Record<string | number | symbol, unknown>;
    const clone: Record<string | number | symbol, unknown> = {};
    Object.keys(source).forEach((key) => {
      clone[key] = cloneCustomData(source[key]);
    });
    return clone as T;
  }

  return value;
}

function sanitizeColor(color: SceneColor | undefined): SceneColor {
  if (!color) {
    return { ...DEFAULT_COLOR };
  }
  return {
    r: clamp01(color.r),
    g: clamp01(color.g),
    b: clamp01(color.b),
    a: clamp01(typeof color.a === "number" ? color.a : DEFAULT_COLOR.a ?? 1),
  };
}

function clamp01(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function createSolidFill(color: SceneColor): SceneSolidFill {
  return {
    fillType: FILL_TYPES.SOLID,
    color: sanitizeColor(color),
  };
}

function sanitizeVector(
  value: SceneVector2 | undefined
): SceneVector2 | undefined {
  if (!value) {
    return undefined;
  }
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }
  return { x, y };
}

function sanitizeRadius(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  if (value <= 0) {
    return undefined;
  }
  return value;
}

function sanitizeGradientStops(
  stops: SceneGradientStop[] | undefined
): SceneGradientStop[] {
  if (!stops || stops.length === 0) {
    return [
      {
        offset: 0,
        color: sanitizeColor(undefined),
      },
    ];
  }
  const sanitized: SceneGradientStop[] = [];
  stops.forEach((stop) => {
    if (!stop || typeof stop !== "object") {
      return;
    }
    sanitized.push({
      offset: clamp01(stop.offset),
      color: sanitizeColor(stop.color),
    });
  });
  if (sanitized.length === 0) {
    sanitized.push({
      offset: 0,
      color: sanitizeColor(undefined),
    });
  } else {
    sanitized.sort((a, b) => a.offset - b.offset);
  }
  return sanitized;
}

function sanitizeFill(fill: SceneFill | undefined): SceneFill {
  if (!fill) {
    return cloneFill(DEFAULT_FILL);
  }
  switch (fill.fillType) {
    case FILL_TYPES.SOLID:
      return {
        fillType: FILL_TYPES.SOLID,
        color: sanitizeColor(fill.color),
      };
    case FILL_TYPES.LINEAR_GRADIENT:
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: sanitizeVector(fill.start),
        end: sanitizeVector(fill.end),
        stops: sanitizeGradientStops(fill.stops),
      };
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT:
      return {
        fillType: fill.fillType,
        start: sanitizeVector(fill.start),
        end: sanitizeRadius(fill.end),
        stops: sanitizeGradientStops(fill.stops),
      };
    default:
      return cloneFill(DEFAULT_FILL);
  }
}

function sanitizeStroke(stroke: SceneStroke | undefined): SceneStroke | undefined {
  if (!stroke || typeof stroke.width !== "number") {
    return undefined;
  }
  const width = Number.isFinite(stroke.width) ? Math.max(0, stroke.width) : 0;
  if (width <= 0) {
    return undefined;
  }
  return {
    color: sanitizeColor(stroke.color),
    width,
  };
}

function cloneFill(fill: SceneFill): SceneFill {
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
        stops: cloneStops(fill.stops),
      };
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT:
      return {
        fillType: fill.fillType,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end,
        stops: cloneStops(fill.stops),
      };
  }
  return {
    fillType: FILL_TYPES.SOLID,
    color: { ...DEFAULT_COLOR },
  };
}

function cloneStroke(stroke: SceneStroke | undefined): SceneStroke | undefined {
  if (!stroke) {
    return undefined;
  }
  return {
    color: { ...stroke.color },
    width: stroke.width,
  };
}

function cloneStops(stops: SceneGradientStop[]): SceneGradientStop[] {
  return stops.map((stop) => ({
    offset: stop.offset,
    color: { ...stop.color },
  }));
}

function extractPrimaryColor(fill: SceneFill): SceneColor {
  if (fill.fillType === FILL_TYPES.SOLID) {
    return { ...fill.color };
  }
  const first = fill.stops[0];
  if (!first) {
    return { ...DEFAULT_COLOR };
  }
  return { ...first.color };
}

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

function normalizeRotation(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_ROTATION;
  }
  if (value === 0) {
    return 0;
  }
  const twoPi = Math.PI * 2;
  const normalized = value % twoPi;
  if (normalized === 0) {
    return 0;
  }
  return normalized < 0 ? normalized + twoPi : normalized;
}
