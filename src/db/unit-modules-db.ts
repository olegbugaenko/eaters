import { ResourceAmount } from "./resources-db";
import type { MapId } from "./maps-db";
import type { SkillId } from "./skills-db";
import type { UnlockCondition } from "../types/unlocks";
import { FILL_TYPES } from "../logic/services/SceneObjectManager";
import type { SceneFill } from "../logic/services/SceneObjectManager";
import type { BulletTailConfig, BulletTailEmitterConfig } from "./bullets-db";
import type { SpellProjectileRingTrailConfig } from "./spells-db";
import type { BulletSpriteName } from "../logic/services/bulletSprites";

export const UNIT_MODULE_IDS = [
  "magnet",
  "perforator",
  "vitalHull",
  "ironForge",
  "silverArmor",
  "internalFurnace",
  "mendingGland",
  "frenzyGland",
  "fireballOrgan",
  "burningTail",
  "freezingTail",
  "tailNeedles",
] as const;

export type UnitModuleId = (typeof UNIT_MODULE_IDS)[number];

export type UnitModuleBonusType = "multiplier" | "percent";

export interface UnitModuleProjectileVisualConfig {
  readonly radius: number;
  readonly speed: number;
  readonly lifetimeMs: number;
  readonly fill: SceneFill;
  readonly tail?: BulletTailConfig;
  readonly tailEmitter?: BulletTailEmitterConfig;
  readonly ringTrail?: SpellProjectileRingTrailConfig;
  readonly shape?: "circle" | "sprite";
  /** Sprite name when shape === "sprite" */
  readonly spriteName?: BulletSpriteName;
  readonly hitRadius?: number;
}

export interface UnitModuleConfig {
  readonly id: UnitModuleId;
  readonly name: string;
  readonly description: string;
  readonly bonusLabel: string;
  readonly bonusType: UnitModuleBonusType;
  readonly baseBonusValue: number;
  readonly bonusPerLevel: number;
  readonly manaCostMultiplier: number;
  readonly sanityCost: number;
  readonly baseCost: ResourceAmount;
  readonly unlockedBy?: readonly UnlockCondition<MapId, SkillId>[];
  readonly canAttackDistant?: boolean;
  readonly meta?: {
    readonly cooldownSeconds?: number;
    readonly frenzyAttacks?: number;
    readonly healCharges?: number;
    readonly areaRadius?: number;
    readonly fireballExplosionRadius?: number;
    readonly fireballSelfDamagePercent?: number;
    readonly fireballMaxDistance?: number;
    readonly lateralProjectilesPerSide?: number;
    readonly lateralProjectileSpacing?: number;
    readonly lateralProjectileRange?: number;
    readonly lateralProjectileHitRadius?: number;
    readonly lateralProjectileVisual?: UnitModuleProjectileVisualConfig;
  };
}

