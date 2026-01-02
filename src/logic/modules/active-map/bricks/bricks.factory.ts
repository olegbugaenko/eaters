import { ServiceDefinition } from "../../../core/loader/types";
import { BricksModule } from "./bricks.module";

export const createBricksDefinition = (): ServiceDefinition<BricksModule> => ({
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
      statistics: container.get("statistics"),
    }),
  registerAsModule: true,
});
