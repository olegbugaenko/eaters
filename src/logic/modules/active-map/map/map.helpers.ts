import { clampNumber } from "@shared/helpers/numbers.helper";

/**
 * Sanitizes a level value, ensuring it's a valid positive integer >= 1.
 */
export const sanitizeLevel = (value: unknown): number => {
  if (!Number.isFinite(value as number)) {
    return 1;
  }
  const level = Math.floor(Number(value));
  return Math.max(level, 1);
};

/**
 * Deserializes a level from stored format (0-based) to display format (1-based).
 */
export const deserializeLevel = (value: unknown): number => {
  if (!Number.isFinite(value as number)) {
    return 1;
  }
  const parsed = Math.floor(Number(value));
  return sanitizeLevel(parsed + 1);
};

/**
 * Serializes a level from display format (1-based) to stored format (0-based).
 */
export const serializeLevel = (level: number): number => {
  if (!Number.isFinite(level as number)) {
    return 0;
  }
  return Math.max(Math.floor(Number(level)) - 1, 0);
};

/**
 * Sanitizes a count value, ensuring it's a valid non-negative integer.
 */
export const sanitizeCount = (value: unknown): number => {
  if (!Number.isFinite(value as number)) {
    return 0;
  }
  return Math.max(0, Math.floor(Number(value)));
};

/**
 * Sanitizes a duration value, ensuring it's a valid non-negative integer or null.
 */
export const sanitizeDuration = (value: unknown): number | null => {
  if (!Number.isFinite(value as number)) {
    return null;
  }
  const duration = Math.floor(Number(value));
  if (duration < 0) {
    return null;
  }
  return duration;
};