const UNIT_MODULE_DB: Record<UnitModuleId, UnitModuleConfig> = {
  magnet: {
    id: "magnet",
    name: "Shard-Lure Tendrils",
    description:
      "Filamented feelers thrum with occult magnetism, drawing extra shards from every shattered brick your creature claims.",
    bonusLabel: "Brick reward multiplier",
    bonusType: "multiplier",
    baseBonusValue: 2,
    bonusPerLevel: 0.1,
    manaCostMultiplier: 1.75,
    sanityCost: 0,
    baseCost: { sand: 200 },
  },
  perforator: {
    id: "perforator",
    name: "Rending Tentacles",
    description:
      "Whip-like limbs tear through targets so the force bleeds into adjacent masonry, weakening the formation around the strike.",
    bonusLabel: "Damage spillover",
    bonusType: "percent",
    baseBonusValue: 0.25,
    bonusPerLevel: 0.01,
    manaCostMultiplier: 1.75,
    sanityCost: 0,
    baseCost: { sand: 200 },
  },
  vitalHull: {
    id: "vitalHull",
    name: "Vital Flesh",
    description:
      "Bio-reactive tissues graft and swell, thickening the creature’s living bulk and knitting wounds as it grows.",
    bonusLabel: "Max HP multiplier",
    bonusType: "multiplier",
    baseBonusValue: 2.0,
    bonusPerLevel: 0.08,
    manaCostMultiplier: 2.5,
    sanityCost: 0,
    baseCost: { organics: 200 },
    unlockedBy: [{ type: "map", id: "initial", level: 1 }],
  },
  ironForge: {
    id: "ironForge",
    name: "Iron Fangs",
    description:
      "Hardened iron fangs and knuckle-spikes bite deeper, turning each swing into a brutal, mauling strike.",
    bonusLabel: "Damage multiplier",
    bonusType: "multiplier",
    baseBonusValue: 2.0,
    bonusPerLevel: 0.08,
    manaCostMultiplier: 2.5,
    sanityCost: 0,
    baseCost: { iron: 200 },
    unlockedBy: [{ type: "map", id: "initial", level: 1 }],
  },
  tailNeedles: {
    id: "tailNeedles",
    name: "Chord Needles",
    description:
      "Socket barbed quills into the chord’s tip so every strike unleashes sideways volleys of piercing shards.",
    bonusLabel: "Side projectile damage",
    bonusType: "multiplier",
    baseBonusValue: 0.575,
    bonusPerLevel: 0.025,
    manaCostMultiplier: 2.4,
    sanityCost: 0,
    baseCost: { iron: 200 },
    unlockedBy: [{ type: "skill", id: "tail_spines", level: 1 }],
    meta: {
      lateralProjectilesPerSide: 3,
      lateralProjectileSpacing: 3,
      lateralProjectileRange: 820,
      lateralProjectileHitRadius: 12,
      lateralProjectileVisual: {
        radius: 12, // Larger for sprite visibility (32x32 sprite)
        speed: 340,
        lifetimeMs: 3800,
        fill: {
          fillType: FILL_TYPES.RADIAL_GRADIENT,
          start: { x: 0, y: 0 },
          end: 6,
          stops: [
            { offset: 0, color: { r: 0.85, g: 0.9, b: 0.96, a: 0.55 } },
            { offset: 0.42, color: { r: 0.6, g: 0.74, b: 0.92, a: 0.4 } },
            { offset: 1, color: { r: 0.35, g: 0.46, b: 0.7, a: 0 } },
          ],
        },
        tail: {
          lengthMultiplier: 3.4,
          widthMultiplier: 0.45,
          startColor: { r: 0.48, g: 0.62, b: 0.85, a: 0.55 },
          endColor: { r: 0.32, g: 0.38, b: 0.62, a: 0 },
          offsetMultiplier: -0.95,
        },
        /*tailEmitter: {
          particlesPerSecond: 48,
          particleLifetimeMs: 900,
          fadeStartMs: 260,
          baseSpeed: 0.12,
          speedVariation: 0.09,
          sizeRange: { min: 4.5, max: 8.2 },
          spread: Math.PI / 7,
          offset: { x: -1, y: 0 },
          color: { r: 0.7, g: 0.82, b: 1, a: 0.07 },
          fill: {
            fillType: FILL_TYPES.RADIAL_GRADIENT,
            stops: [
              { offset: 0, color: { r: 0.78, g: 0.86, b: 0.95, a: 0.12 } },
              { offset: 1, color: { r: 0.7, g: 0.88, b: 1, a: 0 } },
            ],
          },
          maxParticles: 240,
        },*/
        ringTrail: {
          spawnIntervalMs: 60,
          lifetimeMs: 820,
          startRadius: 5,
          endRadius: 26,
          startAlpha: 0.065,
          endAlpha: 0,
          innerStop: 0.46,
          outerStop: 0.76,
          color: { r: 0.5, g: 0.7, b: 0.9, a: 0.08 },
        },
        shape: "sprite",
        spriteName: "needle",
        hitRadius: 12,
      },
    },
  },
  silverArmor: {
    id: "silverArmor",
    name: "Silver Carapace",
    description:
      "Interlocking argent scutes sheathe the body, scattering incoming blows across mirrored scales.",
    bonusLabel: "Armor multiplier",
    bonusType: "multiplier",
    baseBonusValue: 1.75,
    bonusPerLevel: 0.05,
    manaCostMultiplier: 2.75,
    sanityCost: 0,
    baseCost: { silver: 100 },
    unlockedBy: [{ type: "map", id: "wire", level: 1 }],
  },
  internalFurnace: {
    id: "internalFurnace",
    name: "Coal Heart",
    description:
      "An embered heart pumps heat through sinew—each consecutive hit stokes the blaze, compounding your offensive frenzy.",
    bonusLabel: "Attack bonus per hit",
    bonusType: "percent",
    baseBonusValue: 0.05,
    bonusPerLevel: 0.005,
    manaCostMultiplier: 2.85,
    sanityCost: 0,
    baseCost: { coal: 100 },
    unlockedBy: [{ type: "map", id: "spruce", level: 1 }],
  },
  mendingGland: {
    id: "mendingGland",
    name: "Mending Pheromone Gland",
    description:
      "Cultured sacs seep soothing pheromones that ripple through the pack, stitching flesh back together. Healing amount = (unit's attack) × (module multiplier). Limited to 10 heals per unit per run.",
    bonusLabel: "Healing pulse multiplier",
    bonusType: "multiplier",
    baseBonusValue: 1.4,
    bonusPerLevel: 0.1,
    manaCostMultiplier: 2.25,
    sanityCost: 0,
    baseCost: { organics: 200, sand: 1000 },
    unlockedBy: [{ type: "skill", id: "pheromones", level: 1 }],
    meta: { cooldownSeconds: 4, healCharges: 100 },
  },
  frenzyGland: {
    id: "frenzyGland",
    name: "Frenzy Pheromone Gland",
    description:
      "Pressurized nodules burst with acrid signals, goading nearby allies into a sharp, short-lived killing trance. Bonus damage per attack = (unit's attack) × (module multiplier).",
    bonusLabel: "Rally surge multiplier",
    bonusType: "multiplier",
    baseBonusValue: 1.4,
    bonusPerLevel: 0.1,
    manaCostMultiplier: 2.25,
    sanityCost: 0,
    baseCost: { organics: 200, stone: 2000 },
    unlockedBy: [{ type: "skill", id: "pheromones", level: 1 }],
    meta: { cooldownSeconds: 5, frenzyAttacks: 8 },
  },
  fireballOrgan: {
    id: "fireballOrgan",
    name: "Fireball Organ",
    description:
      "A blazing core pulses with infernal energy, launching searing fireballs every 4 seconds. Each fireball explodes on impact, dealing (0.75 + 0.0375×level) × unit damage to the target brick and all neighbors within 40 units. However, each fireball launch causes 250% of the fireball's damage as self-damage to the unit.",
    bonusLabel: "Fireball damage multiplier",
    bonusType: "multiplier",
    baseBonusValue: 0.75,
    bonusPerLevel: 0.0375,
    manaCostMultiplier: 3.0,
    sanityCost: 0,
    baseCost: { coal: 800, wood: 1600 },
    unlockedBy: [{ type: "map", id: "spruce", level: 1 }],
    canAttackDistant: true,
    meta: {
      cooldownSeconds: 6,
      fireballExplosionRadius: 40,
      fireballSelfDamagePercent: 2.5,
      fireballMaxDistance: 750,
    },
  },
  burningTail: {
    id: "burningTail",
    name: "Melting Tail",
    description:
      "Caustic glands coat struck masonry, making it more vulnerable to subsequent hits for a short time.",
    bonusLabel: "Incoming damage multiplier",
    bonusType: "multiplier",
    baseBonusValue: 1.5,
    bonusPerLevel: 0.05,
    manaCostMultiplier: 2.6,
    sanityCost: 0,
    baseCost: { magma: 300, organics: 150 },
    unlockedBy: [{ type: "skill", id: "fire_mastery", level: 1 }],
    meta: { areaRadius: 30 },
  },
  freezingTail: {
    id: "freezingTail",
    name: "Freezing Tail",
    description:
      "Thread cryogenic veins through the tail, letting each blow sheath bricks in biting frost.",
    bonusLabel: "Enemy damage divisor",
    bonusType: "multiplier",
    baseBonusValue: 1.5,
    bonusPerLevel: 0.05,
    manaCostMultiplier: 2.6,
    sanityCost: 0,
    baseCost: { ice: 300, sand: 300 },
    unlockedBy: [{ type: "skill", id: "ice_mastery", level: 1 }],
    meta: { areaRadius: 30 },
  },
};


export const getUnitModuleConfig = (id: UnitModuleId): UnitModuleConfig => {
  const config = UNIT_MODULE_DB[id];
  if (!config) {
    throw new Error(`Unknown unit module id: ${id}`);
  }
  return config;
};

export const getAllUnitModuleConfigs = (): UnitModuleConfig[] =>
  UNIT_MODULE_IDS.map((id) => getUnitModuleConfig(id));
