import { BonusEffectMap } from "@shared/types/bonuses";

export interface AchievementConfig {
  readonly id: AchievementId;
  readonly name: string;
  readonly description: string;
  readonly maxLevel: number;
  readonly effects: BonusEffectMap;
}

export const ACHIEVEMENT_IDS = ["megaBrick", "ancientPyramids"] as const;

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
