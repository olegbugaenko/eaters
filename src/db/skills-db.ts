import { ResourceAmount } from "./resources-db";
import { BonusEffectMap } from "../types/bonuses";

export interface SkillNodePosition {
  readonly x: number;
  readonly y: number;
}

export type SkillCostFunction = (level: number) => ResourceAmount;

export interface SkillConfig {
  readonly id: SkillId;
  readonly name: string;
  readonly description: string;
  readonly nodePosition: SkillNodePosition;
  readonly maxLevel: number;
  readonly effects: BonusEffectMap;
  readonly nodesRequired: Partial<Record<SkillId, number>>;
  readonly cost: SkillCostFunction;
}

export const SKILL_IDS = [
  "stone_lore",
  "stone_automatons",
  "autorestart_rituals",
  "quarry_overseers",
  "granite_bonding",
  "bastion_foundations",
  "sand_scribing",
  "glass_latticework",
  "void_modules",
  "emberglass_reactors",
  // "damage_lore",
  "improved_membranes",
  "hunger",
  "stone_drill",
  "stone_armor",
  "vitality",
  "clarity",
  "mana_reservior",
  "critical_chance",
  "damage_lore",
  "armor_lore",
  "vitality2",
  "clarity2",
  "refinement"
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

const createStoneCost = (base: number, growth: number) =>
  (level: number): ResourceAmount => ({
    stone: Math.ceil(base * Math.pow(growth, Math.max(level, 1))),
  });

const createSandCost = (base: number, growth: number) =>
  (level: number): ResourceAmount => ({
    sand: Math.ceil(base * Math.pow(growth, Math.max(level, 1))),
  });

const createMixedCost = (
  stoneBase: number,
  stoneGrowth: number,
  sandBase: number,
  sandGrowth: number
) =>
  (level: number): ResourceAmount => ({
    stone: Math.ceil(stoneBase * Math.pow(stoneGrowth, Math.max(level, 1))),
    sand: Math.ceil(sandBase * Math.pow(sandGrowth, Math.max(level, 1))),
  });

const SKILL_DB: Record<SkillId, SkillConfig> = {
  hunger: {
    id: "hunger",
    name: "Hunger",
    description:
      "You feel hungry...",
    nodePosition: { x: 0, y: 0 },
    maxLevel: 3,
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.3 * level,
      },
    },
    nodesRequired: { },
    cost: createStoneCost(4, 1.35),
  },
  // Bottom branch
  stone_lore: {
    id: "stone_lore",
    name: "Stone Lore",
    description:
      "Foundational studies in sorting shattered bricks, enabling steadier stone yields.",
    nodePosition: { x: 0, y: 1 },
    maxLevel: 3,
    effects: {
      brick_rewards: {
        multiplier: (level) => 1 + 0.2 * level,
      },
    },
    nodesRequired: { hunger: 1 },
    cost: createStoneCost(6, 1.35),
  },
  stone_automatons: {
    id: "stone_automatons",
    name: "Stone Automatons",
    description:
      "Teach tireless constructs to prepare summoning circles on their own, enabling automated call-ups.",
    nodePosition: { x: -1, y: 2 },
    maxLevel: 1,
    effects: {},
    nodesRequired: { stone_lore: 1 },
    cost: createStoneCost(20, 1),
  },
  autorestart_rituals: {
    id: "autorestart_rituals",
    name: "Autorestart Sigils",
    description:
      "Imprint cascading reset sigils so collapse teams can reweave summoning circles without supervision.",
    nodePosition: { x: -1, y: 3 },
    maxLevel: 1,
    effects: {},
    nodesRequired: { stone_automatons: 1 },
    cost: createMixedCost(500, 1, 50, 1),
  },
  quarry_overseers: {
    id: "quarry_overseers",
    name: "Quarry Overseers",
    description:
      "Assign dedicated haulers who keep rubble moving and expose richer stone veins.",
    nodePosition: { x: 0, y: 2 },
    maxLevel: 5,
    effects: {
      brick_rewards: {
        multiplier: (level) => 1 + 0.1 * level,
      },
    },
    nodesRequired: { stone_lore: 1 },
    cost: createStoneCost(20, 1.4),
  },
  refinement: {
    id: "refinement",
    name: "Refinement",
    description:
      "Assign dedicated haulers who keep rubble moving and expose richer stone veins.",
    nodePosition: { x: 0, y: 3 },
    maxLevel: 15,
    effects: {
      brick_rewards: {
        multiplier: (level) => 1 + 0.08 * level,
      },
    },
    nodesRequired: { quarry_overseers: 3 },
    cost: createSandCost(50, 1.5),
  },
  // top
  glass_latticework: {
    id: "glass_latticework",
    name: "Glass Latticework",
    description:
      "Weave molten filaments into frameworks that stabilize fragile sand constructs.",
    nodePosition: { x: 0, y: -1},
    maxLevel: 5,
    effects: {
      mana_regen: {
        income: (level) => 0.12 * level,
      },
    },
    nodesRequired: { hunger: 1 },
    cost: createStoneCost(6, 1.35),
  },
  void_modules: {
    id: "void_modules",
    name: "Void Module Fabrication",
    description:
      "Unlock fabrication rites for modular ship augments forged from refracted glass.",
    nodePosition: { x: 0, y: -3 },
    maxLevel: 1,
    effects: {},
    nodesRequired: { glass_latticework: 5 },
    cost: createSandCost(250, 1),
  },
  mana_reservior: {
    id: "mana_reservior",
    name: "Mana Reservior",
    description:
      "Weave molten filaments into frameworks that stabilize fragile sand constructs.",
    nodePosition: { x: -1, y: -2},
    maxLevel: 5,
    effects: {
      mana_cap: {
        income: (level) => 3 * level,
      },
    },
    nodesRequired: { glass_latticework: 1 },
    cost: createStoneCost(15, 1.35),
  },
  emberglass_reactors: {
    id: "emberglass_reactors",
    name: "Emberglass Reactors",
    description:
      "Channel heat through mirrored chambers, transmuting sand surges into lasting stores.",
    nodePosition: { x: -2, y: -3 },
    maxLevel: 5,
    effects: {
      mana_cap: {
        income: (level) => 2 * level,
      },
      mana_regen: {
        income: (level) => 0.12 * level,
      },
    },
    nodesRequired: { glass_latticework: 1 },
    cost: createStoneCost(100, 1.55),
  },
  sand_scribing: {
    id: "sand_scribing",
    name: "Sand Scribing",
    description:
      "Refine sieving rituals that separate glimmering sand from dull dust motes.",
    nodePosition: { x: -3, y: -4 },
    maxLevel: 4,
    effects: {
      mana_cap: {
        income: (level) => 3 * level,
      },
    },
    nodesRequired: { emberglass_reactors: 2 },
    cost: createSandCost(22, 1.45),
  },
  bastion_foundations: {
    id: "bastion_foundations",
    name: "Bastion Foundations",
    description:
      "Lay channelled footings so every slab stacks true, preparing for future defenses.",
    nodePosition: { x: 1, y: -2 },
    maxLevel: 3,
    effects: {
      sanity_cap: {
        income: (level) => 2 * level,
      },
    },
    nodesRequired: { glass_latticework: 1 },
    cost: createStoneCost(26, 1.5),
  },
  clarity: {
    id: "clarity",
    name: "Clarity",
    description:
      "Refine sieving rituals that separate glimmering sand from dull dust motes.",
    nodePosition: { x: 2, y: -3 },
    maxLevel: 4,
    effects: {
      sanity_cap: {
        income: (level) => 2 * level,
      },
    },
    nodesRequired: { bastion_foundations: 2 },
    cost: createStoneCost(100, 1.45),
  },
  clarity2: {
    id: "clarity2",
    name: "Clarity II",
    description:
      "Refine sieving rituals that separate glimmering sand from dull dust motes.",
    nodePosition: { x: 3, y: -4 },
    maxLevel: 5,
    effects: {
      sanity_cap: {
        income: (level) => 2 * level,
      },
    },
    nodesRequired: { clarity: 3 },
    cost: createSandCost(50, 1.5),
  },
  // left
  granite_bonding: {
    id: "granite_bonding",
    name: "Granite Bonding",
    description:
      "Fuse heavy chunks together, forming denser stockpiles that resist crumble losses.",
    nodePosition: { x: -1, y: 0 },
    maxLevel: 3,
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.18 * level,
      },
    },
    nodesRequired: { hunger: 2 },
    cost: createStoneCost(16, 1.5),
  },
  stone_drill: {
    id: "stone_drill",
    name: "Stone Drill",
    description:
      "Fuse heavy chunks together, forming denser stockpiles that resist crumble losses.",
    nodePosition: { x: -3, y: 0 },
    maxLevel: 5,
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.12 * level,
      },
    },
    nodesRequired: { granite_bonding: 2 },
    cost: createStoneCost(50, 1.5),
  },
  damage_lore: {
    id: "damage_lore",
    name: "Damage Lore",
    description:
      "Fuse heavy chunks together, forming denser stockpiles that resist crumble losses.",
    nodePosition: { x: -4, y: -1 },
    maxLevel: 15,
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.15 * level,
      },
    },
    nodesRequired: { stone_drill: 2 },
    cost: createSandCost(50, 1.5),
  },
  critical_chance: {
    id: "critical_chance",
    name: "Critical Chance",
    description:
      "Fuse heavy chunks together, forming denser stockpiles that resist crumble losses.",
    nodePosition: { x: -4, y: 1 },
    maxLevel: 10,
    effects: {
      all_units_crit_chance: {
        income: (level) => 0.02 * level,
      },
    },
    nodesRequired: { stone_drill: 2 },
    cost: createMixedCost(500, 1.5, 50, 1.5),
  },
  // right
  improved_membranes: {
    id: "improved_membranes",
    name: "Improved Membranes",
    description:
      "Fuse heavy chunks together, forming denser stockpiles that resist crumble losses.",
    nodePosition: { x: 1, y: 0 },
    maxLevel: 3,
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level) => 1 + 0.18 * level,
      },
    },
    nodesRequired: { hunger: 2 },
    cost: createStoneCost(4, 1.5),
  },
  vitality: {
    id: "vitality",
    name: "Vitality",
    description:
      "Fuse heavy chunks together, forming denser stockpiles that resist crumble losses.",
    nodePosition: { x: 2, y: 0 },
    maxLevel: 5,
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level) => 1 + 0.15 * level,
      },
    },
    nodesRequired: { improved_membranes: 2 },
    cost: createStoneCost(16, 1.5),
  },
  stone_armor: {
    id: "stone_armor",
    name: "Stone Armor",
    description:
      "Fuse heavy chunks together, forming denser stockpiles that resist crumble losses.",
    nodePosition: { x: 3, y: 0 },
    maxLevel: 5,
    effects: {
      all_units_armor: {
        income: (level) => 0 + 0.25 * level,
      },
    },
    nodesRequired: { vitality: 2 },
    cost: createStoneCost(50, 1.5),
  },
  armor_lore: {
    id: "armor_lore",
    name: "Armor Lore",
    description:
      "Fuse heavy chunks together, forming denser stockpiles that resist crumble losses.",
    nodePosition: { x: 4, y: 1 },
    maxLevel: 10,
    effects: {
      all_units_armor: {
        income: (level) => 0 + 0.5 * level,
      },
    },
    nodesRequired: { stone_armor: 3 },
    cost: createMixedCost(500, 1.5, 50, 1.5),
  },
  vitality2: {
    id: "vitality2",
    name: "Vitality II",
    description:
      "Fuse heavy chunks together, forming denser stockpiles that resist crumble losses.",
    nodePosition: { x: 4, y: -1 },
    maxLevel: 15,
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level) => 1 + 0.16 * level,
      },
    },
    nodesRequired: { stone_armor: 3 },
    cost: createSandCost(50, 1.5),
  },
};

export const getSkillConfig = (id: SkillId): SkillConfig => {
  const config = SKILL_DB[id];
  if (!config) {
    throw new Error(`Unknown skill id: ${id}`);
  }
  return config;
};

export const getAllSkillConfigs = (): SkillConfig[] =>
  SKILL_IDS.map((id) => SKILL_DB[id]);
