import { ServiceDefinition } from "../../core/loader/types";
import { PlayerUnitsModule } from "../player-units/player-units.module";
import { FireballModule } from "./fireball.module";

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
