import { SkillId } from "../../../../db/skills-db";
import { ServiceDefinition } from "../../../core/loader/types";
import { SkillTreeModule } from "../skill-tree/skill-tree.module";
import { BuildingsModule } from "./buildings.module";

export const createBuildingsDefinition = (): ServiceDefinition<BuildingsModule, "buildings"> => ({
  token: "buildings",
  factory: (container) =>
    new BuildingsModule({
      bridge: container.get("bridge"),
      resources: container.get("resources"),
      bonuses: container.get("bonuses"),
      unlocks: container.get("unlocks"),
      getSkillLevel: (id: SkillId) => container.get<SkillTreeModule>("skillTree").getLevel(id),
    }),
  registerAsModule: true,
});
