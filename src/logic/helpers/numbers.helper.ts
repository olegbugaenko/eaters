/**
 * Sanitizes a multiplier value (must be non-negative).
 * Returns fallback if value is not a finite number.
 */
export const sanitizeMultiplier = (value: number | undefined, fallback = 1): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  if (value < 0) {
    return 0;
  }
  return value;
};

/**
 * Sanitizes an additive value (can be negative).
 * Returns fallback if value is not a finite number.
 */
export const sanitizeAdditive = (value: number | undefined, fallback = 0): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
};

/**
 * Normalizes a multiplier value relative to a baseline.
 * Useful for converting absolute values to relative multipliers.
 */
export const normalizeMultiplier = (value: number, baseline: number): number => {
  if (!Number.isFinite(value)) {
    return 1;
  }
  if (!Number.isFinite(baseline) || Math.abs(baseline) < 1e-9) {
    return Math.max(value, 0);
  }
  return Math.max(value, 0) / Math.max(baseline, 1e-9);
};

/**
 * Rounds a stat value to 2 decimal places.
 */
export const roundStat = (value: number): number => Math.round(value * 100) / 100;

/**
 * Sanitizes a number value, returning undefined if invalid.
 * Use this when you need to preserve undefined for optional values.
 */
export const sanitizeNumber = (value: number | undefined): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
};

/**
 * Sanitizes a number value from unknown source, ensuring it's non-negative.
 * Returns fallback if value is not a finite number.
 * Use this for statistics, save data, or when you need a guaranteed non-negative number.
 */
export const sanitizeNonNegativeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, value);
};

/**
 * Sanitizes a number value from unknown source with a fallback.
 * Returns fallback if value is not a finite number.
 * Use this for save data or when you need to handle unknown values that can be negative.
 */
export const sanitizeNumberWithFallback = (value: unknown, fallback = 0): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
};
