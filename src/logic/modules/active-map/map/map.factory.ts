import { SkillId } from "../../../../db/skills-db";
import { ModuleDefinitionContext } from "../../../../core/logic/engine/module-definitions/context";
import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { SkillTreeModule } from "../../camp/skill-tree/skill-tree.module";
import { MapModule } from "./map.module";
import { MapSceneCleanup } from "./map.scene-cleanup";

export const createMapDefinition = (
  context: ModuleDefinitionContext,
): ServiceDefinition<MapModule, "map"> => ({
  token: "map",
  factory: (container) => {
    const sceneCleanup = new MapSceneCleanup({
      fireball: container.get("fireball"),
      bullet: container.get("bullet"),
      explosion: container.get("explosion"),
      arc: container.get("arc"),
      effects: container.get("effects"),
      sceneObjects: container.get("sceneObjects"),
    });

    return new MapModule({
      scene: container.get("sceneObjects"),
      bridge: container.get("bridge"),
      runState: container.get("mapRunState"),
      bonuses: container.get("bonuses"),
      bricks: container.get("bricks"),
      playerUnits: container.get("playerUnits"),
      enemies: container.get("enemies"),
      necromancer: container.get("necromancer"),
      resources: container.get("resources"),
      unlocks: container.get("unlocks"),
      achievements: container.get("achievements"),
      eventLog: container.get("eventLog"),
      unitsAutomation: container.get("unitAutomation"),
      arcs: container.get("arc"),
      sceneCleanup,
      getSkillLevel: (id: SkillId) => container.get<SkillTreeModule>("skillTree").getLevel(id),
    });
  },
  registerAsModule: true,
  dependsOn: [
    "fireball",
    "bullet",
    "explosion",
    "arc",
    "effects",
    "bonuses",
    "bricks",
    "playerUnits",
    "enemies",
    "necromancer",
    "resources",
    "unlocks",
    "achievements",
    "eventLog",
    "unitAutomation",
    "skillTree",
  ],
  onReady: (instance: MapModule) => {
    context.setMapModule(instance);
  },
});
