import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { SkillTreeModule } from "./skill-tree.module";

export const createSkillTreeDefinition = (): ServiceDefinition<SkillTreeModule, "skillTree"> => ({
  token: "skillTree",
  factory: (container) =>
    new SkillTreeModule({
      bridge: container.get("bridge"),
      resources: container.get("resources"),
      bonuses: container.get("bonuses"),
      eventLog: container.get("eventLog"),
    }),
  registerAsModule: true,
  dependsOn: ["resources", "bonuses", "eventLog"],
});
