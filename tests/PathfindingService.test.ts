import assert from "assert";
import { describe, test } from "./testRunner";
import { PathfindingService } from "../src/logic/shared/navigation/PathfindingService";
import type { ObstacleDescriptor, ObstacleProvider } from "../src/logic/shared/navigation/navigation.types";
import type { SceneVector2 } from "../src/logic/services/scene-object-manager/scene-object-manager.types";

class StaticObstacleProvider implements ObstacleProvider {
  constructor(private readonly obstacles: readonly ObstacleDescriptor[]) {}

  public forEachObstacleNear(
    position: SceneVector2,
    radius: number,
    visitor: (obstacle: ObstacleDescriptor) => void,
  ): void {
    const radiusSq = radius * radius;
    this.obstacles.forEach((obstacle) => {
      const dx = obstacle.position.x - position.x;
      const dy = obstacle.position.y - position.y;
      if (dx * dx + dy * dy <= (radius + obstacle.radius) * (radius + obstacle.radius) || dx * dx + dy * dy <= radiusSq) {
        visitor(obstacle);
      }
    });
  }
}

describe("PathfindingService", () => {
  test("finds a detour path around blocking obstacles", () => {
    const obstacles: ObstacleDescriptor[] = [{ position: { x: 100, y: 0 }, radius: 20 }];
    const provider = new StaticObstacleProvider(obstacles);
    const pathfinder = new PathfindingService({ obstacles: provider, getMapSize: () => ({ width: 400, height: 200 }), cellSize: 10 });

    const result = pathfinder.findPathToTarget({
      start: { x: 0, y: 0 },
      target: { x: 200, y: 0 },
      targetRadius: 12,
      entityRadius: 10,
    });

    assert(result.waypoints.length > 0, "expected pathfinder to return intermediate waypoints");
    result.waypoints.forEach((point) => {
      const dx = point.x - obstacles[0]!.position.x;
      const dy = point.y - obstacles[0]!.position.y;
      const distance = Math.hypot(dx, dy);
      assert(distance > obstacles[0]!.radius + 9, "waypoints should avoid obstacle radius");
    });
  });

  test("reports goal reached when already inside the target radius", () => {
    const provider = new StaticObstacleProvider([]);
    const pathfinder = new PathfindingService({ obstacles: provider, getMapSize: () => ({ width: 200, height: 200 }) });

    const result = pathfinder.findPathToTarget({
      start: { x: 50, y: 50 },
      target: { x: 55, y: 55 },
      targetRadius: 20,
      entityRadius: 5,
    });

    assert.strictEqual(result.goalReached, true, "should consider goal reached within radius");
    assert.strictEqual(result.waypoints.length, 0, "no waypoints needed when already at goal");
  });
});

