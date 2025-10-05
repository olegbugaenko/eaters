export type ResourceType = "mana" | "sanity";

export interface ResourceAmountMap {
  mana: number;
  sanity: number;
}

export type ResourceCost = Partial<ResourceAmountMap>;

export const RESOURCE_TYPES: readonly ResourceType[] = ["mana", "sanity"] as const;

export const createEmptyResourceAmount = (): ResourceAmountMap => ({
  mana: 0,
  sanity: 0,
});

export const normalizeResourceCost = (cost: ResourceCost | undefined): ResourceAmountMap => ({
  mana: sanitizeResourceValue(cost?.mana),
  sanity: sanitizeResourceValue(cost?.sanity),
});

const sanitizeResourceValue = (value: number | undefined): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(value, 0);
  }
  return 0;
};
