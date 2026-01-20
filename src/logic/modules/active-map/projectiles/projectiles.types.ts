import type { SceneVector2, SceneFill, SceneColor } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { TargetType } from "../targeting/targeting.types";
import type { BulletTailConfig } from "@/db/bullets-db";
import type { ParticleEmitterConfig } from "../../../interfaces/visuals/particle-emitters-config";
import type { SpellProjectileRingTrailConfig } from "@/db/spells-db";
import type { BulletSlotHandle } from "../../../services/bullet-render-bridge/BulletRenderBridge";
import type { RingSlotHandle } from "@ui/renderers/primitives/gpu/ring";
import type { BulletSpriteName } from "@logic/services/bullet-render-bridge/bullet-sprites.const";
import type { ExplosionType } from "@/db/explosions-db";

export type UnitProjectileShape = "circle" | "sprite";

export interface UnitProjectileWanderConfig {
  intervalMs: number;
  angleRangeDeg: number;
}

export interface UnitProjectileVisualConfig {
  radius: number;
  speed: number;
  lifetimeMs: number;
  fill: SceneFill;
  spawnOffset?: SceneVector2;
  soundEffectUrl?: string;
  tail?: BulletTailConfig;
  tailEmitter?: ParticleEmitterConfig;
  ringTrail?: SpellProjectileRingTrailConfig;
  rotationSpinningDegPerSec?: number;
  shape?: UnitProjectileShape;
  /** Sprite name when shape === "sprite" */
  spriteName?: BulletSpriteName;
  /** Sprite index when shape === "sprite" */
  spriteIndex?: number;
  hitRadius?: number;
  damageRadius?: number;
  /** Explosion type when projectile hits target (optional) */
  explosion?: ExplosionType;
  rendererCustomData?: Record<string, unknown>;
  wander?: UnitProjectileWanderConfig;
}

export interface UnitProjectileSpawn {
  origin: SceneVector2;
  direction: SceneVector2;
  damage: number;
  rewardMultiplier: number;
  armorPenetration: number;
  knockBackDistance?: number;
  knockBackSpeed?: number;
  knockBackDirection?: SceneVector2;
  skipKnockback?: boolean;
  targetTypes?: TargetType[];
  visual: UnitProjectileVisualConfig;
  onHit?: UnitProjectileOnHit;
  onExpired?: (position: SceneVector2) => void;
}

export interface UnitProjectileHitContext {
  targetId: string;
  targetType: TargetType;
  brickId?: string;
  position: SceneVector2;
}

export type UnitProjectileOnHit = (
  context: UnitProjectileHitContext,
) => boolean | void;

export interface UnitProjectileRingTrailState {
  config: Required<Omit<SpellProjectileRingTrailConfig, "color">> & {
    color: SceneColor;
  };
  accumulatorMs: number;
}

export interface RingState {
  gpuSlot: RingSlotHandle;
  createdAt: number;
  lifetimeMs: number;
}

export interface UnitProjectileState extends UnitProjectileSpawn {
  id: string;
  effectsObjectId?: string;
  velocity: SceneVector2;
  elapsedMs: number;
  radius: number;
  lifetimeMs: number;
  createdAt: number;
  ringTrail?: UnitProjectileRingTrailState;
  shape: UnitProjectileShape;
  hitRadius: number;
  damageRadius: number;
  position: SceneVector2;
  wander?: {
    intervalMs: number;
    angleRangeRad: number;
    accumulatorMs: number;
  };
  rotationSpin?: {
    radiansPerMs: number;
    rotationRad: number;
  };
  rendererCustomData: Record<string, unknown>;
  // GPU rendering slot (if using GPU instanced rendering)
  gpuSlot?: BulletSlotHandle;
  // Прапорець для пропуску руху в перший тік
  justSpawned: boolean;
}
