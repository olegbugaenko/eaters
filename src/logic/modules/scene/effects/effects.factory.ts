import { ServiceContainer } from "../../../core/ServiceContainer";
import { ServiceDefinition } from "../../../core/loader/types";
import { PlayerUnitsModule } from "../../active-map/player-units/player-units.module";
import { EffectsModule } from "./effects.module";

export const createEffectsDefinition = (): ServiceDefinition<EffectsModule, "effects"> => ({
  token: "effects",
  factory: (container) =>
    new EffectsModule({
      scene: container.get("sceneObjects"),
      getUnitPositionIfAlive: container.get<PlayerUnitsModule>("playerUnits").getUnitPositionIfAlive,
    }),
  registerAsModule: true,
  onReady: (instance: EffectsModule, container: ServiceContainer) => {
    (container.get<PlayerUnitsModule>("playerUnits") as any).effects = instance;
  },
});
