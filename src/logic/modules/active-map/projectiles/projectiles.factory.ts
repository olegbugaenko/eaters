import { ServiceDefinition } from "../../../core/loader/types";
import { UnitProjectileController } from "./ProjectileController";

export const createUnitProjectilesDefinition = (): ServiceDefinition<
  UnitProjectileController,
  "unitProjectiles"
> => ({
  token: "unitProjectiles",
  factory: (container) =>
    new UnitProjectileController({
      scene: container.get("sceneObjects"),
      bricks: container.get("bricks"),
      targeting: container.get("targeting"),
    }),
  registerAsModule: false,
});
