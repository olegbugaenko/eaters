import { SkillId } from "../../../../db/skills-db";
import { ModuleDefinitionContext } from "../../../definitions/modules/context";
import { ServiceDefinition } from "../../../core/loader/types";
import { SkillTreeModule } from "../../camp/skill-tree/skill-tree.module";
import { MapModule } from "./map.module";

export const createMapDefinition = (
  context: ModuleDefinitionContext,
): ServiceDefinition<MapModule, "map"> => ({
  token: "map",
  factory: (container) =>
    new MapModule({
      scene: container.get("sceneObjects"),
      bridge: container.get("bridge"),
      runState: container.get("mapRunState"),
      bonuses: container.get("bonuses"),
      bricks: container.get("bricks"),
      playerUnits: container.get("playerUnits"),
      necromancer: container.get("necromancer"),
      resources: container.get("resources"),
      unlocks: container.get("unlocks"),
      unitsAutomation: container.get("unitAutomation"),
      arcs: container.get("arc"),
      getSkillLevel: (id: SkillId) => container.get<SkillTreeModule>("skillTree").getLevel(id),
    }),
  registerAsModule: true,
  onReady: (instance: MapModule) => {
    context.setMapModule(instance);
  },
});
