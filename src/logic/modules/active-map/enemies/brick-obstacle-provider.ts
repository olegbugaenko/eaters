import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { BricksModule } from "../bricks/bricks.module";
import type { ObstacleDescriptor, ObstacleProvider } from "@/logic/shared/navigation/navigation.types";

export class BrickObstacleProvider implements ObstacleProvider {
  constructor(private readonly bricks: BricksModule) {}

  public forEachObstacleNear(
    position: SceneVector2,
    radius: number,
    visitor: (obstacle: ObstacleDescriptor) => void
  ): void {
    this.bricks.forEachBrickNear(position, radius, (brick) => {
      visitor({
        position: brick.position,
        radius: brick.physicalSize,
        passableFor: brick.passableFor,
      });
    });
  }

  public forEachObstacle(visitor: (obstacle: ObstacleDescriptor) => void): void {
    this.bricks.forEachBrick((brick) => {
      visitor({
        position: brick.position,
        radius: brick.physicalSize,
        passableFor: brick.passableFor,
      });
    });
  }
}

