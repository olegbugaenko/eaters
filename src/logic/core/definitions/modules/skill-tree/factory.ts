import { SkillTreeModule } from "../../../../modules/camp/SkillTreeModule";
import { ServiceDefinition } from "../../types";

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
