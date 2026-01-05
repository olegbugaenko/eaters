export type ResourceType = "mana" | "sanity";

export interface ResourceAmountMap {
  mana: number;
  sanity: number;
  [key: string]: number;
}

export type ResourceCost = Partial<ResourceAmountMap>;
