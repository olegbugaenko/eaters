import { ResourceAmount, ResourceId } from "./resources-db";
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
  "construction_guild",
  "construction_ledgers",
  "quarry_overseers",
  "granite_bonding",
  "bastion_foundations",
  "sand_scribing",
  "glass_latticework",
  "void_modules",
  "pheromones",
  "emberglass_reactors",
  // "damage_lore",
  "improved_membranes",
  "hunger",
  "stone_drill",
  "stone_armor",
  "vitality",
  "clarity",
  "clarity2",
  "mana_source",
  "mana_reservior",
  "critical_chance",
  "damage_lore",
  "armor_lore",
  "vitality2",
  "clarity3",
  "refinement",
  "refinement2",
  "vitality3",
  "arcane_research",
  "paper_milling",
  "restoration",
  "engineered_plating",
  "armor_lore2",
  "armor_lore3",
  "heavy_drill",
  "tool_fabrication",
  "forged_strikes",
  "silver_drill",
  "penetration",
  "penetration2",
  "soul_wood",
  "advanced_construction"
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

const createResourceCost = (id: ResourceId, base: number, growth: number) =>
  (level: number): ResourceAmount => ({
    [id]: Math.ceil(base * Math.pow(growth, Math.max(level, 1))),
  });

const createDualResourceCost = (
  firstId: ResourceId,
  firstBase: number,
  firstGrowth: number,
  secondId: ResourceId,
  secondBase: number,
  secondGrowth: number
) =>
  (level: number): ResourceAmount => ({
    [firstId]: Math.ceil(firstBase * Math.pow(firstGrowth, Math.max(level, 1))),
    [secondId]: Math.ceil(secondBase * Math.pow(secondGrowth, Math.max(level, 1))),
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
      "A gnawing void urges you on. Feed it with matter so your summons strike harder.",
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
      "Teach your swarms to sift shattered bricks with purpose, increasing stone drawn from debris.",
    nodePosition: { x: 0, y: 1 },
    maxLevel: 3,
    effects: {
      brick_rewards: {
        multiplier: (level) => 1 + 0.25 * level,
      },
    },
    nodesRequired: { hunger: 1 },
    cost: createStoneCost(6, 1.35),
  },
  stone_automatons: {
    id: "stone_automatons",
    name: "Stone Automatons",
    description:
      "Bind mindless servitors to repeat simple rites for you, enabling basic ritual automation.",
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
      "Engrave restart sigils—summoning resumes on its own when the weave collapses.",
    nodePosition: { x: -1, y: 3 },
    maxLevel: 1,
    effects: {},
    nodesRequired: { stone_automatons: 1 },
    cost: createMixedCost(500, 1, 50, 1),
  },
  construction_guild: {
    id: "construction_guild",
    name: "Construction Guild",
    description:
      "Found a guild to coordinate permanent worksites, unlocking dedicated building plans.",
    nodePosition: { x: -1, y: 4 },
    maxLevel: 1,
    effects: {},
    nodesRequired: { autorestart_rituals: 1 },
    cost: createResourceCost("copper", 50, 1),
  },
  advanced_construction: {
    id: "advanced_construction",
    name: "Advanced Construction",
    description:
      "Codify advanced methods for large works—foundation for superior structures.",
    nodePosition: { x: -1, y: 5 },
    maxLevel: 1,
    effects: {},
    nodesRequired: { construction_guild: 1 },
    cost: createResourceCost("copper", 5000, 1),
  },
  construction_ledgers: {
    id: "construction_ledgers",
    name: "Construction Ledgers",
    description:
      "Account every shard and shipment; precision cuts future building costs.",
    nodePosition: { x: -2, y: 5 },
    maxLevel: 80,
    effects: {
      building_cost_multiplier: {
        multiplier: (level) => Math.pow(0.95, level),
      },
    },
    nodesRequired: { construction_guild: 1 },
    cost: createResourceCost("paper", 10, 1.5),
  },
  quarry_overseers: {
    id: "quarry_overseers",
    name: "Quarry Overseers",
    description:
      "Assign tireless haulers so rubble never settles—more stone per shattered brick.",
    nodePosition: { x: 0, y: 2 },
    maxLevel: 5,
    effects: {
      brick_rewards: {
        multiplier: (level) => 1 + 0.2 * level,
      },
    },
    nodesRequired: { stone_lore: 1 },
    cost: createStoneCost(20, 1.4),
  },
  refinement: {
    id: "refinement",
    name: "Refinement",
    description:
      "Refine sorting rites; your gatherers pull richer fragments from the wreckage.",
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
  refinement2: {
    id: "refinement2",
    name: "Refinement II",
    description:
      "Further hone refinement patterns to squeeze even more yield from debris.",
    nodePosition: { x: 0, y: 5 },
    maxLevel: 8,
    effects: {
      brick_rewards: {
        multiplier: (level) => 1 + 0.125 * level,
      },
    },
    nodesRequired: { refinement: 7 },
    cost: createResourceCost('copper', 50, 1.5),
  },
  // top
  glass_latticework: {
    id: "glass_latticework",
    name: "Glass Latticework",
    description:
      "Weave emberglass filaments that steady your focus, modestly improving mana flow.",
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
    name: "Chord",
    description:
      "Imprint a structural chord into your entities, enabling attachment of organs and parts.",
    nodePosition: { x: 0, y: -3 },
    maxLevel: 1,
    effects: {},
    nodesRequired: { glass_latticework: 5 },
    cost: createSandCost(150, 1),
  },
  pheromones: {
    id: "pheromones",
    name: "Pheromones",
    description:
      "Seed your chord lattice with signal glands so your beasts can coordinate through scent and surge.",
    nodePosition: { x: 0, y: -5 },
    maxLevel: 1,
    effects: {},
    nodesRequired: { void_modules: 1 },
    cost: createResourceCost("organics", 200, 1),
  },
  mana_reservior: {
    id: "mana_reservior",
    name: "Mana Reservoir",
    description:
      "Shape capacitors of fused glass to store greater tides of mana.",
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
      "Channel heat through mirrored chambers; surging sand becomes lasting mana stores.",
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
      "Etch careful scribing to strain the stream of sand, expanding mana reserves.",
    nodePosition: { x: -3, y: -4 },
    maxLevel: 5,
    effects: {
      mana_cap: {
        income: (level) => 3 * level,
      },
    },
    nodesRequired: { emberglass_reactors: 2 },
    cost: createSandCost(22, 1.45),
  },
  mana_source: {
    id: "mana_source",
    name: "Mana Source",
    description:
      "Tap a steadier vein of power—both reserves and recovery improve.",
    nodePosition: { x: -3, y: -5 },
    maxLevel: 8,
    effects: {
      mana_cap: {
        income: (level) => 2 * level,
      },
      mana_regen: {
        income: (level) => 0.2*level
      }
    },
    nodesRequired: { sand_scribing: 3 },
    cost: createResourceCost('wood', 20, 1.5),
  },
  soul_wood: {
    id: "soul_wood",
    name: "Soul Wood",
    description:
      "Coax living grain to host stored power, expanding your mana capacity.",
    nodePosition: { x: -4, y: -4 },
    maxLevel: 8,
    effects: {
      mana_cap: {
        income: (level) => 5 * level,
      },
    },
    nodesRequired: { sand_scribing: 5 },
    cost: createResourceCost('wood', 60, 1.5),
  },
  bastion_foundations: {
    id: "bastion_foundations",
    name: "Bastion Foundations",
    description:
      "Lay channelled footings for the mind—wider foundations increase sanity reserves.",
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
      "Quiet the inner static. Clearer thought lets you endure more before madness sets in.",
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
      "Deeper stillness and discipline expand your sanity threshold further.",
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
  clarity3: {
    id: "clarity3",
    name: "Clarity III",
    description:
      "Mastery of focus—your mind holds fast when the void whispers.",
    nodePosition: { x: 3, y: -5 },
    maxLevel: 8,
    effects: {
      sanity_cap: {
        income: (level) => 2 * level,
      },
    },
    nodesRequired: { clarity2: 3 },
    cost: createResourceCost('wood', 50, 1.5),
  },
  // left
  granite_bonding: {
    id: "granite_bonding",
    name: "Granite Bonding",
    description:
      "Fuse matter into denser cores your summons can wield—every strike lands heavier.",
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
      "Affix crude drills to the forming shells of your entities, boosting their assault.",
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
      "Codices of rending—teach your creations how to tear matter more efficiently.",
    nodePosition: { x: -4, y: -1 },
    maxLevel: 15,
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.15 * level,
      },
    },
    nodesRequired: { stone_drill: 2 },
    cost: createSandCost(20, 1.5),
  },
  heavy_drill: {
    id: "heavy_drill",
    name: "Heavy Drill",
    description:
      "Replace crude bits with heavy augers. Mass and torque translate into damage.",
    nodePosition: { x: -6, y: -1 },
    maxLevel: 15,
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.12 * level,
      },
    },
    nodesRequired: { damage_lore: 5 },
    cost: createResourceCost('iron', 30, 1.5),
  },
  tool_fabrication: {
    id: "tool_fabrication",
    name: "Tool Fabrication",
    description: "Commission specialized implements, unlocking advanced crafting techniques.",
    nodePosition: { x: -7, y: -2 },
    maxLevel: 1,
    effects: {},
    nodesRequired: { heavy_drill: 5 },
    cost: createDualResourceCost('iron', 120, 1, 'wood', 80, 1),
  },
  forged_strikes: {
    id: "forged_strikes",
    name: "Forged Strikes",
    description:
      "Temper and quench—meticulous armaments push your vanguard's damage higher.",
    nodePosition: { x: -8, y: -2 },
    maxLevel: 80,
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.08 * level,
      },
    },
    nodesRequired: { tool_fabrication: 1 },
    cost: createResourceCost('tools', 10, 1.5),
  },
  silver_drill: {
    id: "silver_drill",
    name: "Silver Drill",
    description:
      "Silvered bits bite deeper into stubborn matter, further amplifying attacks.",
    nodePosition: { x: -8, y: -1 },
    maxLevel: 15,
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.12 * level,
      },
    },
    nodesRequired: { damage_lore: 5 },
    cost: createResourceCost('silver', 60, 1.5),
  },
  critical_chance: {
    id: "critical_chance",
    name: "Critical Chance",
    description:
      "Sharpen instincts and edges alike—your units find weak points more often.",
    nodePosition: { x: -4, y: 1 },
    maxLevel: 10,
    effects: {
      all_units_crit_chance: {
        income: (level) => 0.02 * level,
      },
    },
    nodesRequired: { stone_drill: 2 },
    cost: createMixedCost(200, 1.5, 20, 1.5),
  },
  penetration: {
    id: "penetration",
    name: "Penetration",
    description:
      "Hardened tips and angled force let your strikes pierce tougher shells.",
    nodePosition: { x: -6, y: 1 },
    maxLevel: 15,
    effects: {
      all_units_armor_penetration: {
        income: (level) => 1.25 * level,
      },
    },
    nodesRequired: { critical_chance: 5 },
    cost: createResourceCost('organics', 50, 1.5),
  },
  penetration2: {
    id: "penetration2",
    name: "Penetration II",
    description:
      "Refine the geometry of impact; even plated foes yield to your bite.",
    nodePosition: { x: -7, y: 2 },
    maxLevel: 15,
    effects: {
      all_units_armor_penetration: {
        income: (level) => 2 * level,
      },
    },
    nodesRequired: { penetration: 5 },
    cost: createResourceCost('copper', 60, 1.5),
  },
  // right
  improved_membranes: {
    id: "improved_membranes",
    name: "Improved Membranes",
    description:
      "Stiffen ephemeral skins into resilient membranes—your entities endure more.",
    nodePosition: { x: 1, y: 0 },
    maxLevel: 5,
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
      "Grow thicker layers of living matter around your cores, raising total vitality.",
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
      "Bind stone plates over pulsing forms—basic armor that turns glancing blows.",
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
      "Treatises on layering and bracing—improve how well armor spreads force.",
    nodePosition: { x: 4, y: 1 },
    maxLevel: 15,
    effects: {
      all_units_armor: {
        income: (level) => 0 + 0.5 * level,
      },
    },
    nodesRequired: { stone_armor: 3 },
    cost: createMixedCost(200, 1.5, 20, 1.5),
  },
  armor_lore2: {
    id: "armor_lore2",
    name: "Armor Lore II",
    description:
      "Advanced schemata: ribbing, overlaps, anchor points—denser protection.",
    nodePosition: { x: 6, y: 1 },
    maxLevel: 15,
    effects: {
      all_units_armor: {
        income: (level) => 0 + 0.75 * level,
      },
    },
    nodesRequired: { armor_lore: 5 },
    cost: createResourceCost('iron', 30, 1.5),
  },
  armor_lore3: {
    id: "armor_lore3",
    name: "Armor Lore III",
    description:
      "Master forging of living plate—your hosts shrug off punishing blows.",
    nodePosition: { x: 8, y: 1 },
    maxLevel: 15,
    effects: {
      all_units_armor: {
        income: (level) => 1.5*level,
      },
    },
    nodesRequired: { armor_lore2: 5 },
    cost: createResourceCost('silver', 60, 1.5),
  },
  vitality2: {
    id: "vitality2",
    name: "Vitality II",
    description:
      "Cultivate richer biomass; the flesh‑cores swell with fresh reserves.",
    nodePosition: { x: 4, y: -1 },
    maxLevel: 15,
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level) => 1 + 0.16 * level,
      },
    },
    nodesRequired: { stone_armor: 3 },
    cost: createSandCost(20, 1.5),
  },
  vitality3: {
    id: "vitality3",
    name: "Vitality III",
    description:
      "Engineered organs and redundant latticework markedly raise hit capacity.",
    nodePosition: { x: 6, y: -1 },
    maxLevel: 15,
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level) => 1 + 0.12 * level,
      },
    },
    nodesRequired: { vitality2: 5 },
    cost: createResourceCost('organics', 30, 1.5),
  },
  paper_milling: {
    id: "paper_milling",
    name: "Paper Milling",
    description: "Pulp organics into disciplined sheets fit for resilient schematics.",
    nodePosition: { x: 7, y: 0 },
    maxLevel: 1,
    effects: {},
    nodesRequired: { vitality3: 5 },
    cost: createDualResourceCost('organics', 120, 1, 'wood', 80, 1),
  },
  arcane_research: {
    id: "arcane_research",
    name: "Arcane Research",
    description:
      "Document repeatable mana experiments; each insight slightly accelerates regen.",
    nodePosition: { x: -3, y: -6 },
    maxLevel: 80,
    effects: {
      mana_regen: {
        multiplier: (level) => 1 + 0.08*Math.pow(1.03, level)*level,
      },
    },
    nodesRequired: { mana_source: 5 },
    cost: createResourceCost('paper', 10, 1.5),
  },
  restoration: {
    id: "restoration",
    name: "Restoration",
    description:
      "Teach your creations to knit themselves mid‑battle—steady percentage regen.",
    nodePosition: { x: 7, y: -2 },
    maxLevel: 10,
    effects: {
      all_units_hp_regen_percentage: {
        income: (level) => 0.5*level,
      },
    },
    nodesRequired: { vitality3: 5 },
    cost: createResourceCost('organics', 150, 2),
  },
  engineered_plating: {
    id: "engineered_plating",
    name: "Engineered Plating",
    description:
      "Outfit constructs with calculated bracing and plates—substantial increase to health.",
    nodePosition: { x: 8, y: -3 },
    maxLevel: 80,
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level) => 1 + 0.08 * level,
      },
    },
    nodesRequired: { restoration: 5 },
    cost: createResourceCost('tools', 10, 1.5),
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
