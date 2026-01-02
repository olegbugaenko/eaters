import { ModuleDefinitionContext } from "../../../definitions/modules/context";
import { ServiceDefinition } from "../../../core/loader/types";
import { NecromancerModule } from "./necromancer.module";

export const createNecromancerDefinition = (
  context: ModuleDefinitionContext,
): ServiceDefinition<NecromancerModule> => ({
  token: "necromancer",
  factory: (container) =>
    new NecromancerModule({
      bridge: container.get("bridge"),
      playerUnits: container.get("playerUnits"),
      scene: container.get("sceneObjects"),
      bonuses: container.get("bonuses"),
      unitDesigns: container.get("unitDesign"),
      runState: container.get("mapRunState"),
      onSanityDepleted: () => {
        context.onRunCompleted(false);
      },
    }),
  registerAsModule: true,
});
