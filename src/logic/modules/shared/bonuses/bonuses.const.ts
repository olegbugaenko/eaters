/**
 * Epsilon value for comparing bonus values.
 * Used to determine if two bonus maps are equal.
 */
export const BONUS_COMPARISON_EPSILON = 1e-9;

/** Display order for bonus source categories in breakdown UI */
export const BONUS_SOURCE_CATEGORIES = [
  "skill",
  "building",
  "dark_research",
  "achievement",
  "map",
  "unit_module",
  "misc",
] as const;

export type BonusSourceCategory = (typeof BONUS_SOURCE_CATEGORIES)[number];
