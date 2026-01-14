import { ResourceAmount, ResourceId } from "./resources-db";
import { BonusEffectContext, BonusEffectMap } from "@shared/types/bonuses";

export interface SkillNodePosition {
  readonly x: number;
  readonly y: number;
}

export type SkillCostFunction = (level: number) => ResourceAmount;

export interface SkillConfig {
  readonly id: SkillId;
  readonly name: string;
  readonly description: string;
  readonly icon?: string;
  readonly nodePosition: SkillNodePosition;
  readonly maxLevel: number;
  readonly effects: BonusEffectMap;
  readonly nodesRequired: Partial<Record<SkillId, number>>;
  readonly cost: SkillCostFunction;
  readonly registerEvent?: {
    readonly text: string;
  };
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
  "arcane_amplifier",
  "sandstorm_ritual",
  "black_darts",
  "ring_of_fire",
  "sharp_mind",
  "sharp_mind2",
  "void_modules",
  "tail_spines",
  "pheromones",
  "ice_mastery",
  "fire_mastery",
  "emberglass_reactors",
  "spiritual_powers",
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
  "critical_chance2",
  "damage_lore",
  "armor_lore",
  "impact_dampening",
  "vitality2",
  "clarity3",
  "refinement",
  "refinement2",
  "vitality3",
  "vitality4",
  "arcane_research",
  "paper_milling",
  "restoration",
  "engineered_plating",
  "armor_lore2",
  "armor_lore3",
  "armor_lore4",
  "heavy_drill",
  "tool_fabrication",
  "forged_strikes",
  "silver_drill",
  "penetration",
  "penetration2",
  "penetration3",
  "soul_wood",
  "advanced_construction",
  "advanced_crafting",
  "consiousness",
  "arcane_awareness",
  "weaken_curse",
  "perseverance",
  "inspiration",
  "spell_power"
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

const getClearedLevelsTotal = (context?: BonusEffectContext, level?: number): number => {
  return Math.max(0, context?.clearedMapLevelsTotal ?? 0);
}

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
  consiousness: {
    id: "consiousness",
    name: "Consciousness",
    description:
      "Strengthen your mental fortitude, expanding the limits of your consciousness to endure longer on the map.",
    nodePosition: { x: 0, y: 0 },
    icon: "consiousnes_1.png",
    maxLevel: 5,
    effects: {
      sanity_cap: {
        income: (level) => 0.5 * level,
      },
    },
    nodesRequired: { },
    cost: createStoneCost(2, 1.35),
  },
  // Bottom branch
  stone_lore: {
    id: "stone_lore",
    name: "Stone Lore",
    description:
      "Teach your swarms to sift shattered bricks with purpose, increasing stone drawn from debris.",
    nodePosition: { x: 0, y: 1 },
    maxLevel: 3,
    icon: "resource_gain_1.png",
    effects: {
      brick_rewards: {
        multiplier: (level) => 1 + 0.25 * level,
      },
    },
    nodesRequired: { consiousness: 1 },
    cost: createStoneCost(2, 1.5),
  },
  stone_automatons: {
    id: "stone_automatons",
    name: "Stone Automatons",
    description:
      "Bind mindless servitors to repeat simple rites for you, enabling basic ritual automation.",
    nodePosition: { x: -1, y: 2 },
    maxLevel: 1,
    icon: "automation_1.png",
    effects: {},
    nodesRequired: { stone_lore: 1 },
    cost: createStoneCost(10, 1),
    registerEvent: {
      text: "You awaken your creator instinct.",
    },
  },
  autorestart_rituals: {
    id: "autorestart_rituals",
    name: "Autorestart Sigils",
    description:
      "Allows the map to automatically restart after completion or defeat.",
    nodePosition: { x: -1, y: 3 },
    maxLevel: 1,
    icon: "automation_2.png",
    effects: {},
    nodesRequired: { stone_automatons: 1 },
    cost: createStoneCost(500, 1),
    registerEvent: {
      text: "Sigils now repeat the ritual unbidden.",
    },
  },
  construction_guild: {
    id: "construction_guild",
    name: "Construction Guild",
    description:
      "Found a guild to coordinate permanent worksites, unlocking dedicated building plans.",
    nodePosition: { x: -1, y: 4 },
    maxLevel: 1,
    icon: "constructions_1.png",
    effects: {},
    nodesRequired: { autorestart_rituals: 1 },
    cost: createResourceCost("copper", 50, 1),
    registerEvent: {
      text: "A permanent guild answers your call.",
    },
  },
  advanced_construction: {
    id: "advanced_construction",
    name: "Advanced Construction",
    description:
      "Codify advanced methods for large works—foundation for superior structures.",
    nodePosition: { x: -1, y: 5 },
    maxLevel: 1,
    icon: "constructions_2.png",
    effects: {},
    nodesRequired: { construction_guild: 1 },
    cost: createResourceCost("copper", 5000, 1),
  },
  advanced_crafting: {
    id: "advanced_crafting",
    name: "Advanced Crafting",
    description:
      "Improve your crafting speed.",
    nodePosition: { x: -1, y: 6 },
    maxLevel: 20,
    icon: "crafting_speed.png",
    effects: {
      "crafting_speed_mult": {
        multiplier: (level) => 1 + 0.125 * level,
      },
    },
    nodesRequired: { advanced_construction: 1 },
    cost: createResourceCost("silver", 100, 1.5),
  },
  construction_ledgers: {
    id: "construction_ledgers",
    name: "Construction Ledgers",
    description:
      "Account every shard and shipment; precision cuts future building costs.",
    nodePosition: { x: -2, y: 5 },
    maxLevel: 80,
    icon: "constructions_ledger.png",
    effects: {
      building_cost_multiplier: {
        multiplier: (level) => Math.pow(0.97, level),
      },
    },
    nodesRequired: { construction_guild: 1 },
    cost: createResourceCost("paper", 8, 1.5),
  },
  quarry_overseers: {
    id: "quarry_overseers",
    name: "Quarry Overseers",
    description:
      "Assign tireless haulers so rubble never settles—more stone per shattered brick.",
    nodePosition: { x: 0, y: 2 },
    icon: "resource_gain_2.png",
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
    icon: "resource_gain_3.png",
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
    icon: "resource_gain_4.png",
    effects: {
      brick_rewards: {
        multiplier: (level) => 1 + 0.125 * level,
      },
    },
    nodesRequired: { refinement: 7 },
    cost: createResourceCost('copper', 50, 1.5),
  },
  void_modules: {
    id: "void_modules",
    name: "Chord",
    description:
      "Imprint a structural chord into your entities, enabling attachment of organs and parts.",
    nodePosition: { x: 1, y: 2 },
    maxLevel: 1,
    icon: "chorde.png",
    effects: {},
    nodesRequired: { stone_lore: 3 },
    cost: createSandCost(150, 1),
    registerEvent: {
      text: "A chord resonates for organs and parts.",
    },
  },
  tail_spines: {
    id: "tail_spines",
    name: "Tail Spines",
    description:
      "Graft barbed spines along the chord, enabling sideways volleys from attached quills.",
    nodePosition: { x: 2, y: 2 },
    icon: "needles.png",
    maxLevel: 1,
    effects: {},
    nodesRequired: { void_modules: 1 },
    cost: createResourceCost("iron", 200, 1),
  },
  pheromones: {
    id: "pheromones",
    name: "Pheromones",
    description:
      "Seed your chord lattice with signal glands so your beasts can coordinate through scent and surge.",
    nodePosition: { x: 2, y: 3 },
    maxLevel: 1,
    icon: "pheromones.png",
    effects: {},
    nodesRequired: { void_modules: 1 },
    cost: createResourceCost("organics", 200, 1),
  },
  ice_mastery: {
    id: "ice_mastery",
    name: "Ice Mastery",
    description:
      "Master the art of ice magic, allowing you to freeze enemies.",
    nodePosition: { x: 2, y: 4 },
    nodesRequired: { pheromones: 1 },
    maxLevel: 1,
    icon: "ice_mastery.png",
    effects: {},
    cost: createResourceCost("ice", 400, 1),
  },
  fire_mastery: {
    id: "fire_mastery",
    name: "Fire Mastery",
    description:
      "Master the art of fire magic.",
    nodePosition: { x: 3, y: 3 },
    nodesRequired: { pheromones: 1 },
    maxLevel: 1,
    icon: "fire_mastery.png",
    effects: {
    },
    cost: createResourceCost("magma", 400, 1),
  },
  // top
  glass_latticework: {
    id: "glass_latticework",
    name: "Glass Latticework",
    description:
      "Weave emberglass filaments that steady your focus, modestly improving mana flow.",
    nodePosition: { x: 0, y: -1},
    maxLevel: 5,
    icon: "mana_regen_1.png",
    effects: {
      mana_regen: {
        income: (level) => 0.08 * level,
      },
    },
    nodesRequired: { consiousness: 1 },
    cost: createStoneCost(2, 1.5),
  },
  arcane_awareness: {
    id: "arcane_awareness",
    name: "Arcane Awareness",
    description:
      "Increase your spell power.",
    nodePosition: { x: 0, y: -2 },
    maxLevel: 5,
    icon: "spell_power_1.png",
    effects: {
      spell_power: {
        multiplier: (level) => 1 + 0.2 * level,
      },
    },
    nodesRequired: { glass_latticework: 1 },
    cost: createStoneCost(4, 1.35),
  },
  spell_power: {
    id: "spell_power",
    name: "Spell Power",
    description:
      "Increase your spell power.",
    nodePosition: { x: -1, y: -3 },
    maxLevel: 5,
    icon: "spell_power_1_5.png",
    effects: {
      spell_power: {
        multiplier: (level) => 1 + 0.2 * level,
      },
    },
    nodesRequired: { arcane_awareness: 1 },
    cost: createStoneCost(8, 1.35),
  },
  weaken_curse: {
    id: "weaken_curse",
    name: "Weaken Curse",
    description:
      "Unlock the Weaken Curse spell to sap bricks' strength and dampen their blows.",
    nodePosition: { x: 1, y: -3 },
    maxLevel: 1,
    icon: "weaken_curse.png",
    effects: {},
    nodesRequired: { arcane_awareness: 1 },
    cost: createStoneCost(45, 1.0),
  },
  arcane_amplifier: {
    id: "arcane_amplifier",
    name: "Arcane Amplifier",
    description:
      "Tune the lattice into a resonant chamber, amplifying the force carried by your spells.",
    nodePosition: { x: 0, y: -3 },
    maxLevel: 10,
    icon: "spell_power_2.png",
    effects: {
      spell_power: {
        multiplier: (level) => 1 + 0.15 * level,
      },
    },
    nodesRequired: { arcane_awareness: 2 },
    cost: createSandCost(18, 1.45),
  },
  sandstorm_ritual: {
    id: "sandstorm_ritual",
    name: "Sandstorm Ritual",
    description:
      "Bind the lattice to desert winds, unlocking the rite to conjure devastating sand storms.",
    nodePosition: { x: 0, y: -4 },
    maxLevel: 1,
    icon: "sandstorm.png",
    effects: {},
    nodesRequired: { arcane_amplifier: 3 },
    cost: createSandCost(100, 1.0),
  },
  black_darts: {
    id: "black_darts",
    name: "Darts of the Void",
    description:
      "Unleash darts of metal and void energy that damage targets.",
    nodePosition: { x: 1, y: -5 },
    maxLevel: 1,
    icon: "darts.png",
    effects: {},
    nodesRequired: { sandstorm_ritual: 1 },
    cost: createResourceCost('iron', 140, 1.65),
  },
  ring_of_fire: {
    id: "ring_of_fire",
    name: "Ring of Fire",
    description:
      "Weave a barrier of flame that erupts outward, searing everything it brushes.",
    nodePosition: { x: 1, y: -6 },
    maxLevel: 1,
    icon: "ring_of_fire.png",
    effects: {},
    nodesRequired: { black_darts: 1 },
    cost: createResourceCost('magma', 200, 1),
  },
  sharp_mind: {
    id: "sharp_mind",
    name: "Sharp Mind",
    description: "Increase spell power by 12% per level.",
    nodePosition: { x: -1, y: -5 },
    maxLevel: 15,
    icon: "spell_power_3.png",
    effects: {
      spell_power: {
        multiplier: (level) => 1 + 0.12 * level,
      },
    },
    nodesRequired: { sandstorm_ritual: 1 },
    cost: createResourceCost('organics', 30, 1.5),
  },
  sharp_mind2: {
    id: "sharp_mind2",
    name: "Sharp Mind II",
    description: "Increase spell power by 12% per level.",
    nodePosition: { x: -1, y: -6 },
    maxLevel: 20,
    icon: "spell_power_4.png",
    effects: {
      spell_power: {
        multiplier: (level) => 1 + 0.12 * level,
      },
    },
    nodesRequired: { sharp_mind: 5 },
    cost: createResourceCost('paper', 8, 1.5),
  },
  mana_reservior: {
    id: "mana_reservior",
    name: "Mana Reservoir",
    description:
      "Shape capacitors of fused glass to store greater tides of mana.",
    nodePosition: { x: -1, y: -2},
    maxLevel: 5,
    icon: "mana_cap_1.png",
    effects: {
      mana_cap: {
        income: (level) => 2 * level,
      },
      spell_power: {
        multiplier: (level) => 1 + 0.1 * level,
      },
    },
    nodesRequired: { glass_latticework: 1 },
    cost: createStoneCost(15, 1.5),
  },
  emberglass_reactors: {
    id: "emberglass_reactors",
    name: "Emberglass Reactors",
    description:
      "Channel heat through mirrored chambers; surging sand becomes lasting mana stores.",
    nodePosition: { x: -2, y: -3 },
    maxLevel: 5,
    icon: "mana_regen_2.png",
    effects: {
      mana_regen: {
        income: (level) => 0.1 * level,
      },
    },
    nodesRequired: { mana_reservior: 2 },
    cost: createStoneCost(100, 1.5),
  },
  spiritual_powers: {
    id: "spiritual_powers",
    name: "Spiritual Powers",
    description:
      "Increase your spiritual power.",
    nodePosition: { x: -3, y: -3 },
    maxLevel: 5,
    icon: "mana_regen_2_5.png",
    effects: {
      mana_regen: {
        income: (level) => 0.12 * level,
      },
    },
    nodesRequired: { emberglass_reactors: 2 },
    cost: createSandCost(20, 1.5),
  },
  sand_scribing: {
    id: "sand_scribing",
    name: "Sand Scribing",
    description:
      "Etch careful scribing to strain the stream of sand, expanding mana reserves.",
    nodePosition: { x: -3, y: -4 },
    maxLevel: 5,
    icon: "mana_cap_2.png",
    effects: {
      mana_cap: {
        income: (level) => 3 * level,
      },
      spell_power: {
        multiplier: (level) => 1 + 0.1 * level,
      },
    },
    nodesRequired: { emberglass_reactors: 2 },
    cost: createSandCost(22, 1.5),
  },
  mana_source: {
    id: "mana_source",
    name: "Mana Source",
    description:
      "Tap a steadier vein of power—both reserves and recovery improve.",
    nodePosition: { x: -3, y: -5 },
    maxLevel: 8,
    icon: "mana_regen_3.png",
    effects: {
      mana_cap: {
        income: (level) => 1 * level,
      },
      mana_regen: {
        income: (level) => 0.15*level
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
    icon: "mana_cap_3.png",
    effects: {
      mana_cap: {
        income: (level) => 3 * level,
      },
      spell_power: {
        multiplier: (level) => 1 + 0.1 * level,
      }
    },
    nodesRequired: { sand_scribing: 5 },
    cost: createResourceCost('wood', 60, 1.5),
  },
  bastion_foundations: {
    id: "bastion_foundations",
    name: "Bastion Foundations",
    description:
      "Build mental fortifications—deeper foundations of consciousness allow you to maintain presence on the map longer.",
    nodePosition: { x: 1, y: -2 },
    maxLevel: 3,
    icon: "consiousnes_2.png",
    effects: {
      sanity_cap: {
        income: (level) => 1 * level,
      },
    },
    nodesRequired: { glass_latticework: 1 },
    cost: createStoneCost(15, 1.5),
  },
  clarity: {
    id: "clarity",
    name: "Clarity",
    description:
      "Quiet the inner static. Clearer thought and mental clarity extend your ability to remain conscious on the map.",
    nodePosition: { x: 2, y: -3 },
    maxLevel: 4,
    icon: "consiousnes_3.png",
    effects: {
      sanity_cap: {
        income: (level) => 1 * level,
      },
    },
    nodesRequired: { bastion_foundations: 2 },
    cost: createStoneCost(100, 1.45),
  },
  clarity2: {
    id: "clarity2",
    name: "Clarity II",
    description:
      "Deeper stillness and mental discipline further expand your consciousness, allowing extended presence on the map.",
    nodePosition: { x: 3, y: -4 },
    maxLevel: 5,
    icon: "consiousnes_4.png",
    effects: {
      sanity_cap: {
        income: (level) => 1 * level,
      },
    },
    nodesRequired: { clarity: 3 },
    cost: createSandCost(50, 1.5),
  },
  clarity3: {
    id: "clarity3",
    name: "Clarity III",
    description:
      "Mastery of mental focus—your consciousness remains unshaken, enabling you to persist on the map even when the void whispers.",
    nodePosition: { x: 3, y: -5 },
    maxLevel: 8,
    icon: "consiousnes_5.png",
    effects: {
      sanity_cap: {
        income: (level) => 1 * level,
      },
    },
    nodesRequired: { clarity2: 3 },
    cost: createResourceCost('wood', 50, 1.5),
  },
  // left
  hunger: {
    id: "hunger",
    name: "Hunger",
    description:
      "A gnawing void urges you on. Feed it with matter so your summons strike harder.",
    nodePosition: { x: -1, y: 0 },
    maxLevel: 5,
    icon: "attack1.png",
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.2 * level,
      }
    },
    nodesRequired: { consiousness: 1 },
    cost: createStoneCost(2, 1.5),
  },
  granite_bonding: {
    id: "granite_bonding",
    name: "Granite Bonding",
    description:
      "Fuse matter into denser cores your summons can wield—every strike lands heavier.",
    nodePosition: { x: -2, y: 0 },
    maxLevel: 5,
    icon: "attack2.png",
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.15 * level,
      },
    },
    nodesRequired: { hunger: 2 },
    cost: createStoneCost(16, 1.5),
  },
  stone_drill: {
    id: "stone_drill",
    name: "Stone Teeth",
    description:
      "Affix crude teeth to the forming shells of your entities, boosting their assault.",
    nodePosition: { x: -3, y: 0 },
    maxLevel: 5,
    icon: "attack3.png",
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
    icon: "attack4.png",
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.15 * level,
      },
    },
    nodesRequired: { stone_drill: 2 },
    cost: createSandCost(20, 1.5),
  },
  inspiration: {
    id: "inspiration",
    name: "Inspiration",
    description:
      "Increase the damage of your units by 1% per map levels cleared per level.",
    nodePosition: { x: -5, y: -2 },
    maxLevel: 5,
    icon: "inspiration.png",
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level, context) => 1 + 0.01 * level * getClearedLevelsTotal(context, level),
      },
    },
    nodesRequired: { damage_lore: 2 },
    cost: createSandCost(200, 2),
  },
  heavy_drill: {
    id: "heavy_drill",
    name: "Heavy Drill",
    description:
      "Replace crude bits with heavy augers. Mass and torque translate into damage.",
    nodePosition: { x: -6, y: -1 },
    maxLevel: 15,
    icon: "iron_drill.png",
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
    icon: "tools.png",
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
    icon: "iron_tools.png",
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.08 * level,
      },
    },
    nodesRequired: { tool_fabrication: 1 },
    cost: createResourceCost('tools', 8, 1.5),
  },
  silver_drill: {
    id: "silver_drill",
    name: "Silver Drill",
    description:
      "Silvered bits bite deeper into stubborn matter, further amplifying attacks.",
    nodePosition: { x: -8, y: -1 },
    maxLevel: 15,
    icon: "silver_drill.png",
    effects: {
      all_units_attack_multiplier: {
        multiplier: (level) => 1 + 0.1 * level,
      },
    },
    nodesRequired: { heavy_drill: 5 },
    cost: createResourceCost('silver', 90, 1.5),
  },
  critical_chance: {
    id: "critical_chance",
    name: "Critical Chance",
    description:
      "Sharpen instincts and edges alike—your units find weak points more often.",
    nodePosition: { x: -4, y: 1 },
    maxLevel: 10,
    icon: "crit_chance_1.png",
    effects: {
      all_units_crit_chance: {
        income: (level) => 0.02 * level,
      },
    },
    nodesRequired: { stone_drill: 2 },
    cost: createMixedCost(200, 1.5, 20, 1.5),
  },
  critical_chance2: {
    id: "critical_chance2",
    name: "Critical Chance II",
    description:
      "Deeper instincts and edges—your units find weak points more often.",
    nodePosition: { x: -5, y: 2 },
    maxLevel: 10,
    icon: "crit_chance_2.png",
    effects: {
      all_units_crit_chance: {
        income: (level) => 0.03 * level,
      },
    },
    nodesRequired: { critical_chance: 5 },
    cost: createResourceCost('coal', 200, 2.0),
  },
  penetration: {
    id: "penetration",
    name: "Penetration",
    description:
      "Hardened tips and angled force let your strikes pierce tougher shells.",
    nodePosition: { x: -6, y: 1 },
    maxLevel: 15,
    icon: "penetration_1.png",
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
    icon: "penetration_2.png",
    effects: {
      all_units_armor_penetration: {
        income: (level) => 2 * level,
      },
    },
    nodesRequired: { penetration: 5 },
    cost: createResourceCost('copper', 60, 1.5),
  },
  penetration3: {
    id: "penetration3",
    name: "Penetration III",
    description:
      "Use hot magma to melt through armor.",
    nodePosition: { x: -8, y: 3 },
    maxLevel: 15,
    icon: "penetration_3.png",
    effects: {
      all_units_armor_penetration: {
        income: (level) => 6 * level,
      },
    },
    nodesRequired: { penetration2: 5 },
    cost: createResourceCost('magma', 250, 1.5),
  },
  // right
  improved_membranes: {
    id: "improved_membranes",
    name: "Improved Membranes",
    description:
      "Stiffen ephemeral skins into resilient membranes—your entities endure more.",
    nodePosition: { x: 1, y: 0 },
    maxLevel: 5,
    icon: "health_1.png",
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level) => 1 + 0.2 * level,
      },
    },
    nodesRequired: { consiousness: 1 },
    cost: createStoneCost(2, 1.5),
  },
  vitality: {
    id: "vitality",
    name: "Vitality",
    description:
      "Grow thicker layers of living matter around your cores, raising total vitality.",
    nodePosition: { x: 2, y: 0 },
    maxLevel: 5,
    icon: "health_2.png",
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
    icon: "armor1.png",
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
    icon: "armor2.png",
    effects: {
      all_units_armor: {
        income: (level) => 0 + level,
      },
    },
    nodesRequired: { stone_armor: 3 },
    cost: createMixedCost(200, 1.5, 20, 1.5),
  },
  impact_dampening: {
    id: "impact_dampening",
    name: "Impact Dampening",
    description:
      "Elastic tissues absorb impacts, reducing knockback.",
    nodePosition: { x: 5, y: 2 },
    maxLevel: 5,
    icon: "knockback_reduction.png",
    effects: {
      all_units_knockback_reduction: {
        multiplier: (level) => 1 + 0.02 * level,
      },
    },
    nodesRequired: { armor_lore: 5 },
    cost: createResourceCost('organics', 45, 1.5),
  },
  armor_lore2: {
    id: "armor_lore2",
    name: "Armor Lore II",
    icon: "armor3.png",
    description:
      "Advanced schemata: ribbing, overlaps, anchor points—denser protection.",
    nodePosition: { x: 6, y: 1 },
    maxLevel: 15,
    effects: {
      all_units_armor: {
        income: (level) => 0 + 2.0 * level,
      },
    },
    nodesRequired: { armor_lore: 5 },
    cost: createResourceCost('iron', 30, 1.5),
  },
  armor_lore3: {
    id: "armor_lore3",
    name: "Armor Lore III",
    icon: "armor4.png",
    description:
      "Master forging of living plate—your hosts shrug off punishing blows.",
    nodePosition: { x: 7, y: 2 },
    maxLevel: 15,
    effects: {
      all_units_armor: {
        income: (level) => 5*level,
      },
    },
    nodesRequired: { armor_lore2: 5 },
    cost: createResourceCost('silver', 60, 1.5),
  },
  armor_lore4: {
    id: "armor_lore4",
    name: "Armor Lore IV",
    description:
      "Master forging of living plate—your hosts shrug off punishing blows.",
    nodePosition: { x: 8, y: 3 },
    maxLevel: 15,
    icon: "armor5.png",
    effects: {
      all_units_armor: {
        income: (level) => 15*level,
      },
    },
    nodesRequired: { armor_lore3: 5 },
    cost: createResourceCost('ice', 200, 1.5),
  },
  vitality2: {
    id: "vitality2",
    name: "Vitality II",
    description:
      "Cultivate richer biomass; the flesh‑cores swell with fresh reserves.",
    nodePosition: { x: 4, y: -1 },
    maxLevel: 15,
    icon: "health_2_5.png",
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level) => 1 + 0.16 * level,
      },
    },
    nodesRequired: { stone_armor: 3 },
    cost: createSandCost(20, 1.5),
  },
  perseverance: {
    id: "perseverance",
    name: "Perseverance",
    description:
      "Increase the health of your units by 1% per maximum map level cleared per level.",
    nodePosition: { x: 5, y: -2 },
    maxLevel: 5,
    icon: "perseverance.png",
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level, context) => 1 + 0.01 * level * getClearedLevelsTotal(context),
      },
    },
    nodesRequired: { vitality2: 5 },
    cost: createResourceCost('sand', 200, 2),
  },
  vitality3: {
    id: "vitality3",
    name: "Vitality III",
    description:
      "Engineered organs and redundant latticework markedly raise hit capacity.",
    nodePosition: { x: 6, y: -1 },
    maxLevel: 15,
    icon: "health_3.png",
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level) => 1 + 0.12 * level,
      },
    },
    nodesRequired: { vitality2: 5 },
    cost: createResourceCost('organics', 30, 1.5),
  },
  vitality4: {
    id: "vitality4",
    name: "Vitality IV",
    icon: "health_4.png",
    description:
      "Use coal to boost creatures body temperature, increase metabolism and increase vitality.",
    nodePosition: { x: 8, y: -1 },
    maxLevel: 25,
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level) => 1 + 0.1 * level,
      },
    },
    nodesRequired: { vitality3: 5 },
    cost: createResourceCost('coal', 90, 1.5),
  },
  paper_milling: {
    id: "paper_milling",
    name: "Paper Milling",
    description: "Pulp organics into disciplined sheets fit for resilient schematics.",
    nodePosition: { x: 7, y: 0 },
    maxLevel: 1,
    icon: "paper_craft.png",
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
    icon: "mana_regen_4.png",
    effects: {
      mana_regen: {
        multiplier: (level) => 1 + 0.08*level,
      },
    },
    nodesRequired: { mana_source: 5 },
    cost: createResourceCost('paper', 8, 1.5),
  },
  restoration: {
    id: "restoration",
    name: "Restoration",
    description:
      "Teach your creations to knit themselves mid‑battle—steady percentage regen.",
    nodePosition: { x: 7, y: -2 },
    maxLevel: 10,
    icon: "health_regen_1.png",
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
    icon: "health_tools.png",
    effects: {
      all_units_hp_multiplier: {
        multiplier: (level) => 1 + 0.08 * level,
      },
    },
    nodesRequired: { restoration: 3 },
    cost: createResourceCost('tools', 8, 1.5),
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
