import { SkillId } from "../../../../db/skills-db";
import { UnitModuleWorkshopModule } from "../../../modules/camp/UnitModuleWorkshopModule";
import { SkillTreeModule } from "../../../modules/camp/SkillTreeModule";
import { ServiceDefinition } from "../../../core/loader/types";

export const createUnitModuleWorkshopDefinition = (): ServiceDefinition<UnitModuleWorkshopModule> => ({
  token: "unitModuleWorkshop",
  factory: (container) =>
    new UnitModuleWorkshopModule({
      bridge: container.get("bridge"),
      resources: container.get("resources"),
      getSkillLevel: (id: SkillId) => container.get<SkillTreeModule>("skillTree").getLevel(id),
      unlocks: container.get("unlocks"),
    }),
  registerAsModule: true,
});
