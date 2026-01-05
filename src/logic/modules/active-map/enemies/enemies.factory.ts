import { ServiceDefinition } from "../../../core/loader/types";
import { EnemiesModule } from "./enemies.module";

export const createEnemiesDefinition = (): ServiceDefinition<EnemiesModule, "enemies"> => ({
  token: "enemies",
  factory: (container) =>
    new EnemiesModule({
      scene: container.get("sceneObjects"),
      bridge: container.get("bridge"),
      runState: container.get("mapRunState"),
      targeting: container.get("targeting"),
      damage: container.get("damage"),
      explosions: container.get("explosion"),
    }),
  registerAsModule: true,
});
