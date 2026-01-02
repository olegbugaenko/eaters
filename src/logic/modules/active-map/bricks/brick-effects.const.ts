import type { BrickEffectTint } from "./bricks.types";
import type { BrickEffectType } from "./brick-effects.types";

export const BURNING_TAIL_DURATION_MS = 4000;
export const FREEZING_TAIL_DURATION_MS = 4000;
export const BURNING_TAIL_DAMAGE_RATIO_PER_SECOND = 0.2;

export const EFFECT_TINTS: Partial<Record<BrickEffectType, BrickEffectTint & { priority: number }>> = {
  meltingTail: {
    color: { r: 1, g: 0.2, b: 0.1, a: 1 },
    intensity: 0.65,
    priority: 20,
  },
  freezingTail: {
    color: { r: 0.35, g: 0.55, b: 1, a: 1 },
    intensity: 0.55,
    priority: 10,
  },
  weakeningCurse: {
    color: { r: 0.55, g: 0.25, b: 0.55, a: 1 },
    intensity: 0.65,
    priority: 15,
  },
  weakeningCurseFlat: {
    color: { r: 0.55, g: 0.15, b: 0.45, a: 1 },
    intensity: 0.5,
    priority: 15,
  },
};
