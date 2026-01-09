import { ServiceDefinition } from "../../../core/loader/types";
import { ResourcesModule } from "./resources.module";

export const createResourcesDefinition = (): ServiceDefinition<ResourcesModule, "resources"> => ({
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
  dependsOn: ["unlocks", "bonuses", "statistics"],
});
