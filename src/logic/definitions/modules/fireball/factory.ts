import { FireballModule } from "../../../modules/scene/FireballModule";
import { PlayerUnitsModule } from "../../../modules/active-map/units/PlayerUnitsModule";
import { ServiceDefinition } from "../../../core/loader/types";

export const createFireballDefinition = (): ServiceDefinition<FireballModule> => ({
  token: "fireball",
  factory: (container) =>
    new FireballModule({
      scene: container.get("sceneObjects"),
      bricks: container.get("bricks"),
      explosions: container.get("explosion"),
      logEvent: (message) => console.log(`[FireballModule] ${message}`),
    }),
  registerAsModule: true,
  onReady: (instance, container) => {
    (container.get<PlayerUnitsModule>("playerUnits") as any).fireballs = instance;
  },
});
