import { BrickObjectRenderer } from "./BrickObjectRenderer";
import { BulletObjectRenderer } from "./BulletObjectRenderer";
import { ObjectsRendererManager } from "./ObjectsRendererManager";
import { ObjectRenderer } from "./ObjectRenderer";

export { ObjectsRendererManager } from "./ObjectsRendererManager";
export type { SyncInstructions, DynamicBufferUpdate } from "./ObjectsRendererManager";
export {
  VERTEX_COMPONENTS,
  POSITION_COMPONENTS,
  FILL_INFO_COMPONENTS,
  FILL_PARAMS0_COMPONENTS,
  FILL_PARAMS1_COMPONENTS,
  STOP_OFFSETS_COMPONENTS,
  STOP_COLOR_COMPONENTS,
  MAX_GRADIENT_STOPS,
  FILL_COMPONENTS,
} from "./ObjectRenderer";

export const createObjectsRendererManager = (): ObjectsRendererManager => {
  const renderers = new Map<string, ObjectRenderer>([
    ["brick", new BrickObjectRenderer()],
    ["bullet", new BulletObjectRenderer()],
  ]);
  return new ObjectsRendererManager(renderers);
};
