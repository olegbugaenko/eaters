import { ModuleDefinitionContext } from "../../definitions/modules/context";
import { ServiceDefinition } from "../../core/loader/types";
import { BricksModule } from "./bricks.module";

export const createBricksDefinition = (
  context: ModuleDefinitionContext,
): ServiceDefinition<BricksModule> => ({
  token: "bricks",
  factory: (container) =>
    new BricksModule({
      scene: container.get("sceneObjects"),
      bridge: container.get("bridge"),
      explosions: container.get("explosion"),
      resources: container.get("resources"),
      bonuses: container.get("bonuses"),
      runState: container.get("mapRunState"),
      audio: container.get("audio"),
      onAllBricksDestroyed: () => {
        context.onRunCompleted(true);
      },
      statistics: container.get("statistics"),
    }),
  registerAsModule: true,
});
