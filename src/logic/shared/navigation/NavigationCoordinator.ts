import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { PathResult } from "./PathfindingService";
import type { PassabilityTag } from "./passability.types";
import {
  NavigationWorldSnapshot,
  type NavigationPathRequest,
} from "./NavigationWorldSnapshot";

const distanceSquared = (a: SceneVector2, b: SceneVector2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export interface NavigationTargetSnapshot {
  readonly id: string;
  readonly position: SceneVector2;
}

export interface NavigationActorState {
  targetId: string;
  targetPosition: SceneVector2;
  targetRadius: number;
  waypoints: SceneVector2[];
  goalReached: boolean;
  repathCooldown: number;
  lastPosition: SceneVector2;
  stuckTimer: number;
  lastObstacleRevision: number;
  lastTargetRevision: number;
}

export interface NavigationPlanContext {
  readonly distanceToTarget: number;
  readonly path: PathResult;
}

export interface NavigationPlanRequest {
  readonly actorId: string;
  readonly actorPosition: SceneVector2;
  readonly target: NavigationTargetSnapshot | null;
  readonly targetRadius: number;
  readonly entityRadius: number;
  readonly passabilityTag: PassabilityTag;
  readonly deltaSeconds: number;
  readonly targetRevision?: number;
  readonly targetMovedThresholdSq?: number;
  readonly goalCooldownSeconds?: number;
  readonly repathOnObstacleChange?: boolean;
  readonly getRepathCooldown: (context: NavigationPlanContext) => number;
}

export class NavigationCoordinator {
  private readonly world: NavigationWorldSnapshot;
  private readonly states = new Map<string, NavigationActorState>();
  private readonly actorMemory = new Map<string, Map<string, unknown>>();

  constructor(world: NavigationWorldSnapshot) {
    this.world = world;
  }

  public beginPlanningTick(): void {
    this.world.beginPlanningTick();
  }

  public cacheAllObstacles(passabilityTag: PassabilityTag): void {
    this.world.cacheAllObstacles(passabilityTag);
  }

  public getCellSize(): number {
    return this.world.getCellSize();
  }

  public getState(actorId: string): NavigationActorState | undefined {
    return this.states.get(actorId);
  }

  public clearActor(actorId: string): void {
    this.states.delete(actorId);
    this.actorMemory.delete(actorId);
  }

  public clearActorState(actorId: string): void {
    this.states.delete(actorId);
  }

  public clearAll(): void {
    this.states.clear();
    this.actorMemory.clear();
  }

  public clearActorsByPrefix(prefix: string): void {
    for (const actorId of this.states.keys()) {
      if (actorId.startsWith(prefix)) {
        this.states.delete(actorId);
      }
    }
    for (const actorId of this.actorMemory.keys()) {
      if (actorId.startsWith(prefix)) {
        this.actorMemory.delete(actorId);
      }
    }
  }

  public getActorMemory<T>(actorId: string, key: string): T | undefined {
    const memory = this.actorMemory.get(actorId);
    return memory?.get(key) as T | undefined;
  }

  public setActorMemory(actorId: string, key: string, value: unknown): void {
    const memory = this.actorMemory.get(actorId) ?? new Map<string, unknown>();
    memory.set(key, value);
    this.actorMemory.set(actorId, memory);
  }

  public clearActorMemory(actorId: string, key: string): void {
    const memory = this.actorMemory.get(actorId);
    if (!memory) {
      return;
    }
    memory.delete(key);
    if (memory.size === 0) {
      this.actorMemory.delete(actorId);
    }
  }

  public planNavigation(
    request: NavigationPlanRequest,
  ): NavigationActorState | undefined {
    if (!request.target) {
      this.clearActor(request.actorId);
      return undefined;
    }

    const obstacleRevision = this.world.getObstacleRevision();
    const targetRevision = request.targetRevision ?? 0;
    const baseTargetRadius = Math.max(request.targetRadius, 0);
    const existing = this.states.get(request.actorId);
    const distanceToTargetSq = distanceSquared(
      request.actorPosition,
      request.target.position,
    );
    const targetMovedThresholdSq =
      request.targetMovedThresholdSq ??
      this.getCellSize() * this.getCellSize() * 0.5;
    const targetMoved = existing
      ? distanceSquared(existing.targetPosition, request.target.position) >
        targetMovedThresholdSq
      : true;
    const repathCooldown = Math.max(
      (existing?.repathCooldown ?? 0) - Math.max(request.deltaSeconds, 0),
      0,
    );

    if (distanceToTargetSq <= baseTargetRadius * baseTargetRadius) {
      const goalState: NavigationActorState = {
        targetId: request.target.id,
        targetPosition: { ...request.target.position },
        targetRadius: baseTargetRadius,
        waypoints: [],
        goalReached: true,
        repathCooldown: Math.max(request.goalCooldownSeconds ?? 0.2, 0),
        lastPosition: { ...request.actorPosition },
        stuckTimer: 0,
        lastObstacleRevision: obstacleRevision,
        lastTargetRevision: targetRevision,
      };
      this.states.set(request.actorId, goalState);
      return goalState;
    }

    const obstacleStale =
      existing !== undefined &&
      existing.lastObstacleRevision !== obstacleRevision;
    const targetChanged =
      !existing ||
      existing.targetId !== request.target.id ||
      existing.lastTargetRevision !== targetRevision;
    const needsPath =
      !existing ||
      targetChanged ||
      existing.goalReached ||
      existing.waypoints.length === 0 ||
      repathCooldown <= 0 ||
      targetMoved ||
      ((request.repathOnObstacleChange ?? true) && obstacleStale);

    if (!needsPath && existing) {
      existing.targetPosition = { ...request.target.position };
      existing.targetRadius = baseTargetRadius;
      existing.repathCooldown = repathCooldown;
      existing.lastTargetRevision = targetRevision;
      this.states.set(request.actorId, existing);
      return existing;
    }

    const path = this.world.findPathToTarget({
      start: request.actorPosition,
      target: request.target.position,
      targetRadius: baseTargetRadius,
      entityRadius: request.entityRadius,
      passabilityTag: request.passabilityTag,
    });

    if (!path) {
      if (existing) {
        existing.targetPosition = { ...request.target.position };
        existing.targetRadius = baseTargetRadius;
        existing.repathCooldown = repathCooldown;
        existing.lastTargetRevision = targetRevision;
        this.states.set(request.actorId, existing);
        return existing;
      }
      const blockedState: NavigationActorState = {
        targetId: request.target.id,
        targetPosition: { ...request.target.position },
        targetRadius: baseTargetRadius,
        waypoints: [],
        goalReached: false,
        repathCooldown: 0,
        lastPosition: { ...request.actorPosition },
        stuckTimer: 0,
        lastObstacleRevision: obstacleRevision,
        lastTargetRevision: targetRevision,
      };
      this.states.set(request.actorId, blockedState);
      return blockedState;
    }

    const nextState: NavigationActorState = {
      targetId: request.target.id,
      targetPosition: { ...request.target.position },
      targetRadius: baseTargetRadius,
      waypoints: path.waypoints.map((point) => ({ ...point })),
      goalReached: path.goalReached,
      repathCooldown: Math.max(
        request.getRepathCooldown({
          distanceToTarget: Math.sqrt(distanceToTargetSq),
          path,
        }),
        0,
      ),
      lastPosition: { ...request.actorPosition },
      stuckTimer: 0,
      lastObstacleRevision: obstacleRevision,
      lastTargetRevision: targetRevision,
    };
    this.states.set(request.actorId, nextState);
    return nextState;
  }

  public consumeWaypoints(
    actorId: string,
    actorPosition: SceneVector2,
    targetPosition: SceneVector2 | null,
    options?: { threshold?: number },
  ): void {
    const state = this.states.get(actorId);
    if (!state) {
      return;
    }
    const threshold = Math.max(
      options?.threshold ?? this.getCellSize() * 0.5,
      0,
    );
    const thresholdSq = threshold * threshold;

    while (state.waypoints.length > 0) {
      const waypoint = state.waypoints[0]!;
      if (distanceSquared(actorPosition, waypoint) > thresholdSq) {
        break;
      }
      state.waypoints.shift();
    }

    if (state.waypoints.length === 0 && targetPosition) {
      state.goalReached =
        distanceSquared(actorPosition, targetPosition) <=
        state.targetRadius * state.targetRadius;
    }
  }

  public trackProgress(
    actorId: string,
    actorPosition: SceneVector2,
    deltaSeconds: number,
    options?: { stuckTimeout?: number },
  ): void {
    const state = this.states.get(actorId);
    if (!state) {
      return;
    }

    const movedSq = distanceSquared(actorPosition, state.lastPosition);
    if (movedSq < 1) {
      state.stuckTimer += Math.max(deltaSeconds, 0);
      if (state.stuckTimer > Math.max(options?.stuckTimeout ?? 0.6, 0)) {
        state.repathCooldown = 0;
        state.waypoints = [];
        state.goalReached = false;
      }
      return;
    }

    state.stuckTimer = 0;
    state.lastPosition = { ...actorPosition };
  }

  public getDestination(
    actorId: string,
    fallbackTargetPosition: SceneVector2,
  ): SceneVector2 {
    const state = this.states.get(actorId);
    return state?.waypoints[0]
      ? { ...state.waypoints[0] }
      : { ...fallbackTargetPosition };
  }

  public probePath(
    request: NavigationPathRequest,
    options?: { ignoreBudget?: boolean },
  ): PathResult | null {
    return this.world.findPathToTarget(request, options);
  }
}
