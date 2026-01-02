import { ServiceDefinition } from "../../../core/loader/types";
import { SkillTreeModule } from "./skill-tree.module";

export const createSkillTreeDefinition = (): ServiceDefinition<SkillTreeModule> => ({
  token: "skillTree",
  factory: (container) =>
    new SkillTreeModule({
      bridge: container.get("bridge"),
      resources: container.get("resources"),
      bonuses: container.get("bonuses"),
    }),
  registerAsModule: true,
});
