import type { SceneVector2 } from "../scene-object-manager/scene-object-manager.types";
import {
  cloneVector,
  scaleVector,
  addVectors,
  subtractVectors,
} from "../../helpers/vector.helper";
import type {
  MovementBodyOptions,
  MovementBodyState,
  InternalMovementBodyState,
} from "./movement.types";
import { ZERO_VECTOR } from "../../helpers/geometry.const";
import { clampPositive } from "./movement.helpers";

export class MovementService {
  private bodies = new Map<string, InternalMovementBodyState>();
  private bodyOrder: InternalMovementBodyState[] = [];
  private idCounter = 0;

  public createBody(options: MovementBodyOptions): string {
    const id = this.createBodyId();
    const position = cloneVector(options.position);
    const mass = clampPositive(options.mass, 1);
    const maxSpeed = Math.max(options.maxSpeed, 0);

    const body: InternalMovementBodyState = {
      id,
      position,
      velocity: { ...ZERO_VECTOR },
      mass,
      maxSpeed,
      force: { ...ZERO_VECTOR },
      dampings: [],
    };

    this.bodies.set(id, body);
    this.bodyOrder.push(body);

    return id;
  }

  public removeBody(bodyId: string): void {
    const body = this.bodies.get(bodyId);
    if (!body) {
      return;
    }
    this.bodies.delete(bodyId);
    this.bodyOrder = this.bodyOrder.filter((current) => current.id !== bodyId);
  }

  public getBodyState(bodyId: string): MovementBodyState | null {
    const body = this.bodies.get(bodyId);
    if (!body) {
      return null;
    }
    return {
      id: body.id,
      position: cloneVector(body.position),
      velocity: cloneVector(body.velocity),
    };
  }

  public setBodyPosition(bodyId: string, position: SceneVector2): void {
    const body = this.bodies.get(bodyId);
    if (!body) {
      return;
    }
    body.position = cloneVector(position);
  }

  public setBodyVelocity(bodyId: string, velocity: SceneVector2): void {
    const body = this.bodies.get(bodyId);
    if (!body) {
      return;
    }
    body.velocity = cloneVector(velocity);
    body.dampings = [];
  }

  public setForce(bodyId: string, force: SceneVector2): void {
    const body = this.bodies.get(bodyId);
    if (!body) {
      return;
    }
    body.force = cloneVector(force);
  }

  public applyImpulse(bodyId: string, velocity: SceneVector2, duration = 1): void {
    const body = this.bodies.get(bodyId);
    if (!body) {
      return;
    }

    const safeDuration = clampPositive(duration, 0.001);
    const impulseVelocity = cloneVector(velocity);

    body.velocity = addVectors(body.velocity, impulseVelocity);
    body.dampings.push({
      initialVelocity: impulseVelocity,
      elapsed: 0,
      duration: safeDuration,
    });
  }

  public update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      this.resetForces();
      return;
    }

    this.bodyOrder.forEach((body) => {
      const acceleration = scaleVector(body.force, 1 / body.mass);
      body.velocity = addVectors(body.velocity, scaleVector(acceleration, deltaSeconds));

      body.dampings = body.dampings.filter((damping) => {
        if (damping.duration <= 0) {
          return false;
        }
        const remaining = Math.max(damping.duration - damping.elapsed, 0);
        const step = Math.min(deltaSeconds, remaining);
        if (step <= 0) {
          damping.elapsed = damping.duration;
          return false;
        }
        const previousRatio = damping.elapsed / damping.duration;
        damping.elapsed += step;
        const nextRatio = Math.min(damping.elapsed / damping.duration, 1);
        const fraction = nextRatio - previousRatio;
        const reduction = scaleVector(damping.initialVelocity, fraction);
        body.velocity = subtractVectors(body.velocity, reduction);
        return damping.elapsed < damping.duration - 1e-6;
      });

      const speed = Math.hypot(body.velocity.x, body.velocity.y);
      if (body.maxSpeed > 0 && speed > body.maxSpeed) {
        const factor = body.maxSpeed / speed;
        body.velocity = scaleVector(body.velocity, factor);
      }

      body.position = addVectors(body.position, scaleVector(body.velocity, deltaSeconds));
    });

    this.resetForces();
  }

  private resetForces(): void {
    this.bodyOrder.forEach((body) => {
      body.force = { ...ZERO_VECTOR };
    });
  }

  private createBodyId(): string {
    this.idCounter += 1;
    return `movement-body-${this.idCounter}`;
  }
}

// Re-export types for backward compatibility
export type { MovementBodyOptions, MovementBodyState } from "./movement.types";
