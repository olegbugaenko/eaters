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
      targeting: container.get("targeting"),
      damage: container.get("damage"),
    }),
  registerAsModule: false,
  dependsOn: ["targeting", "damage"],
});
