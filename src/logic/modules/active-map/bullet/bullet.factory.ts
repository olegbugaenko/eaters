import { ServiceDefinition } from "../../../core/loader/types";
import { BulletModule } from "./bullet.module";

export const createBulletDefinition = (): ServiceDefinition<BulletModule, "bullet"> => ({
  token: "bullet",
  factory: (container) =>
    new BulletModule({
      scene: container.get("sceneObjects"),
      explosions: container.get("explosion"),
      runState: container.get("mapRunState"),
    }),
  registerAsModule: true,
  dependsOn: ["explosion"],
});
