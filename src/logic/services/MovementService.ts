import { SceneVector2 } from "./SceneObjectManager";

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

interface InternalMovementBodyState {
  id: string;
  position: SceneVector2;
  velocity: SceneVector2;
  mass: number;
  maxSpeed: number;
  force: SceneVector2;
  dampings: MovementDamping[];
}

interface MovementDamping {
  initialVelocity: SceneVector2;
  elapsed: number;
  duration: number;
}

const ZERO_VECTOR: SceneVector2 = { x: 0, y: 0 };

const clampPositive = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
};

const cloneVector = (vector: SceneVector2): SceneVector2 => ({ x: vector.x, y: vector.y });

const scaleVector = (vector: SceneVector2, scalar: number): SceneVector2 => ({
  x: vector.x * scalar,
  y: vector.y * scalar,
});

const addVectors = (a: SceneVector2, b: SceneVector2): SceneVector2 => ({
  x: a.x + b.x,
  y: a.y + b.y,
});

const subtractVectors = (a: SceneVector2, b: SceneVector2): SceneVector2 => ({
  x: a.x - b.x,
  y: a.y - b.y,
});

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
