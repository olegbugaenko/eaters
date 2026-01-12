import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

export type TargetType = "brick" | string;

export interface TargetSnapshot<TType extends TargetType = TargetType, TData = unknown> {
  readonly id: string;
  readonly type: TType;
  readonly position: SceneVector2;
  readonly hp: number;
  readonly maxHp: number;
  readonly armor: number;
  readonly baseDamage: number;
  readonly physicalSize: number;
  readonly rewardMultiplier?: number;
  readonly data?: TData;
}

export interface TargetingFilter {
  readonly types?: readonly TargetType[];
}

export interface TargetingProvider<TType extends TargetType = TargetType, TData = unknown> {
  readonly types: readonly TType[];
  getById(id: string): TargetSnapshot<TType, TData> | null;
  findNearest(
    position: SceneVector2,
    filter?: TargetingFilter,
  ): TargetSnapshot<TType, TData> | null;
  findInRadius(
    position: SceneVector2,
    radius: number,
    filter?: TargetingFilter,
  ): TargetSnapshot<TType, TData>[];
  forEachInRadius(
    position: SceneVector2,
    radius: number,
    visitor: (target: TargetSnapshot<TType, TData>) => void,
    filter?: TargetingFilter,
  ): void;
}

export function isTargetOfType<
  TType extends TargetType,
  TData = unknown,
>(
  target: TargetSnapshot<TargetType, unknown>,
  type: TType,
): target is TargetSnapshot<TType, TData> {
  return target.type === type;
}
