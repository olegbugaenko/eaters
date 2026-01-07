import { ServiceDefinition } from "../../../core/loader/types";
import { EnemiesModule } from "./enemies.module";

export const createEnemiesDefinition = (): ServiceDefinition<
  EnemiesModule,
  "enemies"
> => ({
  token: "enemies",
  factory: (container) =>
    new EnemiesModule({
      scene: container.get("sceneObjects"),
      bridge: container.get("bridge"),
      runState: container.get("mapRunState"),
      movement: container.get("movement"),
      targeting: container.get("targeting"),
      damage: container.get("damage"),
      explosions: container.get("explosion"),
      projectiles: container.get("unitProjectiles"),
      arcs: container.get("arc"),
      bricks: container.get("bricks"),
      statusEffects: container.get("statusEffects"),
    }),
  registerAsModule: true,
});
