import type { SceneVector2, SceneColor } from "../../../../services/scene-object-manager/scene-object-manager.types";

export interface SandStormCustomData {
  intensity: number;
  phase: number;
  velocity: SceneVector2;
  lastUpdateTime: number;
  spinSpeed: number;
  rotationSpeedMultiplier: number;
  spiralArms: number;
  spiralArms2: number;
  spiralTwist: number;
  spiralTwist2: number;
  colorInner: SceneColor;
  colorMid: SceneColor;
  colorOuter: SceneColor;
}

export interface WhirlState {
  id: string;
  spellId: string;
  position: SceneVector2;
  velocity: SceneVector2;
  radius: number;
  baseDamagePerSecond: number;
  baseMaxHealth: number;
  maxHealth: number;
  remainingHealth: number;
  damageMultiplier: number;
  phase: number;
  spinSpeed: number;
  // Візуальні параметри
  rotationSpeedMultiplier: number;
  spiralArms: number;
  spiralArms2: number;
  spiralTwist: number;
  spiralTwist2: number;
  colorInner: SceneColor;
  colorMid: SceneColor;
  colorOuter: SceneColor;
  renderData: SandStormCustomData;
}
