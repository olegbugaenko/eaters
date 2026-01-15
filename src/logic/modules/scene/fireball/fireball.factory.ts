import { ServiceContainer } from "@/core/logic/engine/ServiceContainer";
import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { PlayerUnitsModule } from "../../active-map/player-units/player-units.module";
import { FireballModule } from "./fireball.module";

export const createFireballDefinition = (): ServiceDefinition<FireballModule, "fireball"> => ({
  token: "fireball",
  factory: (container) =>
    new FireballModule({
      scene: container.get("sceneObjects"),
      bricks: container.get("bricks"),
      damage: container.get("damage"),
      explosions: container.get("explosion"),
      projectiles: container.get("unitProjectiles"),
      logEvent: (message) => console.log(`[FireballModule] ${message}`),
    }),
  registerAsModule: true,
  dependsOn: ["bricks", "damage", "explosion", "unitProjectiles", "playerUnits"],
  onReady: (instance: FireballModule, container: ServiceContainer) => {
    (container.get<PlayerUnitsModule>("playerUnits") as any).fireballs = instance;
  },
});
