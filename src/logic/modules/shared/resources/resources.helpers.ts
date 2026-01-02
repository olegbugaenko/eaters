import type { ResourceId } from "../../../../db/resources-db";

/**
 * Sanitizes a brick count value from unknown source.
 * Returns 0 if value is not a finite non-negative number.
 */
export const sanitizeBrickCount = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
};

/**
 * Checks if two resource ID lists are equal.
 * @param a - First list
 * @param b - Second list
 * @returns True if lists have the same length and elements in the same order
 */
export const areResourceListsEqual = (
  a: readonly ResourceId[],
  b: readonly ResourceId[]
): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
};
