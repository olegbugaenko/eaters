import { ExplosionModule } from "../../../../modules/scene/ExplosionModule";
import { ServiceDefinition } from "../../types";

export const createExplosionDefinition = (): ServiceDefinition<ExplosionModule> => ({
  token: "explosion",
  factory: (container) =>
    new ExplosionModule({
      scene: container.get("sceneObjects"),
    }),
  registerAsModule: true,
});
