import type { SceneVector2 } from "../scene-object-manager/scene-object-manager.types";

export interface MovementBodyOptions {
  readonly position: SceneVector2;
  readonly mass: number;
  readonly maxSpeed: number;
  /** Quadratic drag coefficient. When > 0, replaces hard maxSpeed clamp with drag deceleration = drag * v^2. */
  readonly drag?: number;
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
  drag: number;
  force: SceneVector2;
  dampings: MovementDamping[];
  idleTicks: number;
}

export interface MovementDamping {
  initialVelocity: SceneVector2;
  elapsed: number;
  duration: number;
}
