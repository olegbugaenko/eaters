import { createArcDefinition } from "../../modules/scene/arc/arc.factory";
import { createAudioDefinition } from "../../modules/shared/audio/audio.factory";
import { createBonusesDefinition } from "../../modules/shared/bonuses/bonuses.factory";
import { createBricksDefinition } from "../../modules/active-map/bricks/bricks.factory";
import { createTargetingDefinition } from "../../modules/active-map/targeting/targeting.factory";
import { createEnemiesDefinition } from "../../modules/active-map/enemies/enemies.factory";
import { createBuildingsDefinition } from "../../modules/camp/buildings/buildings.factory";
import { createBulletDefinition } from "../../modules/active-map/bullet/bullet.factory";
import { createCraftingDefinition } from "../../modules/camp/crafting/crafting.factory";
import { createEffectsDefinition } from "../../modules/scene/effects/effects.factory";
import { createExplosionDefinition } from "../../modules/scene/explosion/explosion.factory";
import { createFireballDefinition } from "../../modules/scene/fireball/fireball.factory";
import { createMapDefinition } from "../../modules/active-map/map/map.factory";
import { createNecromancerDefinition } from "../../modules/active-map/necromancer/necromancer.factory";
import { createPlayerUnitsDefinition } from "../../modules/active-map/player-units/player-units.factory";
import { createResourcesDefinition } from "../../modules/shared/resources/resources.factory";
import { createSkillTreeDefinition } from "../../modules/camp/skill-tree/skill-tree.factory";
import { createSpellcastingDefinition } from "../../modules/active-map/spellcasting/spellcasting.factory";
import { createStatisticsDefinition } from "../../modules/shared/statistics/statistics.factory";
import { createTimeDefinition } from "../../modules/shared/time/time.factory";
import { createTutorialMonitorDefinition } from "../../modules/active-map/tutorial-monitor/tutorial-monitor.factory";
import { createUnitAutomationDefinition } from "../../modules/active-map/unit-automation/unit-automation.factory";
import { createUnitDesignDefinition } from "../../modules/camp/unit-design/unit-design.factory";
import { createUnitModuleWorkshopDefinition } from "../../modules/camp/unit-module-workshop/unit-module-workshop.factory";
import { createUnitProjectilesDefinition } from "../../modules/active-map/projectiles/projectiles.factory";
import { createUnlocksDefinition } from "./unlocks/factory";
import { ModuleDefinitionContext } from "./context";
export function createModuleDefinitions(context: ModuleDefinitionContext) {
  return [
    createUnlocksDefinition(),
    createBonusesDefinition(),
    createStatisticsDefinition(),
    createResourcesDefinition(),
    createSkillTreeDefinition(),
    createCraftingDefinition(),
    createBuildingsDefinition(),
    createUnitModuleWorkshopDefinition(),
    createUnitDesignDefinition(),
    createTimeDefinition(),
    createExplosionDefinition(),
    createAudioDefinition(),
    createTargetingDefinition(),
    createEnemiesDefinition(),
    createBricksDefinition(),
    createUnitProjectilesDefinition(),
    createPlayerUnitsDefinition(context),
    createNecromancerDefinition(),
    createUnitAutomationDefinition(),
    createArcDefinition(),
    createEffectsDefinition(),
    createFireballDefinition(),
    createBulletDefinition(),
    createMapDefinition(context),
    createSpellcastingDefinition(),
    createTutorialMonitorDefinition(),
  ] as const;
}
