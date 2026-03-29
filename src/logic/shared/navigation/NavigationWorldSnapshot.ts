import type {
  SceneSize,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  PathfindingService,
  type PathResult,
} from "./PathfindingService";
import type { ObstacleProvider } from "./navigation.types";
import type { PassabilityTag } from "./passability.types";

export interface NavigationWorldSnapshotOptions {
  readonly obstacles: ObstacleProvider;
  readonly getMapSize: () => SceneSize;
  readonly pathfinder?: PathfindingService;
  readonly getObstacleRevision?: () => number;
  readonly plannerBudgetPerTick?: number;
}

export interface NavigationPathRequest {
  readonly start: SceneVector2;
  readonly target: SceneVector2;
  readonly targetRadius: number;
  readonly entityRadius: number;
  readonly passabilityTag?: PassabilityTag;
}

export class NavigationWorldSnapshot {
  private readonly pathfinder: PathfindingService;
  private readonly getObstacleRevisionFn?: () => number;
  private readonly plannerBudgetPerTick: number;
  private plannerBudgetRemaining = Number.POSITIVE_INFINITY;
  private planningWindowActive = false;

  constructor(options: NavigationWorldSnapshotOptions) {
    this.pathfinder =
      options.pathfinder ??
      new PathfindingService({
        obstacles: options.obstacles,
        getMapSize: options.getMapSize,
      });
    this.getObstacleRevisionFn = options.getObstacleRevision;
    this.plannerBudgetPerTick = Math.max(
      options.plannerBudgetPerTick ?? 64,
      1,
    );
  }

  public beginPlanningTick(): void {
    this.plannerBudgetRemaining = this.plannerBudgetPerTick;
    this.planningWindowActive = true;
  }

  public cacheAllObstacles(passabilityTag: PassabilityTag): void {
    this.pathfinder.cacheAllObstacles(passabilityTag);
  }

  public getObstacleRevision(): number {
    return this.getObstacleRevisionFn?.() ?? 0;
  }

  public getCellSize(): number {
    return this.pathfinder.getCellSize();
  }

  public findPathToTarget(
    request: NavigationPathRequest,
    options?: { ignoreBudget?: boolean },
  ): PathResult | null {
    if (
      options?.ignoreBudget !== true &&
      this.planningWindowActive &&
      this.plannerBudgetRemaining <= 0
    ) {
      return null;
    }
    if (options?.ignoreBudget !== true && this.planningWindowActive) {
      this.plannerBudgetRemaining -= 1;
    }
    return this.pathfinder.findPathToTarget(request);
  }
}
