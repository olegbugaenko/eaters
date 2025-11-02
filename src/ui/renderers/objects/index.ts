import { BrickObjectRenderer } from "./BrickObjectRenderer";
import { BulletObjectRenderer } from "./BulletObjectRenderer";
import { ObjectsRendererManager } from "./ObjectsRendererManager";
import { ObjectRenderer } from "./ObjectRenderer";
import { ExplosionObjectRenderer } from "./ExplosionObjectRenderer";
import { PolygonObjectRenderer } from "./PolygonObjectRenderer";
import { PlayerUnitObjectRenderer } from "./PlayerUnitObjectRenderer";
import { PortalObjectRenderer } from "./PortalObjectRenderer";
import { ArcRenderer } from "./ArcRenderer";
import { AuraRenderer } from "./AuraRenderer";
import { FireballRenderer } from "./FireballRenderer";

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
    // ["bullet", new BulletObjectRenderer()],
    ["explosion", new ExplosionObjectRenderer()],
    ["polygon", new PolygonObjectRenderer()],
    ["playerUnit", new PlayerUnitObjectRenderer()],
    ["portal", new PortalObjectRenderer()],
    ["arc", new ArcRenderer()],
    ["aura", new AuraRenderer()],
    ["fireball", new FireballRenderer()],
    ["spellProjectile", new BulletObjectRenderer()],
  ]);
  return new ObjectsRendererManager(renderers);
};
