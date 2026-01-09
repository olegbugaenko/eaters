/**
 * Clamps a positive value, returning fallback if value is not finite or <= 0.
 */
export const clampPositive = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
};
