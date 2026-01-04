import type { SceneVector2 } from "../scene-object-manager/scene-object-manager.types";

export interface MovementBodyOptions {
  readonly position: SceneVector2;
  readonly mass: number;
  readonly maxSpeed: number;
}

export interface MovementBodyState {
  readonly id: string;
  readonly position: SceneVector2;
  readonly velocity: SceneVector2;
}

export interface InternalMovementBodyState {
  id: string;
  position: SceneVector2;
  velocity: SceneVector2;
  mass: number;
  maxSpeed: number;
  force: SceneVector2;
  dampings: MovementDamping[];
}

export interface MovementDamping {
  initialVelocity: SceneVector2;
  elapsed: number;
  duration: number;
}
