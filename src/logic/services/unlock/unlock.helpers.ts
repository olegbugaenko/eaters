/**
 * Sanitizes a level value.
 * Returns 0 if value is not finite, otherwise returns max(0, floor(value)).
 */
export const sanitizeLevel = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
};
