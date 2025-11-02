export const clampNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return value;
  }
  if (min > max) {
    return value;
  }
  return Math.max(min, Math.min(max, value));
};
