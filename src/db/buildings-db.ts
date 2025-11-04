import type { MapId } from "./maps-db";
import type { SkillId } from "./skills-db";
import type { UnlockCondition } from "../types/unlocks";
import { RESOURCE_IDS, ResourceAmount, ResourceId } from "./resources-db";
import { BonusEffectMap } from "../types/bonuses";

export type BuildingId =
  | "quarry"
  | "well"
  | "iron_forest"
  | "mana_plant"
  | "blacksmith";

export type BuildingCostFunction = (level: number) => ResourceAmount;

export interface BuildingConfig {
  readonly id: BuildingId;
  readonly name: string;
  readonly description: string;
  readonly effects: BonusEffectMap;
  readonly cost: BuildingCostFunction;
  readonly maxLevel?: number | null;
  readonly unlockedBy?: readonly UnlockCondition<MapId, SkillId>[];
}

const normalizeLevel = (level: number): number => {
  if (!Number.isFinite(level)) {
    return 1;
  }
  return Math.max(1, Math.floor(level));
};

const createScalingCost = (
  base: ResourceAmount,
  growth: number
): BuildingCostFunction => {
  const normalizedBase: Partial<Record<ResourceId, number>> = {};
  RESOURCE_IDS.forEach((id) => {
    const value = base[id];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      normalizedBase[id] = value;
    }
  });

  return (level: number): ResourceAmount => {
    const targetLevel = normalizeLevel(level);
    const exponent = targetLevel - 1;
    const cost: ResourceAmount = {};
    Object.entries(normalizedBase).forEach(([resourceId, baseValue]) => {
      const scaled = Math.ceil((baseValue ?? 0) * Math.pow(growth, exponent));
      if (scaled > 0) {
        cost[resourceId as ResourceId] = scaled;
      }
    });
    return cost;
  };
};

const BUILDING_DB: Record<BuildingId, BuildingConfig> = {
  quarry: {
    id: "quarry",
    name: "Quarry",
    description:
      "Dedicate crews to hew stone around the clock, passively stockpiling rubble for the camp.",
    effects: {
      stone_income: {
        income: (level) => 2 * level,
      },
    },
    cost: createScalingCost({ copper: 50, wood: 50 }, 1.75),
    unlockedBy: [
      {
        type: "skill",
        id: "construction_guild",
        level: 1,
      },
    ],
  },
  well: {
    id: "well",
    name: "Well",
    description:
      "Sink a reinforced well that seeps mana-laced water, bolstering both focus and resolve.",
    effects: {
      mana_cap: {
        income: (level) => 2 * level,
      },
      sanity_cap: {
        income: (level) => 1 * level,
      },
    },
    cost: createScalingCost({ stone: 2000 }, 1.75),
    unlockedBy: [
      {
        type: "skill",
        id: "construction_guild",
        level: 1,
      },
    ],
  },
  iron_forest: {
    id: "iron_forest",
    name: "Iron Forest",
    description:
      "Forest of steel and soul. Increase your eaters HP",
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level) => 1 + 0.1 * level,
      }
    },
    cost: createScalingCost({ iron: 200, wood: 100 }, 1.75),
    unlockedBy: [
      {
        type: "skill",
        id: "construction_guild",
        level: 1,
      },
    ],
  },
  mana_plant: {
    id: "mana_plant",
    name: "Mana Plant",
    description:
      "Forest of steel and soul. Increase your eaters HP",
    effects: {
      mana_regen: {
        multiplier: (level) => 1 + 0.075 * level,
      }
    },
    cost: createScalingCost({ organics: 200, copper: 500 }, 1.75),
    unlockedBy: [
      {
        type: "skill",
        id: "advanced_construction",
        level: 1,
      },
    ],
  },
  blacksmith: {
    id: "blacksmith",
    name: "Blacksmith",
    description:
      "Establish an arsenal where master smiths overhaul production lines for faster crafting.",
    effects: {
      crafting_speed_mult: {
        multiplier: (level) => 1 + 0.16 * level,
      },
    },
    cost: createScalingCost({ copper: 400, iron: 300 }, 1.75),
    unlockedBy: [
      {
        type: "skill",
        id: "advanced_construction",
        level: 1,
      },
    ],
  },
};

export const BUILDING_IDS = Object.keys(BUILDING_DB) as BuildingId[];

export const getBuildingConfig = (id: BuildingId): BuildingConfig => {
  const config = BUILDING_DB[id];
  if (!config) {
    throw new Error(`Unknown building id: ${id}`);
  }
  return config;
};

export const getAllBuildingConfigs = (): BuildingConfig[] =>
  BUILDING_IDS.map((id) => getBuildingConfig(id));
