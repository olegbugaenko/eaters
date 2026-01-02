import { ServiceDefinition } from "../../../core/loader/types";
import { NecromancerModule } from "./necromancer.module";

export const createNecromancerDefinition = (): ServiceDefinition<NecromancerModule, "necromancer"> => ({
  token: "necromancer",
  factory: (container) =>
    new NecromancerModule({
      bridge: container.get("bridge"),
      playerUnits: container.get("playerUnits"),
      scene: container.get("sceneObjects"),
      bonuses: container.get("bonuses"),
      unitDesigns: container.get("unitDesign"),
      runState: container.get("mapRunState"),
    }),
  registerAsModule: true,
});
