import { createArcDefinition } from "../../modules/arc/arc.factory";
import { createAudioDefinition } from "../../modules/audio/audio.factory";
import { createBonusesDefinition } from "../../modules/bonuses/bonuses.factory";
import { createBricksDefinition } from "../../modules/bricks/bricks.factory";
import { createBuildingsDefinition } from "../../modules/buildings/buildings.factory";
import { createBulletDefinition } from "../../modules/bullet/bullet.factory";
import { createCraftingDefinition } from "../../modules/crafting/crafting.factory";
import { createEffectsDefinition } from "../../modules/effects/effects.factory";
import { createExplosionDefinition } from "../../modules/explosion/explosion.factory";
import { createFireballDefinition } from "../../modules/fireball/fireball.factory";
import { createMapDefinition } from "../../modules/map/map.factory";
import { createNecromancerDefinition } from "../../modules/necromancer/necromancer.factory";
import { createPlayerUnitsDefinition } from "../../modules/player-units/player-units.factory";
import { createResourcesDefinition } from "../../modules/resources/resources.factory";
import { createSkillTreeDefinition } from "../../modules/skill-tree/skill-tree.factory";
import { createSpellcastingDefinition } from "../../modules/spellcasting/spellcasting.factory";
import { createStatisticsDefinition } from "../../modules/statistics/statistics.factory";
import { createTimeDefinition } from "../../modules/time/time.factory";
import { createTutorialMonitorDefinition } from "../../modules/tutorial-monitor/tutorial-monitor.factory";
import { createUnitAutomationDefinition } from "../../modules/unit-automation/unit-automation.factory";
import { createUnitDesignDefinition } from "../../modules/unit-design/unit-design.factory";
import { createUnitModuleWorkshopDefinition } from "../../modules/unit-module-workshop/unit-module-workshop.factory";
import { createUnlocksDefinition } from "./unlocks/factory";
import { ModuleDefinitionContext } from "./context";
import { ServiceDefinition } from "../../core/loader/types";

export function createModuleDefinitions(context: ModuleDefinitionContext): ServiceDefinition<unknown>[] {
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
    createBricksDefinition(context),
    createPlayerUnitsDefinition(context),
    createNecromancerDefinition(context),
    createUnitAutomationDefinition(),
    createArcDefinition(),
    createEffectsDefinition(),
    createFireballDefinition(),
    createMapDefinition(context),
    createBulletDefinition(),
    createSpellcastingDefinition(),
    createTutorialMonitorDefinition(),
  ] as ServiceDefinition<unknown>[];
}
