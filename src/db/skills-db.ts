import { ResourceAmount } from "./resources-db";

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
  readonly effects: Record<string, unknown>;
  readonly nodesRequired: Partial<Record<SkillId, number>>;
  readonly cost: SkillCostFunction;
}

export const SKILL_IDS = [
  "stone_lore",
  "quarry_overseers",
  "granite_bonding",
  "bastion_foundations",
  "sand_scribing",
  "glass_latticework",
  "emberglass_reactors",
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
  stone_lore: {
    id: "stone_lore",
    name: "Stone Lore",
    description:
      "Foundational studies in sorting shattered bricks, enabling steadier stone yields.",
    nodePosition: { x: 0, y: 0 },
    maxLevel: 3,
    effects: {},
    nodesRequired: {},
    cost: createStoneCost(6, 1.35),
  },
  quarry_overseers: {
    id: "quarry_overseers",
    name: "Quarry Overseers",
    description:
      "Assign dedicated haulers who keep rubble moving and expose richer stone veins.",
    nodePosition: { x: -1, y: 1 },
    maxLevel: 4,
    effects: {},
    nodesRequired: { stone_lore: 1 },
    cost: createStoneCost(10, 1.4),
  },
  granite_bonding: {
    id: "granite_bonding",
    name: "Granite Bonding",
    description:
      "Fuse heavy chunks together, forming denser stockpiles that resist crumble losses.",
    nodePosition: { x: -2, y: 2 },
    maxLevel: 3,
    effects: {},
    nodesRequired: { quarry_overseers: 2 },
    cost: createStoneCost(16, 1.5),
  },
  bastion_foundations: {
    id: "bastion_foundations",
    name: "Bastion Foundations",
    description:
      "Lay channelled footings so every slab stacks true, preparing for future defenses.",
    nodePosition: { x: -1, y: 3 },
    maxLevel: 2,
    effects: {},
    nodesRequired: { granite_bonding: 1 },
    cost: createMixedCost(18, 1.5, 6, 1.25),
  },
  sand_scribing: {
    id: "sand_scribing",
    name: "Sand Scribing",
    description:
      "Refine sieving rituals that separate glimmering sand from dull dust motes.",
    nodePosition: { x: 1, y: 1 },
    maxLevel: 4,
    effects: {},
    nodesRequired: { stone_lore: 1 },
    cost: createSandCost(8, 1.35),
  },
  glass_latticework: {
    id: "glass_latticework",
    name: "Glass Latticework",
    description:
      "Weave molten filaments into frameworks that stabilize fragile sand constructs.",
    nodePosition: { x: 2, y: 2 },
    maxLevel: 3,
    effects: {},
    nodesRequired: { sand_scribing: 2 },
    cost: createSandCost(14, 1.45),
  },
  emberglass_reactors: {
    id: "emberglass_reactors",
    name: "Emberglass Reactors",
    description:
      "Channel heat through mirrored chambers, transmuting sand surges into lasting stores.",
    nodePosition: { x: 1, y: 3 },
    maxLevel: 2,
    effects: {},
    nodesRequired: { glass_latticework: 1 },
    cost: createMixedCost(20, 1.55, 12, 1.4),
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
