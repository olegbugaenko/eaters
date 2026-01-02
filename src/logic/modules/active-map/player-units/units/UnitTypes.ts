import { SceneVector2, SceneColor } from "../../../../services/scene-object-manager/scene-object-manager.types";
import { PlayerUnitType } from "../../../../../db/player-units-db";
import type { ParticleEmitterConfig } from "../../../../interfaces/visuals/particle-emitters-config";
import { PlayerUnitRendererConfig } from "../../../../../db/player-units-db";
import { UnitTargetingMode } from "../../../../../types/unit-targeting";
import { UnitDesignId } from "../../../camp/unit-design/unit-design.types";
import { UnitModuleId } from "../../../../../db/unit-modules-db";
import { SkillId } from "../../../../../db/skills-db";
import { VisualEffectState } from "../../../../visuals/VisualEffectState";
import { PheromoneAttackBonusState } from "../PlayerUnitAbilities";

export interface PlayerUnitState {
  id: string;
  designId: UnitDesignId | null;
  type: PlayerUnitType;
  position: SceneVector2;
  spawnPosition: SceneVector2;
  movementId: string;
  rotation: number;
  hp: number;
  maxHp: number;
  armor: number;
  hpRegenPerSecond: number;
  armorPenetration: number;
  baseAttackDamage: number;
  baseAttackInterval: number;
  baseAttackDistance: number;
  moveSpeed: number;
  moveAcceleration: number;
  mass: number;
  physicalSize: number;
  critChance: number;
  critMultiplier: number;
  rewardMultiplier: number;
  damageTransferPercent: number;
  damageTransferRadius: number;
  attackStackBonusPerHit: number;
  attackStackBonusCap: number;
  currentAttackStackBonus: number;
  attackCooldown: number;
  preCollisionVelocity: SceneVector2;
  lastNonZeroVelocity: SceneVector2;
  targetBrickId: string | null;
  targetingMode: UnitTargetingMode;
  wanderTarget: SceneVector2 | null;
  wanderCooldown: number;
  objectId: string;
  renderer: PlayerUnitRendererConfig;
  emitter?: ParticleEmitterConfig;
  baseFillColor: SceneColor;
  baseStrokeColor?: SceneColor;
  appliedFillColor: SceneColor;
  appliedStrokeColor?: SceneColor;
  visualEffects: VisualEffectState;
  visualEffectsDirty: boolean;
  timeSinceLastAttack: number;
  timeSinceLastSpecial: number;
  pheromoneHealingMultiplier: number;
  pheromoneAggressionMultiplier: number;
  pheromoneAttackBonuses: PheromoneAttackBonusState[];
  fireballDamageMultiplier: number;
  canUnitAttackDistant: boolean;
  moduleLevels: Partial<Record<UnitModuleId, number>>;
  equippedModules: readonly UnitModuleId[];
  ownedSkills: readonly SkillId[];
}

export const ATTACK_DISTANCE_EPSILON = 0.001;
export const COLLISION_RESOLUTION_ITERATIONS = 4;
export const ZERO_VECTOR: SceneVector2 = { x: 0, y: 0 };
export const CRITICAL_HIT_EXPLOSION_RADIUS = 12;
export const INTERNAL_FURNACE_EFFECT_ID = "internalFurnace/heat";
export const INTERNAL_FURNACE_TINT_COLOR: SceneColor = {
  r: 0.98,
  g: 0.35,
  b: 0.32,
  a: 1,
};
export const INTERNAL_FURNACE_MAX_INTENSITY = 0.75;
export const INTERNAL_FURNACE_EFFECT_PRIORITY = 50;
export const PHEROMONE_TIMER_CAP_SECONDS = 60;
export const TARGETING_RADIUS_STEP = 250;
export const IDLE_WANDER_RADIUS = 160;
export const IDLE_WANDER_TARGET_EPSILON = 12;
export const IDLE_WANDER_RESEED_INTERVAL = 3;
export const IDLE_WANDER_SPEED_FACTOR = 0.55;
export const TARGETING_SCORE_EPSILON = 1e-3;

