import { SkillId } from "../../../../db/skills-db";
import { ModuleDefinitionContext } from "../../../definitions/modules/context";
import { ServiceDefinition } from "../../../core/loader/types";
import { SkillTreeModule } from "../../camp/skill-tree/skill-tree.module";
import { UnitDesignModule } from "../../camp/unit-design/unit-design.module";
import { UnitModuleWorkshopModule } from "../../camp/unit-module-workshop/unit-module-workshop.module";
import { PlayerUnitsModule } from "./player-units.module";
import type { DamageService } from "../targeting/DamageService";
import type { EnemiesModule } from "../enemies/enemies.module";

export const createPlayerUnitsDefinition = (
  context: ModuleDefinitionContext,
): ServiceDefinition<PlayerUnitsModule, "playerUnits"> => ({
  token: "playerUnits",
  factory: (container) =>
    new PlayerUnitsModule({
      scene: container.get("sceneObjects"),
      bricks: container.get("bricks"),
      bridge: container.get("bridge"),
      movement: container.get("movement"),
      bonuses: container.get("bonuses"),
      explosions: container.get("explosion"),
      statusEffects: container.get("statusEffects"),
      projectiles: container.get("unitProjectiles"),
      targeting: container.get("targeting"),
      damage: container.get("damage"),
      enemies: container.get("enemies"),
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
  dependsOn: [
    "bricks",
    "bonuses",
    "explosion",
    "statusEffects",
    "unitProjectiles",
    "targeting",
    "damage",
    "enemies",
    "unitDesign",
    "unitModuleWorkshop",
    "skillTree",
    "statistics",
  ],
});
