import { SkillId } from "../../../db/skills-db";
import { ServiceDefinition } from "../../core/loader/types";
import { MapModule } from "../map/map.module";
import { PlayerUnitsModule } from "../player-units/player-units.module";
import { SkillTreeModule } from "../skill-tree/skill-tree.module";
import { UnitAutomationModule } from "./unit-automation.module";

export const createUnitAutomationDefinition = (): ServiceDefinition<UnitAutomationModule> => ({
  token: "unitAutomation",
  factory: (container) =>
    new UnitAutomationModule({
      bridge: container.get("bridge"),
      necromancer: container.get("necromancer"),
      unitDesigns: container.get("unitDesign"),
      getUnitCountByDesignId: (designId: string) =>
        container.get<PlayerUnitsModule>("playerUnits").getUnitCountByDesignId(designId),
      getSkillLevel: (id: SkillId) => container.get<SkillTreeModule>("skillTree").getLevel(id),
      runState: container.get("mapRunState"),
      isRunActive: () => container.get<MapModule>("map")?.isRunActive() ?? false,
    }),
  registerAsModule: true,
});
