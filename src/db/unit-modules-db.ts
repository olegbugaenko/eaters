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
    sanityCost: 1,
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
    sanityCost: 1,
    baseCost: { sand: 200 },
  },
  vitalHull: {
    id: "vitalHull",
    name: "Vital Flesh",
    description:
      "Bio-reactive tissues graft and swell, thickening the creature’s living bulk and knitting wounds as it grows.",
    bonusLabel: "Max HP multiplier",
    bonusType: "multiplier",
    baseBonusValue: 1.8,
    bonusPerLevel: 0.08,
    manaCostMultiplier: 2.5,
    sanityCost: 1,
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
    baseBonusValue: 1.8,
    bonusPerLevel: 0.08,
    manaCostMultiplier: 2.5,
    sanityCost: 1,
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
    baseBonusValue: 1.5,
    bonusPerLevel: 0.05,
    manaCostMultiplier: 2.75,
    sanityCost: 1,
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
    sanityCost: 1,
    baseCost: { coal: 100 },
    unlockedBy: [{ type: "map", id: "spruce", level: 1 }],
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
