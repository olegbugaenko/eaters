import type { SceneColor } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

export interface AnimatedRingCustomData {
  createdAt?: number;
  lifetimeMs?: number;
  startRadius?: number;
  endRadius?: number;
  startAlpha?: number;
  endAlpha?: number;
  innerStop?: number;
  outerStop?: number;
  outerFadeStop?: number;
  color?: SceneColor;
}

export interface CachedFill {
  fill: import("@core/logic/provided/services/scene-object-manager/scene-object-manager.types").SceneFill;
  stops: Array<{ offset: number; color: SceneColor }>;
  colors: SceneColor[];
}
