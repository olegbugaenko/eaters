import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
  StaticPrimitive,
  VERTEX_COMPONENTS,
} from "./ObjectRenderer";
import {
  SceneObjectInstance,
  SceneObjectManager,
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

export class ObjectsRendererManager {
  private readonly objects = new Map<string, ManagedObject>();
  private readonly staticEntries: StaticEntry[] = [];
  private readonly dynamicEntries: DynamicEntry[] = [];
  private readonly dynamicEntryByPrimitive = new Map<DynamicPrimitive, DynamicEntry>();

  private staticData: Float32Array | null = null;
  private dynamicData: Float32Array | null = null;

  private staticDirty = false;
  private dynamicLayoutDirty = false;
  private pendingDynamicUpdates: DynamicBufferUpdate[] = [];

  constructor(private readonly renderers: Map<string, ObjectRenderer>) {}

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
      this.rebuildDynamicData();
      result.dynamicData = this.dynamicData;
    } else if (this.pendingDynamicUpdates.length > 0) {
      result.dynamicUpdates = this.pendingDynamicUpdates;
    }

    this.pendingDynamicUpdates = [];

    return result;
  }

  public getStaticVertexCount(): number {
    return this.staticData ? this.staticData.length / VERTEX_COMPONENTS : 0;
  }

  public getDynamicVertexCount(): number {
    return this.dynamicData ? this.dynamicData.length / VERTEX_COMPONENTS : 0;
  }

  private addObject(instance: SceneObjectInstance): void {
    const renderer = this.renderers.get(instance.type);
    if (!renderer) {
      console.warn(`No renderer registered for object type "${instance.type}".`);
      return;
    }
    const registration = renderer.register(instance);
    const managed: ManagedObject = { instance, renderer, registration };
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
    managed.instance = instance;
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
      if (this.dynamicLayoutDirty || !this.dynamicData) {
        return;
      }
      this.dynamicData.set(data, entry.offset);
      this.pendingDynamicUpdates.push({ offset: entry.offset, data: data.slice() });
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
    this.staticDirty = false;
  }

  private rebuildDynamicData(): void {
    const totalLength = this.dynamicEntries.reduce(
      (sum, entry) => sum + entry.primitive.data.length,
      0
    );
    const data = new Float32Array(totalLength);
    let offset = 0;
    this.dynamicEntries.forEach((entry) => {
      entry.offset = offset;
      entry.length = entry.primitive.data.length;
      data.set(entry.primitive.data, offset);
      offset += entry.length;
    });
    this.dynamicData = data;
    this.dynamicLayoutDirty = false;
    this.pendingDynamicUpdates = [];
  }
}
