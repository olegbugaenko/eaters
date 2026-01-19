import { ServiceContainer } from "@/core/logic/engine/ServiceContainer";
import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { PlayerUnitsModule } from "../../active-map/player-units/player-units.module";
import { BricksModule } from "../../active-map/bricks/bricks.module";
import type { EnemiesModule } from "../../active-map/enemies/enemies.module";
import { ArcModule } from "./arc.module";

export const createArcDefinition = (): ServiceDefinition<ArcModule, "arc"> => ({
  token: "arc",
  factory: (container) => {
    const playerUnits = container.get<PlayerUnitsModule>("playerUnits");
    const enemies = container.get<EnemiesModule>("enemies");
    const bricks = container.get<BricksModule>("bricks");
    return new ArcModule({
      scene: container.get("sceneObjects"),
      getUnitPositionIfAlive: playerUnits.getUnitPositionIfAlive.bind(playerUnits),
      getEnemyPositionIfAlive: enemies.getEnemyPositionIfAlive.bind(enemies),
      getBrickPositionIfAlive: bricks.getBrickPositionIfAlive.bind(bricks),
      audio: container.getOptional("audio") ?? undefined,
    });
  },
  registerAsModule: true,
  dependsOn: ["playerUnits", "enemies", "bricks"],
  onReady: (instance: ArcModule, container: ServiceContainer) => {
    (container.get<PlayerUnitsModule>("playerUnits") as any).arcs = instance;
    (container.get<EnemiesModule>("enemies") as any).arcs = instance;
  },
});
