import { ResourceAmount, ResourceId } from "./resources-db";
import { SkillId } from "./skills-db";
import { UnlockConditionList } from "@shared/types/unlocks";
import { MapId } from "./maps-db";

export type CraftingRecipeId = "tools" | "paper" | "wire";

export interface CraftingRecipeConfig {
  readonly id: CraftingRecipeId;
  readonly name: string;
  readonly productId: ResourceId;
  readonly productAmount: number;
  readonly ingredients: ResourceAmount;
  readonly baseDurationMs: number;
  readonly unlockedBy?: UnlockConditionList<MapId, SkillId>;
}

const TOOL_INGREDIENTS: ResourceAmount = Object.freeze({
  iron: 50,
  wood: 10,
});

const PAPER_INGREDIENTS: ResourceAmount = Object.freeze({
  organics: 50,
  wood: 10,
});

const WIRE_INGREDIENTS: ResourceAmount = Object.freeze({
  coal: 100,
  copper: 500,
});

const CRAFTING_RECIPE_DB: Record<CraftingRecipeId, CraftingRecipeConfig> = {
  tools: {
    id: "tools",
    name: "Tool Fabrication",
    productId: "tools",
    productAmount: 1,
    ingredients: TOOL_INGREDIENTS,
    baseDurationMs: 2500,
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
    name: "Paper Press",
    productId: "paper",
    productAmount: 1,
    ingredients: PAPER_INGREDIENTS,
    baseDurationMs: 3000,
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
    name: "Wire Fabrication",
    productId: "wire",
    productAmount: 1,
    ingredients: WIRE_INGREDIENTS,
    baseDurationMs: 3000,
  },
};

export const CRAFTING_RECIPE_IDS = Object.keys(
  CRAFTING_RECIPE_DB
) as CraftingRecipeId[];

export const getCraftingRecipeConfig = (id: CraftingRecipeId): CraftingRecipeConfig => {
  const config = CRAFTING_RECIPE_DB[id];
  if (!config) {
    throw new Error(`Unknown crafting recipe id: ${id}`);
  }
  return config;
};
