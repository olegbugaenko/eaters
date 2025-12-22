export const clampNumber = (value: number | undefined, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (min > max) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

export const clampProbability = (value: number | undefined): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return clampNumber(value, 0, 1);
};
