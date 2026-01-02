export const clampNumber = (value: number | undefined, min: number, max: number): number => {
  if (min > max) {
    return min;
  }

  const numericValue = Number.isFinite(value) ? (value as number) : min;
  return Math.min(Math.max(numericValue, min), max);
};

export const clampProbability = (value: number | undefined): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return clampNumber(value, 0, 1);
};

export const clamp01 = (value: number): number => clampNumber(value, 0, 1);

/**
 * Returns a random integer between min and max (inclusive).
 * Ensures min <= max and returns a valid integer.
 */
export const randomIntInclusive = (config: { min: number; max: number }): number => {
  const min = Math.max(0, Math.floor(config.min));
  const max = Math.max(min, Math.floor(config.max));
  if (max <= min) {
    return min;
  }
  const range = max - min + 1;
  return min + Math.floor(Math.random() * range);
};

/**
 * Linear interpolation between two values.
 * @param start - Start value
 * @param end - End value
 * @param t - Interpolation factor (typically between 0 and 1, but not clamped)
 * @returns Interpolated value
 */
export const lerp = (start: number, end: number, t: number): number =>
  start + (end - start) * t;