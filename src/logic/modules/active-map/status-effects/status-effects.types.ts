import type { BrickEffectTint } from "../bricks/bricks.types";

export type StatusEffectTargetType = "unit" | "enemy" | "brick";

export interface StatusEffectTarget {
  readonly type: StatusEffectTargetType;
  readonly id: string;
}

export interface StatusEffectApplicationOptions {
  readonly durationMs?: number;
  readonly stacks?: number;
  readonly charges?: number;
  readonly bonusDamage?: number;
  readonly multiplier?: number;
  readonly divisor?: number;
  readonly flatReduction?: number;
  readonly perHitBonus?: number;
  readonly cap?: number;
  readonly armorReductionPerStack?: number;
  readonly speedMultiplier?: number;
  readonly damagePerSecond?: number;
  readonly damagePerTick?: number;
  readonly tint?: BrickEffectTint | null;
  readonly tintPriority?: number;
  readonly sourceId?: string;
}

export interface StatusEffectUnitAdapter {
  readonly hasUnit: (unitId: string) => boolean;
  readonly applyOverlay: (
    unitId: string,
    effectId: string,
    target: "fill" | "stroke",
    overlay: {
      color: { r: number; g: number; b: number; a?: number };
      intensity: number;
      blendMode?: "tint" | "add";
      priority?: number;
    } | null,
  ) => void;
  readonly applyAura: (unitId: string, effectId: string) => void;
  readonly removeAura: (unitId: string, effectId: string) => void;
  readonly damageUnit: (unitId: string, amount: number) => void;
}

export interface StatusEffectBrickAdapter {
  readonly hasBrick: (brickId: string) => boolean;
  readonly setTint: (brickId: string, tint: BrickEffectTint | null) => void;
  readonly damageBrick: (
    brickId: string,
    amount: number,
    options: { rewardMultiplier: number; armorPenetration: number; overTime: number },
  ) => void;
}

export interface StatusEffectEnemyAdapter {
  readonly hasEnemy: (enemyId: string) => boolean;
  readonly damageEnemy: (enemyId: string, amount: number) => void;
}
