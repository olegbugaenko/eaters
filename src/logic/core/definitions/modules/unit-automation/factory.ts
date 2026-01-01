import { SkillId } from "../../../../../db/skills-db";
import { UnitAutomationModule } from "../../../../modules/active-map/UnitAutomationModule";
import { PlayerUnitsModule } from "../../../../modules/active-map/units/PlayerUnitsModule";
import { SkillTreeModule } from "../../../../modules/camp/SkillTreeModule";
import { MapModule } from "../../../../modules/active-map/MapModule";
import { ServiceDefinition } from "../../types";

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
