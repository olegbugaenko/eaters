import { ServiceContainer } from "@/core/logic/engine/ServiceContainer";
import { ServiceDefinition } from "@/core/logic/engine/loader/types";
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
  dependsOn: ["playerUnits"],
  onReady: (instance: EffectsModule, container: ServiceContainer) => {
    (container.get<PlayerUnitsModule>("playerUnits") as any).effects = instance;
  },
});
