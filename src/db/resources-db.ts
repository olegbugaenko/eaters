export type ResourceId = "stone" | "sand";

export interface ResourceConfig {
  readonly id: ResourceId;
  readonly name: string;
  readonly description?: string;
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
  return Math.max(Math.floor(value), 0);
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
