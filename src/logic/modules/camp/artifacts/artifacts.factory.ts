import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { ArtifactsModule } from "./artifacts.module";

export const createArtifactsDefinition = (): ServiceDefinition<ArtifactsModule, "artifacts"> => ({
  token: "artifacts",
  factory: (container) =>
    new ArtifactsModule({
      bridge: container.get("bridge"),
      unlocks: container.get("unlocks"),
      newUnlocks: container.get("newUnlocks"),
      localization: container.get("localization"),
    }),
  registerAsModule: true,
  dependsOn: ["unlocks", "newUnlocks", "localization"],
});
