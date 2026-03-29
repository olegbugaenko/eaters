import type {
  SceneColor,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ParticleEmitterConfig } from "../../logic/interfaces/visuals/particle-emitters-config";
import type {
  ExtendedRendererLayerFields,
  BaseRendererLayerConfig,
  RendererLayerAnimationConfig,
} from "@shared/types/renderer.types";
import type { RendererFillConfig, RendererStrokeConfig } from "@shared/types/renderer-config";
import type { UnitProjectileVisualConfig } from "../../logic/modules/active-map/projectiles/projectiles.types";
import type { ArcType } from "../arcs-db";
import type { StatusEffectId } from "../status-effects-db";
import type { StatusEffectApplicationOptions } from "@/logic/modules/active-map/status-effects/status-effects.types";
import type { ExplosionType } from "../explosions-db";
import type { AttackSeriesConfig } from "@shared/types/attack-series.types";
import type { MapEnemySpawnTypeConfig } from "../maps/maps-db";
import type { DamageApplicationOptions } from "@/logic/modules/active-map/targeting/DamageService";
import type { ResourceAmount } from "../resources-db";

export type EnemyType =
  | "basicEnemy"
  | "fastEnemy"
  | "tankEnemy"
  | "turretEnemy"
  | "burstTurretEnemy"
  | "volleyTurretEnemy"
  | "wheelVolleyTurretEnemy"
  | "explosionTurretEnemy"
  | "bleedingTurretEnemy"
  | "spectreEnemy"
  | "encagedBeastEnemy"
  | "coalConvoyGuardian"
  | "coalFlameGuardian"
  | "silverKeeperEnemy"
  | "freezeTurretEnemy"
  | "snakeEnemy"
  | "jungleSnakeEnemy"
  | "bronzeArcherEnemy"
  | "bigGun"
  | "laserTurretEnemy"
  | "plasmaBeamTurretEnemy"
  | "spinningAxeTurretEnemy"
  | "portalSpawnerEnemy"
  | "bronzeArcherPortalSpawnerEnemy"
  | "carGuardian"
  | "carGuardianPortalSpawnerEnemy"
  | "greatOctopusBody"
  | "greatOctopusSegment"
  | "fireParasiteEnemy";

export interface EnemyAuraConfig {
  petalCount: number;
  innerRadius: number;
  outerRadius: number;
  petalWidth?: number;
  rotationSpeed: number;
  color: SceneColor;
  alpha: number;
  pointInward?: boolean;
}

export type EnemyRendererLayerConfig =
  BaseRendererLayerConfig<ExtendedRendererLayerFields>;

export interface EnemyRendererCompositeConfig {
  kind: "composite";
  fill: SceneColor;
  stroke?: {
    color: SceneColor;
    width: number;
  };
  layers: readonly EnemyRendererLayerConfig[];
  auras?: readonly EnemyAuraConfig[];
}

export interface EnemyRendererPolygonConfig {
  kind: "polygon";
  fill: SceneColor;
  stroke?: {
    color: SceneColor;
    width: number;
  };
  vertices: readonly SceneVector2[];
}

export type EnemyRendererConfig =
  | EnemyRendererCompositeConfig
  | EnemyRendererPolygonConfig;

export interface EnemyArcAttackConfig {
  readonly arcType: ArcType;
  readonly spawnOffset?: SceneVector2;
  readonly attackSeries?: AttackSeriesConfig;
  readonly statusEffectId?: StatusEffectId;
  readonly statusEffectOptions?: StatusEffectApplicationOptions;
  readonly explosionType?: ExplosionType;
  readonly explosionRadius?: number;
  readonly chainRadius?: number;
  readonly chainJumps?: number;
  readonly damage?: number;
  readonly damageOptions?: DamageApplicationOptions;
}

export interface EnemyProjectileConfig extends UnitProjectileVisualConfig {
  readonly damage?: number;
  readonly statusEffectId?: StatusEffectId;
  readonly statusEffectOptions?: StatusEffectApplicationOptions;
  readonly attackSeries?: AttackSeriesConfig;
  readonly destroyOnHit?: boolean;
  readonly targetHitCooldownMs?: number;
}

