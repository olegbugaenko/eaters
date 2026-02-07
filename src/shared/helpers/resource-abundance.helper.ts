export type ResourceAbundanceLevel = 1 | 2 | 3 | 4 | 5;

const RESOURCE_ABUNDANCE_LABELS: Record<ResourceAbundanceLevel, string> = {
  1: "Sparse",
  2: "Limited",
  3: "Moderate",
  4: "Rich",
  5: "Abundant",
};

export const getResourceAbundanceLevel = (
  amount: number,
  total: number,
  n: number
): ResourceAbundanceLevel => {
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const safeCount = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  if (safeTotal <= 0 || safeCount <= 0) {
    return 1;
  }

  const k = 3;
  const p = 1.8;
  const denominator = Math.log(safeTotal + k);
  if (denominator <= 0) {
    return 1;
  }
  const s = Math.log(safeAmount + k) / denominator;
  const seq = Math.log(safeTotal / safeCount + k) / denominator;
  if (seq <= 0) {
    return 1;
  }
  const x = s / seq;
  const raw = Math.round(4 * Math.pow(x, p));
  const level = Math.max(1, Math.min(5, raw));
  return level as ResourceAbundanceLevel;
};

export const getResourceAbundanceLabel = (level: ResourceAbundanceLevel): string =>
  RESOURCE_ABUNDANCE_LABELS[level];
