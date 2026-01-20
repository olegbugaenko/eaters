import type { SceneVector2, SceneColor } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { BulletSpriteName } from "./bullet-sprites.const";

export type BulletShape = "circle" | "sprite";

export interface BulletVisualConfig {
  readonly visualKey: string;
  readonly bodyColor: SceneColor;
  readonly tailStartColor: SceneColor;
  readonly tailEndColor: SceneColor;
  readonly tailLengthMultiplier: number;
  readonly tailWidthMultiplier: number;
  /** Tail offset along movement axis (positive = forward, negative = backward) */
  readonly tailOffsetMultiplier?: number;
  readonly shape: BulletShape;
  /** If set, body uses radial gradient from center to edge */
  readonly centerColor?: SceneColor;
  readonly edgeColor?: SceneColor;
  /** Sprite name for shape === "sprite" */
  readonly spriteName?: BulletSpriteName;
  /** Sprite index for shape === "sprite" */
  readonly spriteIndex?: number;
}

export interface BulletSlotHandle {
  readonly batchKey: string;
  readonly visualKey: string;
  readonly slotIndex: number;
}

export type AcquireSlotFn = (config: BulletVisualConfig) => BulletSlotHandle | null;
export type UpdateSlotFn = (
  handle: BulletSlotHandle,
  position: SceneVector2,
  movementRotation: number,
  visualRotation: number,
  radius: number,
  active: boolean
) => void;
export type ReleaseSlotFn = (handle: BulletSlotHandle) => void;
export type CreateConfigFn = (
  visualKey: string,
  overrides?: Partial<Omit<BulletVisualConfig, "visualKey">>
) => BulletVisualConfig;

export interface BulletRenderBridge {
  acquireSlot: AcquireSlotFn;
  updateSlot: UpdateSlotFn;
  releaseSlot: ReleaseSlotFn;
  createConfig: CreateConfigFn;
}
