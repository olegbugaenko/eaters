import { ServiceContainer } from "@/core/logic/engine/ServiceContainer";
import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { PlayerUnitsModule } from "../../active-map/player-units/player-units.module";
import type { EnemiesModule } from "../../active-map/enemies/enemies.module";
import { ArcModule } from "./arc.module";

export const createArcDefinition = (): ServiceDefinition<ArcModule, "arc"> => ({
  token: "arc",
  factory: (container) =>
    new ArcModule({
      scene: container.get("sceneObjects"),
      getUnitPositionIfAlive:
        container.get<PlayerUnitsModule>("playerUnits").getUnitPositionIfAlive,
      getEnemyPositionIfAlive:
        container.get<EnemiesModule>("enemies").getEnemyPositionIfAlive,
      audio: container.getOptional("audio") ?? undefined,
    }),
  registerAsModule: true,
  dependsOn: ["playerUnits", "enemies"],
  onReady: (instance: ArcModule, container: ServiceContainer) => {
    (container.get<PlayerUnitsModule>("playerUnits") as any).arcs = instance;
    (container.get<EnemiesModule>("enemies") as any).arcs = instance;
  },
});
