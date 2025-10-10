export interface BonusConfig {
  readonly id: BonusId;
  readonly name: string;
  readonly description?: string;
  readonly defaultValue: number;
}

export const BONUS_IDS = [
  "mana_cap",
  "sanity_cap",
  "mana_regen",
  "brick_rewards",
  "blue_vanguard_attack_multiplier",
  "blue_vanguard_hp_multiplier",
  "all_units_hp_multiplier",
  "all_units_attack_multiplier",
  "all_units_armor"
] as const;

export type BonusId = (typeof BONUS_IDS)[number];

const BONUS_DB: Record<BonusId, BonusConfig> = {
  mana_cap: {
    id: "mana_cap",
    name: "Maximum Mana",
    defaultValue: 10,
  },
  sanity_cap: {
    id: "sanity_cap",
    name: "Maximum Sanity",
    defaultValue: 10,
  },
  mana_regen: {
    id: "mana_regen",
    name: "Mana Regeneration",
    defaultValue: 0.6,
  },
  brick_rewards: {
    id: "brick_rewards",
    name: "Brick Rewards",
    defaultValue: 1,
  },
  blue_vanguard_attack_multiplier: {
    id: "blue_vanguard_attack_multiplier",
    name: "Blue Vanguard Attack Multiplier",
    defaultValue: 1,
  },
  blue_vanguard_hp_multiplier: {
    id: "blue_vanguard_hp_multiplier",
    name: "Blue Vanguard HP Multiplier",
    defaultValue: 1,
  },
  all_units_hp_multiplier: {
    id: "all_units_hp_multiplier",
    name: "All Units HP Multiplier",
    defaultValue: 1,
  },
  all_units_attack_multiplier: {
    id: "all_units_attack_multiplier",
    name: "All Units Attack Multiplier",
    defaultValue: 1,
  },
  all_units_armor: {
    id: "all_units_armor",
    name: "All Units Armor",
    defaultValue: 0,
  }
};

export const getBonusConfig = (id: BonusId): BonusConfig => {
  const config = BONUS_DB[id];
  if (!config) {
    throw new Error(`Unknown bonus id: ${id}`);
  }
  return config;
};

export const getAllBonusConfigs = (): BonusConfig[] => BONUS_IDS.map((id) => BONUS_DB[id]);
