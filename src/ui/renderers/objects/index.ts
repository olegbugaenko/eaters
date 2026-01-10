import { BrickObjectRenderer } from "./implementations/brick";
import { BulletObjectRenderer } from "./implementations/bullet";
import { ObjectsRendererManager } from "./ObjectsRendererManager";
import { ObjectRenderer } from "./ObjectRenderer";
import { ExplosionObjectRenderer } from "./implementations/explosion";
import { PolygonObjectRenderer } from "./implementations/polygon";
import { PlayerUnitObjectRenderer } from "./implementations/player-unit";
import { EnemyObjectRenderer } from "./implementations/enemy";
import { PortalObjectRenderer } from "./implementations/portal";
import { ArcRenderer } from "./implementations/arc";
import { AuraRenderer } from "./implementations/aura";
import { SpellProjectileRingRenderer } from "./implementations/spell-projectile-ring";
import { SandStormRenderer } from "./implementations/sand-storm";
import { PersistentAoeSpellRenderer } from "./implementations/persistent-aoe-spell";
import { TiedObjectsRegistry } from "./TiedObjectsRegistry";

export { ObjectsRendererManager } from "./ObjectsRendererManager";
export { TiedObjectsRegistry } from "./TiedObjectsRegistry";
export type { SyncInstructions, DynamicBufferUpdate } from "./ObjectsRendererManager";

// Re-export updateAllWhirlInterpolations for convenience
export { updateAllWhirlInterpolations } from "./implementations/sand-storm";
// Re-export clearAllAuraSlots for convenience
export { clearAllAuraSlots } from "./implementations/player-unit";
export {
  VERTEX_COMPONENTS,
  POSITION_COMPONENTS,
  FILL_INFO_COMPONENTS,
  FILL_FILAMENTS0_COMPONENTS,
  FILL_FILAMENTS1_COMPONENTS,
  FILL_FILAMENTS_COMPONENTS,
  FILL_PARAMS0_COMPONENTS,
  FILL_PARAMS1_COMPONENTS,
  STOP_OFFSETS_COMPONENTS,
  STOP_COLOR_COMPONENTS,
  MAX_GRADIENT_STOPS,
  FILL_COMPONENTS,
  CRACK_UV_COMPONENTS,
  CRACK_MASK_COMPONENTS,
  CRACK_EFFECTS_COMPONENTS,
} from "./ObjectRenderer";

export const createObjectsRendererManager = (): ObjectsRendererManager => {
  const renderers = new Map<string, ObjectRenderer>([
    ["brick", new BrickObjectRenderer()],
    // ["bullet", new BulletObjectRenderer()],
    ["explosion", new ExplosionObjectRenderer()],
    ["polygon", new PolygonObjectRenderer()],
    ["playerUnit", new PlayerUnitObjectRenderer()],
    ["enemy", new EnemyObjectRenderer()],
    ["portal", new PortalObjectRenderer()],
    ["arc", new ArcRenderer()],
    ["aura", new AuraRenderer()],
    ["fireball", new BulletObjectRenderer()],
    ["spellProjectile", new BulletObjectRenderer()],
    ["spellProjectileRing", new SpellProjectileRingRenderer()],
    ["unitProjectile", new BulletObjectRenderer()],
    // unitProjectileRing - now rendered via GPU instancing (RingGpuRenderer)
    ["sandStorm", new SandStormRenderer()],
    ["spellPersistentAoe", new PersistentAoeSpellRenderer()],
  ]);
  const tiedObjectsRegistry = new TiedObjectsRegistry();
  return new ObjectsRendererManager(renderers, tiedObjectsRegistry);
};
