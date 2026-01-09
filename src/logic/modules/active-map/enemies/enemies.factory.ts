import { ServiceDefinition } from "../../../core/loader/types";
import { EnemiesModule } from "./enemies.module";
import type { ArcModule } from "../../scene/arc/arc.module";

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
      arcs: container.getOptional<ArcModule>("arc") ?? undefined,
      bricks: container.get("bricks"),
      statusEffects: container.get("statusEffects"),
    }),
  registerAsModule: true,

  dependsOn: ["targeting", "damage", "explosion", "unitProjectiles", "bricks", "statusEffects"],
});
