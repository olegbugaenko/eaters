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

const DEFAULT_SIZE: SceneSize = { width: 0.1, height: 0.1 };
const DEFAULT_COLOR: SceneColor = { r: 1, g: 1, b: 1, a: 1 };

export class SceneObjectManager {
  private objects = new Map<string, SceneObjectInstance>();
  private ordered: SceneObjectInstance[] = [];
  private idCounter = 0;

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
  }

  public getObject(id: string): SceneObjectInstance | undefined {
    return this.objects.get(id);
  }

  public getObjects(): readonly SceneObjectInstance[] {
    return this.ordered;
  }
}
