import type { PersistentAoeObjectCustomData } from "@logic/modules/active-map/spellcasting/implementations/PersistentAoeSpellBehavior.types";

export const DEFAULT_CUSTOM_DATA: PersistentAoeObjectCustomData = {
  shape: "ring",
  explosion: null,
  innerRadius: 0,
  outerRadius: 0,
  thickness: 1,
  intensity: 0,
  glowColor: { r: 1, g: 0.45, b: 0.1, a: 0.8 },
  glowAlpha: 0.8,
  particle: null,
  fireColor: { r: 1, g: 0.58, b: 0.24, a: 1 },
  durationMs: 0,
};

export const MIN_RADIUS = 1;
