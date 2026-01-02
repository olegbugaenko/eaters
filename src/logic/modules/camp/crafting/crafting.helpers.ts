import type { CraftingRecipeId } from "../../../../db/crafting-recipes-db";
import type { ResourceAmount, ResourceId } from "../../../../db/resources-db";
import { normalizeResourceAmount } from "../../../../db/resources-db";
import type { CraftingRecipeRuntimeState } from "./crafting.types";
import { clampNumber } from "@/utils/helpers/numbers";

export const createEmptyRuntimeState = (): CraftingRecipeRuntimeState => ({
  queue: 0,
  progressMs: 0,
  inProgress: false,
});

export const sanitizeQueueValue = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
};

export const sanitizeProgressValue = (value: unknown, durationMs: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  return clampNumber(value, 0, durationMs);
};

export const toCostRecord = (amount: ResourceAmount): Record<string, number> => {
  const normalized = normalizeResourceAmount(amount);
  const record: Record<string, number> = {};
  (Object.keys(normalized) as ResourceId[]).forEach((id) => {
    const value = normalized[id];
    if (value > 0) {
      record[id] = value;
    }
  });
  return record;
};

export const createProductAmount = (
  productId: ResourceId,
  amount: number
): ResourceAmount => ({
  [productId]: amount,
});
