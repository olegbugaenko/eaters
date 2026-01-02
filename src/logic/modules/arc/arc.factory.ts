import { ServiceDefinition } from "../../core/loader/types";
import { PlayerUnitsModule } from "../player-units/player-units.module";
import { ArcModule } from "./arc.module";

export const createArcDefinition = (): ServiceDefinition<ArcModule> => ({
  token: "arc",
  factory: (container) =>
    new ArcModule({
      scene: container.get("sceneObjects"),
      getUnitPositionIfAlive: container.get<PlayerUnitsModule>("playerUnits").getUnitPositionIfAlive,
    }),
  registerAsModule: true,
  onReady: (instance, container) => {
    (container.get<PlayerUnitsModule>("playerUnits") as any).arcs = instance;
  },
});
