import { BulletModule } from "../../../../modules/active-map/BulletModule";
import { ServiceDefinition } from "../../types";

export const createBulletDefinition = (): ServiceDefinition<BulletModule> => ({
  token: "bullet",
  factory: (container) =>
    new BulletModule({
      scene: container.get("sceneObjects"),
      explosions: container.get("explosion"),
      runState: container.get("mapRunState"),
    }),
  registerAsModule: true,
});
