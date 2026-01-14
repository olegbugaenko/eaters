import { ServiceDefinition } from "@/core/logic/engine/loader/types";
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
      audio: container.getOptional("audio") ?? undefined,
    }),
  registerAsModule: false,
  dependsOn: ["targeting", "damage"],
});
