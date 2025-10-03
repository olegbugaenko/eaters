import { BrickObjectRenderer } from "./BrickObjectRenderer";
import { BulletObjectRenderer } from "./BulletObjectRenderer";
import { ObjectsRendererManager } from "./ObjectsRendererManager";
import { ObjectRenderer } from "./ObjectRenderer";

export { ObjectsRendererManager } from "./ObjectsRendererManager";
export type { SyncInstructions, DynamicBufferUpdate } from "./ObjectsRendererManager";

export const createObjectsRendererManager = (): ObjectsRendererManager => {
  const renderers = new Map<string, ObjectRenderer>([
    ["brick", new BrickObjectRenderer()],
    ["bullet", new BulletObjectRenderer()],
  ]);
  return new ObjectsRendererManager(renderers);
};
