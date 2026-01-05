import type { SceneVector2, SceneColor } from "@/logic/services/scene-object-manager/scene-object-manager.types";

export interface SandStormCustomData {
  intensity?: number;
  phase?: number;
  velocity?: SceneVector2;
  lastUpdateTime?: number;
  spinSpeed?: number;
  rotationSpeedMultiplier?: number;
  spiralArms?: number;
  spiralArms2?: number;
  spiralTwist?: number;
  spiralTwist2?: number;
  colorInner?: SceneColor;
  colorMid?: SceneColor;
  colorOuter?: SceneColor;
}

export interface InterpolationData {
  basePosition: SceneVector2;
  velocity: SceneVector2;
  lastUpdateTime: number;
  phase: number;
  spinSpeed: number;
  radius: number;
  intensity: number;
  rotationSpeedMultiplier: number;
  spiralArms: number;
  spiralArms2: number;
  spiralTwist: number;
  spiralTwist2: number;
  colorInner: [number, number, number];
  colorMid: [number, number, number];
  colorOuter: [number, number, number];
}
