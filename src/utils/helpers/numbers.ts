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
