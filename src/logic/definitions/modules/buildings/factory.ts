import { SkillId } from "../../../../db/skills-db";
import { BuildingsModule } from "../../../modules/camp/BuildingsModule";
import { SkillTreeModule } from "../../../modules/camp/SkillTreeModule";
import { ServiceDefinition } from "../../../core/loader/types";

export const createBuildingsDefinition = (): ServiceDefinition<BuildingsModule> => ({
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
