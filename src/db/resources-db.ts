import type { MapId } from "./maps-db";
import type { SkillId } from "./skills-db";
import type { UnlockCondition } from "@shared/types/unlocks";

export type ResourceId =
  | "stone"
  | "sand"
  | "iron"
  | "organics"
  | "wood"
  | "copper"
  | "silver"
  | "coal"
  | "tools"
  | "paper"
  | "wire"
  | "ice"
  | "magma"
  | "uranium";

export interface ResourceConfig {
  readonly id: ResourceId;
  readonly name: string;
  readonly description?: string;
  readonly unlockedBy?: readonly UnlockCondition<MapId, SkillId>[];
}

export type ResourceAmount = Partial<Record<ResourceId, number>>;
export type ResourceStockpile = Record<ResourceId, number>;

const RESOURCE_DB: Record<ResourceId, ResourceConfig> = {
  stone: {
    id: "stone",
    name: "Stone",
    description: "Solid fragments gathered from shattered bricks.",
  },
  sand: {
    id: "sand",
    name: "Sand",
    description: "Fine grains useful for future construction.",
  },
  iron: {
    id: "iron",
    name: "Iron",
    description: "",
    unlockedBy: [
      {
        type: "map",
        id: "initial",
        level: 1,
      },
    ],
  },
  organics: {
    id: "organics",
    name: "Organics",
    description: "",
    unlockedBy: [
      {
        type: "map",
        id: "initial",
        level: 1,
      },
    ],
  },
  wood: {
    id: "wood",
    name: "Wood",
    description: "Sturdy timber gathered from fallen trunks.",
    unlockedBy: [
      {
        type: "map",
        id: "thicket",
        level: 1,
      },
    ],
  },
  copper: {
    id: "copper",
    name: "Copper",
    description: "Conductive metal reclaimed from twisted wiring.",
    unlockedBy: [
      {
        type: "map",
        id: "oldForge",
        level: 1,
      },
    ],
  },
  silver: {
    id: "silver",
    name: "Silver",
    description: "Lustrous metal perfect for precise conduits.",
    unlockedBy: [
      {
        type: "map",
        id: "wire",
        level: 1,
      },
    ],
  },
  coal: {
    id: "coal",
    name: "Coal",
    description: "Dense fuel pried from the deepest seams of the mine.",
    unlockedBy: [
      {
        type: "map",
        id: "spruce",
        level: 1,
      },
    ],
  },
  tools: {
    id: "tools",
    name: "Tools",
    description: "Precision implements forged for advanced fabrication.",
    unlockedBy: [
      {
        type: "skill",
        id: "tool_fabrication",
        level: 1,
      },
    ],
  },
  paper: {
    id: "paper",
    name: "Paper",
    description: "Refined sheets ready for schematics and rituals alike.",
    unlockedBy: [
      {
        type: "skill",
        id: "paper_milling",
        level: 1,
      },
    ],
  },
  wire: {
    id: "wire",
    name: "Wire",
    description: "Conductive metal strands for advanced circuitry.",
    unlockedBy: [
      {
        type: "skill",
        id: "wire_crafting",
        level: 1,
      },
    ],
  },
  ice: {
    id: "ice",
    name: "Ice",
    description: "Frozen crystalline fragments from the eternal winter.",
    unlockedBy: [
      {
        type: "map",
        id: "silverRing",
        level: 1,
      },
    ],
  },
  magma: {
    id: "magma",
    name: "Magma",
    description: "Molten stone and fire coalesced into a searing substance.",
    unlockedBy: [
      {
        type: "map",
        id: "mine",
        level: 1,
      },
    ],
  },
  uranium: {
    id: "uranium",
    name: "Uranium Fields",
    description: "",
    unlockedBy: [
      {
        type: "map",
        id: "mine",
        level: 1,
      },
    ],
  },
};

export const RESOURCE_IDS = Object.keys(RESOURCE_DB) as ResourceId[];

export const getResourceConfig = (id: ResourceId): ResourceConfig => {
  const config = RESOURCE_DB[id];
  if (!config) {
    throw new Error(`Unknown resource id: ${id}`);
  }
  return config;
};

const sanitizeResourceValue = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  const clamped = Math.max(value, 0);
  return Math.round(clamped * 100) / 100;
};

export const createEmptyResourceStockpile = (): ResourceStockpile => {
  const stockpile = {} as ResourceStockpile;
  RESOURCE_IDS.forEach((id) => {
    stockpile[id] = 0;
  });
  return stockpile;
};

export const normalizeResourceAmount = (
  amount: ResourceAmount | ResourceStockpile | null | undefined
): ResourceStockpile => {
  const normalized = createEmptyResourceStockpile();
  if (!amount) {
    return normalized;
  }
  RESOURCE_IDS.forEach((id) => {
    normalized[id] = sanitizeResourceValue((amount as Record<ResourceId, number | undefined>)[id]);
  });
  return normalized;
};

export const cloneResourceStockpile = (source: ResourceStockpile): ResourceStockpile => {
  const clone = createEmptyResourceStockpile();
  RESOURCE_IDS.forEach((id) => {
    clone[id] = sanitizeResourceValue(source[id]);
  });
  return clone;
};

export const hasAnyResources = (
  amount: ResourceAmount | ResourceStockpile | null | undefined
): boolean => {
  if (!amount) {
    return false;
  }
  return RESOURCE_IDS.some((id) => sanitizeResourceValue((amount as Record<ResourceId, number | undefined>)[id]) > 0);
};
