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

export interface SceneObjectData {
  position: SceneVector2;
  size?: SceneSize;
  color?: SceneColor;
}

export interface SceneObjectInstance {
  id: string;
  type: string;
  data: SceneObjectData;
}

export interface SceneCameraState {
  position: SceneVector2;
  viewportSize: SceneSize;
  scale: number;
}

const DEFAULT_SIZE: SceneSize = { width: 50, height: 50 };
const DEFAULT_COLOR: SceneColor = { r: 1, g: 1, b: 1, a: 1 };
const MIN_MAP_SIZE = 1000;
const MAX_SCALE = 4;

export class SceneObjectManager {
  private objects = new Map<string, SceneObjectInstance>();
  private ordered: SceneObjectInstance[] = [];
  private idCounter = 0;

  private mapSize: SceneSize = { width: MIN_MAP_SIZE, height: MIN_MAP_SIZE };
  private screenSize: SceneSize = { width: MIN_MAP_SIZE, height: MIN_MAP_SIZE };
  private camera: SceneCameraState = {
    position: { x: 0, y: 0 },
    viewportSize: { width: MIN_MAP_SIZE, height: MIN_MAP_SIZE },
    scale: 1,
  };

  public addObject(type: string, data: SceneObjectData): string {
    const id = `${type}-${++this.idCounter}`;
    const instance: SceneObjectInstance = {
      id,
      type,
      data: {
        position: { ...data.position },
        size: data.size ? { ...data.size } : { ...DEFAULT_SIZE },
        color: data.color ? { ...data.color } : { ...DEFAULT_COLOR },
      },
    };
    this.objects.set(id, instance);
    this.ordered.push(instance);
    return id;
  }

  public updateObject(id: string, data: SceneObjectData): void {
    const instance = this.objects.get(id);
    if (!instance) {
      return;
    }
    instance.data = {
      position: { ...data.position },
      size: data.size
        ? { ...data.size }
        : instance.data.size
        ? { ...instance.data.size }
        : { ...DEFAULT_SIZE },
      color: data.color
        ? { ...data.color }
        : instance.data.color
        ? { ...instance.data.color }
        : { ...DEFAULT_COLOR },
    };
  }

  public removeObject(id: string): void {
    if (!this.objects.has(id)) {
      return;
    }
    this.objects.delete(id);
    const index = this.ordered.findIndex((object) => object.id === id);
    if (index >= 0) {
      this.ordered.splice(index, 1);
    }
  }

  public clear(): void {
    this.objects.clear();
    this.ordered.length = 0;
    this.idCounter = 0;
    this.resetCamera();
  }

  public getObject(id: string): SceneObjectInstance | undefined {
    return this.objects.get(id);
  }

  public getObjects(): readonly SceneObjectInstance[] {
    return this.ordered;
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
