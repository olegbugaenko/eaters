import type { ResourceId } from "../../../../db/resources-db";
import { sanitizeCount } from "@shared/helpers/validation.helper";

/**
 * Sanitizes a brick count value from unknown source.
 * Returns 0 if value is not a finite non-negative number.
 * @param value - Value to sanitize
 * @returns Sanitized brick count (non-negative integer)
 */
export const sanitizeBrickCount = (value: unknown): number => {
  return sanitizeCount(value, 0);
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
