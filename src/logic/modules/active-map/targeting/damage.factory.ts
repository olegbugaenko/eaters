import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { DamageService } from "./DamageService";

export const createDamageDefinition = (): ServiceDefinition<DamageService, "damage"> => ({
  token: "damage",
  factory: (container) =>
    new DamageService({
      bridge: container.get("bridge"),
      bricks: () => container.get("bricks"),
      enemies: () => container.get("enemies"),
      units: () => container.get("playerUnits"),
      explosions: container.get("explosion"),
      targeting: container.get("targeting"),
    }),
  registerAsModule: false,
  dependsOn: ["explosion", "targeting"],
});
