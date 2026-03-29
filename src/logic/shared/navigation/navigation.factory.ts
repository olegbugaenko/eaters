import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { NavigationCoordinator } from "./NavigationCoordinator";
import { NavigationWorldSnapshot } from "./NavigationWorldSnapshot";
import { BrickObstacleProvider } from "@/logic/modules/active-map/enemies/brick-obstacle-provider";
import type { BricksModule } from "@/logic/modules/active-map/bricks/bricks.module";
import type { SceneObjectManager } from "@/core/logic/provided/services/scene-object-manager/SceneObjectManager";

export const createNavigationDefinition = (): ServiceDefinition<
  NavigationCoordinator,
  "navigationCoordinator"
> => ({
  token: "navigationCoordinator",
  factory: (container) => {
    const scene = container.get<SceneObjectManager>("sceneObjects");
    const bricks = container.get<BricksModule>("bricks");
    const world = new NavigationWorldSnapshot({
      obstacles: new BrickObstacleProvider(bricks),
      getMapSize: () => scene.getMapSize(),
      getObstacleRevision: () => bricks.getNavigationRevision(),
      plannerBudgetPerTick: 96,
    });
    return new NavigationCoordinator(world);
  },
  registerAsModule: false,
  dependsOn: ["bricks"],
});
