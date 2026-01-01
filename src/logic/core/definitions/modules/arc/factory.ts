import { ArcModule } from "../../../../modules/scene/ArcModule";
import { PlayerUnitsModule } from "../../../../modules/active-map/units/PlayerUnitsModule";
import { ServiceDefinition } from "../../types";

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
