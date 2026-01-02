import { SkillId } from "../../../db/skills-db";
import { ModuleDefinitionContext } from "../../definitions/modules/context";
import { ServiceDefinition } from "../../core/loader/types";
import { SkillTreeModule } from "../skill-tree/skill-tree.module";
import { UnitDesignModule } from "../unit-design/unit-design.module";
import { UnitModuleWorkshopModule } from "../unit-module-workshop/unit-module-workshop.module";
import { PlayerUnitsModule } from "./player-units.module";

export const createPlayerUnitsDefinition = (
  context: ModuleDefinitionContext,
): ServiceDefinition<PlayerUnitsModule> => ({
  token: "playerUnits",
  factory: (container) =>
    new PlayerUnitsModule({
      scene: container.get("sceneObjects"),
      bricks: container.get("bricks"),
      bridge: container.get("bridge"),
      movement: container.get("movement"),
      bonuses: container.get("bonuses"),
      explosions: container.get("explosion"),
      runState: container.get("mapRunState"),
      arcs: undefined,
      effects: undefined,
      audio: container.get("audio"),
      fireballs: undefined,
      unitDesign: container.get("unitDesign"),
      onAllUnitsDefeated: () => {
        context.onAllUnitsDefeated();
      },
      getModuleLevel: (id) =>
        container.get<UnitModuleWorkshopModule>("unitModuleWorkshop").getModuleLevel(id),
      hasSkill: (id: SkillId) => container.get<SkillTreeModule>("skillTree").getLevel(id) > 0,
      getDesignTargetingMode: (designId, type) =>
        container.get<UnitDesignModule>("unitDesign").getTargetingModeForDesign(designId, type),
      statistics: container.get("statistics"),
    }),
  registerAsModule: true,
});
