import { ServiceDefinition } from "../../core/loader/types";
import { ExplosionModule } from "./explosion.module";

export const createExplosionDefinition = (): ServiceDefinition<ExplosionModule> => ({
  token: "explosion",
  factory: (container) =>
    new ExplosionModule({
      scene: container.get("sceneObjects"),
    }),
  registerAsModule: true,
});
