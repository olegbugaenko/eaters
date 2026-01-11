import { BonusEffectMap } from "@shared/types/bonuses";

export interface AchievementConfig {
  readonly id: AchievementId;
  readonly name: string;
  readonly description: string;
  readonly maxLevel: number;
  readonly effects: BonusEffectMap;
}

export const ACHIEVEMENT_IDS = ["megaBrick", "ancientPyramids", "deathfulGuns", "deadly_tunnels", "encaged_beast"] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

const ACHIEVEMENTS_DB: Record<AchievementId, AchievementConfig> = {
  megaBrick: {
    id: "megaBrick",
    name: "Mega Brick Mastery",
    description: "Complete Mega Brick levels to boost brick rewards.",
    maxLevel: 10,
    effects: {
      brick_rewards: {
        multiplier: (level) => 1 + 0.1 * level,
      },
    },
  },
  ancientPyramids: {
    id: "ancientPyramids",
    name: "Ancient Piramids Mastery",
    description: "Complete Ancient Piramids levels to boost unit HP.",
    maxLevel: 10,
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level) => 1 + 0.1 * level,
      },
    },
  },
  deathfulGuns: {
    id: "deathfulGuns",
    name: "Deathful Guns Mastery",
    description: "Complete Deathful Guns levels to boost unit damage.",
    maxLevel: 10,
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.1 * level,
      },
    },
  },
  deadly_tunnels: {
    id: "deadly_tunnels",
    name: "Deadly Tunnels Mastery",
    description: "Complete Deadly Tunnels levels to boost unit damage.",
    maxLevel: 10,
    effects: {
      all_units_armor_multiplier: {
        multiplier: (level) => 1 + 0.1 * level,
      },
    },
  },
  encaged_beast: {
    id: "encaged_beast",
    name: "Encaged Beast Mastery",
    description: "Complete Encaged Beast levels to boost unit damage.",
    maxLevel: 10,
    effects: {
      sanity_cap: {
        income: (level) => 2 * level,
      },
    },
  },
};

export const getAchievementConfig = (id: AchievementId): AchievementConfig => {
  const config = ACHIEVEMENTS_DB[id];
  if (!config) {
    throw new Error(`Unknown achievement id: ${id}`);
  }
  return config;
};

export const getAllAchievementConfigs = (): AchievementConfig[] =>
  ACHIEVEMENT_IDS.map((id) => ACHIEVEMENTS_DB[id]);
