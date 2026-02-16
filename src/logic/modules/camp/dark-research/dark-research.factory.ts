import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { SkillId } from "@/db/skills-db";
import { SkillTreeModule } from "../skill-tree/skill-tree.module";
import { DarkResearchModule } from "./dark-research.module";

export const createDarkResearchDefinition = (): ServiceDefinition<DarkResearchModule, "darkResearch"> => ({
  token: "darkResearch",
  factory: (container) =>
    new DarkResearchModule({
      bridge: container.get("bridge"),
      bonuses: container.get("bonuses"),
      newUnlocks: container.get("newUnlocks"),
      getSkillLevel: (id: SkillId) => container.get<SkillTreeModule>("skillTree").getLevel(id),
    }),
  registerAsModule: true,
  dependsOn: ["bonuses", "newUnlocks", "skillTree"],
});
