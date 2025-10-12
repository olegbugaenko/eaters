import { ResourceAmount } from "./resources-db";

export const UNIT_MODULE_IDS = ["magnet", "perforator"] as const;

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
}

const UNIT_MODULE_DB: Record<UnitModuleId, UnitModuleConfig> = {
  magnet: {
    id: "magnet",
    name: "Magnet",
    description:
      "Flux lattice arrays siphon additional shards from every shattered brick this ship claims.",
    bonusLabel: "Brick reward multiplier",
    bonusType: "multiplier",
    baseBonusValue: 2,
    bonusPerLevel: 0.1,
    manaCostMultiplier: 1.75,
    sanityCost: 1,
    baseCost: {
      sand: 200,
    },
  },
  perforator: {
    id: "perforator",
    name: "Perforator",
    description:
      "Oscillating drills fracture targets so force ripples outward into the surrounding formation.",
    bonusLabel: "Damage transfer",
    bonusType: "percent",
    baseBonusValue: 0.2,
    bonusPerLevel: 0.01,
    manaCostMultiplier: 1.75,
    sanityCost: 1,
    baseCost: {
      sand: 300,
    },
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
