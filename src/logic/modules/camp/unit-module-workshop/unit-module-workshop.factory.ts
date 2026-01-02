import { SkillId } from "../../../../db/skills-db";
import { ServiceDefinition } from "../../../core/loader/types";
import { SkillTreeModule } from "../skill-tree/skill-tree.module";
import { UnitModuleWorkshopModule } from "./unit-module-workshop.module";

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
