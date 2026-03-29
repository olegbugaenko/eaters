import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { EnemiesModule } from "./enemies.module";
import type { ArcModule } from "../../scene/arc/arc.module";
import type { NavigationCoordinator } from "@/logic/shared/navigation/NavigationCoordinator";

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
      resources: container.get("resources"),
      bonuses: container.get("bonuses"),
      targeting: container.get("targeting"),
      damage: container.get("damage"),
      explosions: container.get("explosion"),
      projectiles: container.get("unitProjectiles"),
      arcs: container.getOptional<ArcModule>("arc") ?? undefined,
      bricks: container.get("bricks"),
      navigation: container.get<NavigationCoordinator>("navigationCoordinator"),
      statusEffects: container.get("statusEffects"),
      darkResearch: container.get("darkResearch"),
    }),
  registerAsModule: true,

  dependsOn: [
    "targeting",
    "damage",
    "explosion",
    "unitProjectiles",
    "bricks",
    "navigationCoordinator",
    "statusEffects",
    "resources",
    "bonuses",
    "darkResearch",
  ],
});
