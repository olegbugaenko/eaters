import { ResourceAmount } from "./resources-db";
import type { MapId } from "./maps-db";
import type { SkillId } from "./skills-db";
import type { UnlockCondition } from "../types/unlocks";

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
] as const;

export type UnitModuleId = (typeof UNIT_MODULE_IDS)[number];

export type UnitModuleBonusType = "multiplier" | "percent";

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
    meta: { cooldownSeconds: 4, healCharges: 10 },
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
      "A blazing core pulses with infernal energy, launching searing fireballs every 4 seconds. Each fireball explodes on impact, dealing (1.75 + 0.075×level) × unit damage to the target brick and all neighbors within 40 pixels. However, each fireball launch causes 75% of the fireball's damage as self-damage to the unit.",
    bonusLabel: "Fireball damage multiplier",
    bonusType: "multiplier",
    baseBonusValue: 1.75,
    bonusPerLevel: 0.075,
    manaCostMultiplier: 3.0,
    sanityCost: 0,
    baseCost: { coal: 400, wood: 800 },
    unlockedBy: [{ type: "map", id: "spruce", level: 1 }],
    canAttackDistant: true,
    meta: { cooldownSeconds: 4 },
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
