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
  "stone_income",
  "blue_vanguard_attack_multiplier",
  "blue_vanguard_hp_multiplier",
  "all_units_hp_multiplier",
  "all_units_attack_multiplier",
  "all_units_armor",
  "all_units_armor_multiplier",
  "all_units_crit_mult",
  "all_units_crit_chance",
  "all_units_hp_regen_percentage",
  "all_units_armor_penetration",
  "all_units_knockback_reduction",
  "spell_power",
  "crafting_speed_mult",
  "building_cost_multiplier"
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
    defaultValue: 5,
  },
  mana_regen: {
    id: "mana_regen",
    name: "Mana Regeneration",
    defaultValue: 0.8,
  },
  brick_rewards: {
    id: "brick_rewards",
    name: "Brick Rewards",
    defaultValue: 1,
  },
  stone_income: {
    id: "stone_income",
    name: "Stone Passive Income",
    defaultValue: 0,
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
  },
  all_units_armor_multiplier: {
    id: "all_units_armor_multiplier",
    name: "All Units Armor Multiplier",
    defaultValue: 1,
  },
  all_units_crit_chance: {
    id: "all_units_crit_chance",
    name: "Critical Chance",
    defaultValue: 0,
  },
  all_units_crit_mult: {
    id: "all_units_crit_mult",
    name: "Critical Multiplier",
    defaultValue: 2,
  },
  all_units_hp_regen_percentage: {
    id: "all_units_hp_regen_percentage",
    name: "HP Regeneration",
    defaultValue: 0,
  },
  all_units_armor_penetration: {
    id: "all_units_armor_penetration",
    name: "Brick Armor Penetration",
    defaultValue: 0
  },
  all_units_knockback_reduction: {
    id: "all_units_knockback_reduction",
    name: "Knockback Reduction",
    description: "Divides incoming knockback effects.",
    defaultValue: 1,
  },
  spell_power: {
    id: "spell_power",
    name: "Spell Power",
    description: "Multiplies the damage dealt by your spells.",
    defaultValue: 1,
  },
  crafting_speed_mult: {
    id: "crafting_speed_mult",
    name: "Crafting Speed Multiplier",
    defaultValue: 1,
  },
  building_cost_multiplier: {
    id: "building_cost_multiplier",
    name: "Building Cost Multiplier",
    defaultValue: 1,
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
