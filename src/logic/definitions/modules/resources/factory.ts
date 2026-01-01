import { ResourcesModule } from "../../../modules/shared/ResourcesModule";
import { ServiceDefinition } from "../../../core/loader/types";

export const createResourcesDefinition = (): ServiceDefinition<ResourcesModule> => ({
  token: "resources",
  factory: (container) =>
    new ResourcesModule({
      bridge: container.get("bridge"),
      unlocks: container.get("unlocks"),
      bonuses: container.get("bonuses"),
      runState: container.get("mapRunState"),
      statistics: container.get("statistics"),
    }),
  registerAsModule: true,
});
