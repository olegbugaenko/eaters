import type { BonusEffectMap } from "@shared/types/bonuses";

export const DARK_RESEARCH_IDS = [
  "dark_armor",
  "darkest_endurance",
  "greediness",
  "bite_of_void",
  "void_penetration",
] as const;

export type DarkResearchId = (typeof DARK_RESEARCH_IDS)[number];

export interface DarkResearchConfig {
  readonly id: DarkResearchId;
  readonly name: string;
  readonly description: string;
  readonly icon?: string;
  readonly maxXpPerLevelBase: number;
  readonly xpPowerBase: number;
  readonly effects: BonusEffectMap;
}

const DARK_RESEARCH_DB: Record<DarkResearchId, DarkResearchConfig> = {
  dark_armor: {
    id: "dark_armor",
    name: "Dark Armor",
    description: "Infuse your brood with abyssal shell plating. Grants +1% armor per level.",
    icon: "armor4.png",
    maxXpPerLevelBase: 100,
    xpPowerBase: 0.1,
    effects: {
      all_units_armor_multiplier: {
        multiplier: (level) => 1 + 0.02 * level,
      },
    },
  },
  darkest_endurance: {
    id: "darkest_endurance",
    name: "Darkest Endurance",
    description: "Harden creature vitality against void pressure. Grants +1% HP per level.",
    icon: "health_4.png",
    maxXpPerLevelBase: 100,
    xpPowerBase: 0.1,
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level) => 1 + 0.02 * level,
      },
    },
  },
  greediness: {
    id: "greediness",
    name: "Greediness",
    description: "Train scavengers to recover richer shards. Grants +1% brick rewards per level.",
    icon: "resource_gain_4.png",
    maxXpPerLevelBase: 100,
    xpPowerBase: 0.1,
    effects: {
      brick_rewards: {
        multiplier: (level) => 1 + 0.02 * level,
      },
    },
  },
  bite_of_void: {
    id: "bite_of_void",
    name: "Bite of Void",
    description: "Sharpen every strike with a null-space edge. Grants +1% damage per level.",
    icon: "attack_5.png",
    maxXpPerLevelBase: 100,
    xpPowerBase: 0.1,
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.02 * level,
      },
    },
  },
  void_penetration: {
    id: "void_penetration",
    name: "Void Penetration",
    description:
      "Teach your brood to find seams in plated defenses. Grants +2 brick armor penetration per research level.",
    icon: "penetration_2.png",
    maxXpPerLevelBase: 100,
    xpPowerBase: 0.1,
    effects: {
      all_units_armor_penetration: {
        income: (level) => 2 * level,
      },
    },
  },
};

export const getDarkResearchConfig = (id: DarkResearchId): DarkResearchConfig => {
  const config = DARK_RESEARCH_DB[id];
  if (!config) {
    throw new Error(`Unknown dark research id: ${id}`);
  }
  return config;
};