export interface EnemyStreamAttackVisualConfig {
  readonly color: SceneColor;
  readonly coreColor?: SceneColor;
  readonly edgeColor?: SceneColor;
  readonly widthStart?: number;
  readonly widthEnd?: number;
  readonly innerWidthMultiplier?: number;
  readonly raggedness?: number;
  readonly waveAmplitude?: number;
  readonly waveFrequency?: number;
  readonly pulseSpeed?: number;
  readonly pulseIntensity?: number;
  readonly segments?: number;
  readonly sparks?: ParticleEmitterConfig;
  /** Override auto-generated flame layers. Each entry is a standard ParticleEmitterConfig. */
  readonly flameEmitters?: readonly ParticleEmitterConfig[];
}

export interface EnemyStreamAttackConfig {
  readonly spawnOffset?: SceneVector2;
  readonly durationMs: number;
  readonly tickIntervalMs: number;
  readonly damage?: number;
  readonly angleDeg: number;
  readonly range?: number;
  readonly statusEffectId?: StatusEffectId;
  readonly statusEffectOptions?: StatusEffectApplicationOptions;
  readonly damageOptions?: DamageApplicationOptions;
  readonly visual: EnemyStreamAttackVisualConfig;
}

export interface EnemyTargetingOptions {
  readonly avoidSharedTargets?: boolean;
  readonly skipTargetsWithEffects?: readonly StatusEffectId[];
  readonly searchPadding?: number;
}

export interface OctopusTentacleTipGlowConfig {
  readonly radius: number;
  readonly segments?: number;
  readonly fill: RendererFillConfig;
}

export interface OctopusTentacleConfig {
  readonly spines: readonly (readonly { x: number; y: number; width: number }[])[];
  readonly segmentsPerTentacle: number;
  readonly anim: RendererLayerAnimationConfig;
  readonly fill: RendererFillConfig;
  readonly stroke?: RendererStrokeConfig;
  readonly buildOpts?: { epsilon?: number; winding?: "CW" | "CCW" };
  readonly tipGlow?: OctopusTentacleTipGlowConfig;
}

export interface EnemyConfig {
  readonly name: string;
  readonly renderer: EnemyRendererConfig;
  readonly tentacles?: OctopusTentacleConfig;
  readonly maxHp: number;
  readonly armor: number;
  readonly baseDamage: number;
  readonly attackInterval: number;
  readonly attackRange?: number;
  readonly moveSpeed: number;
  readonly physicalSize: number;
  readonly dragMultiplier?: number;
  readonly lockRotation?: boolean;
  readonly visualRotationSpinningDegPerSec?: number;
  readonly projectileDirection?: SceneVector2;
  readonly reward?: ResourceAmount;
  readonly soulRewardBase?: number;
  readonly emitter?: ParticleEmitterConfig;
  readonly projectile?: EnemyProjectileConfig;
  readonly streamAttack?: EnemyStreamAttackConfig;
  readonly projectileMinSegmentIndex?: number;
  readonly projectileVolley?: {
    readonly count: number;
    readonly spreadAngleDeg: number;
  };
  readonly explosionAttack?: {
    readonly radius: number;
    readonly damageMultiplier?: number;
    readonly explosionType?: ExplosionType;
    readonly explosionRadius?: number;
    readonly statusEffectId?: StatusEffectId;
    readonly statusEffectOptions?: StatusEffectApplicationOptions;
  };
  readonly arcAttack?: EnemyArcAttackConfig;
  readonly targeting?: EnemyTargetingOptions;
  readonly knockBackDistance?: number;
  readonly knockBackSpeed?: number;
  readonly projectileKnockBackDistance?: number;
  readonly projectileKnockBackSpeed?: number;
  readonly selfKnockBackDistance?: number;
  readonly selfKnockBackSpeed?: number;
  readonly requireDestruction?: boolean;
  readonly blocksUnits?: boolean;
  readonly contactDamage?: boolean;
  readonly meleeHitExplosion?: {
    readonly type: ExplosionType;
    readonly radius?: number;
  };
  readonly spawner?: {
    readonly spawnRate: number;
    readonly enemyTypes: readonly MapEnemySpawnTypeConfig[];
    readonly levelOffset?: number;
    readonly maxConcurrent?: number;
  };
}
