import { EffectsModule } from "../../../../modules/scene/EffectsModule";
import { PlayerUnitsModule } from "../../../../modules/active-map/units/PlayerUnitsModule";
import { ServiceDefinition } from "../../types";

export const createEffectsDefinition = (): ServiceDefinition<EffectsModule> => ({
  token: "effects",
  factory: (container) =>
    new EffectsModule({
      scene: container.get("sceneObjects"),
      getUnitPositionIfAlive: container.get<PlayerUnitsModule>("playerUnits").getUnitPositionIfAlive,
    }),
  registerAsModule: true,
  onReady: (instance, container) => {
    (container.get<PlayerUnitsModule>("playerUnits") as any).effects = instance;
  },
});
