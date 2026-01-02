import { ServiceDefinition } from "../../../core/loader/types";
import { ExplosionModule } from "./explosion.module";

export const createExplosionDefinition = (): ServiceDefinition<ExplosionModule, "explosion"> => ({
  token: "explosion",
  factory: (container) =>
    new ExplosionModule({
      scene: container.get("sceneObjects"),
    }),
  registerAsModule: true,
});
