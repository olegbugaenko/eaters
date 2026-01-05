import type { BrickEffectTint } from "./bricks.types";

export interface BrickEffectsDependencies {
  readonly hasBrick: (brickId: string) => boolean;
  readonly dealDamage: (
    brickId: string,
    amount: number,
    options: { rewardMultiplier: number; armorPenetration: number; overTime: number },
  ) => void;
  readonly setTint: (brickId: string, tint: BrickEffectTint | null) => void;
}

export type BrickEffectType = "meltingTail" | "freezingTail" | "weakeningCurse" | "weakeningCurseFlat";

export type BrickEffectApplication =
  | {
      readonly type: "meltingTail";
      readonly brickId: string;
      readonly durationMs: number;
      readonly multiplier: number; // incoming damage multiplier (> 1)
      readonly tint?: BrickEffectTint | null;
    }
  | {
      readonly type: "freezingTail";
      readonly brickId: string;
      readonly durationMs: number;
      readonly divisor: number;
      readonly tint?: BrickEffectTint | null;
    }
  | {
      readonly type: "weakeningCurse";
      readonly brickId: string;
      readonly durationMs: number;
      readonly multiplier: number; // outgoing damage multiplier (< 1)
      readonly tint?: BrickEffectTint | null;
    }
  | {
      readonly type: "weakeningCurseFlat";
      readonly brickId: string;
      readonly durationMs: number;
      readonly flatReduction: number; // flat damage reduction value
      readonly tint?: BrickEffectTint | null;
    };

interface BaseEffectState {
  readonly type: BrickEffectType;
  remainingMs: number;
  tint?: BrickEffectTint | null;
}

export interface MeltingEffectState extends BaseEffectState {
  readonly type: "meltingTail";
  multiplier: number;
}

export interface FreezingEffectState extends BaseEffectState {
  readonly type: "freezingTail";
  divisor: number;
}

export interface WeakeningCurseEffectState extends BaseEffectState {
  readonly type: "weakeningCurse";
  multiplier: number;
}

export interface WeakeningCurseFlatEffectState extends BaseEffectState {
  readonly type: "weakeningCurseFlat";
  flatReduction: number;
}

export type BrickEffectState =
  | MeltingEffectState
  | FreezingEffectState
  | WeakeningCurseEffectState
  | WeakeningCurseFlatEffectState;
