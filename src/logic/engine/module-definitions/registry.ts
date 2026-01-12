import { ModuleRegistry } from "@/core/logic/engine/ModuleRegistry";
import { createArcDefinition } from "../../modules/scene/arc/arc.factory";
import { createAudioDefinition } from "../../../core/logic/provided/modules/audio/audio.factory";
import { createBonusesDefinition } from "../../modules/shared/bonuses/bonuses.factory";
import { createAchievementsDefinition } from "../../modules/shared/achievements/achievements.factory";
import { createBricksDefinition } from "../../modules/active-map/bricks/bricks.factory";
import { createTargetingDefinition } from "../../modules/active-map/targeting/targeting.factory";
import { createDamageDefinition } from "../../modules/active-map/targeting/damage.factory";
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
import { createEventLogDefinition } from "../../modules/shared/event-log/event-log.factory";
import { createStatusEffectsDefinition } from "../../modules/active-map/status-effects/status-effects.factory";
import { createTutorialMonitorDefinition } from "../../modules/active-map/tutorial-monitor/tutorial-monitor.factory";
import { createUnitAutomationDefinition } from "../../modules/active-map/unit-automation/unit-automation.factory";
import { createUnitDesignDefinition } from "../../modules/camp/unit-design/unit-design.factory";
import { createUnitModuleWorkshopDefinition } from "../../modules/camp/unit-module-workshop/unit-module-workshop.factory";
import { createUnitProjectilesDefinition } from "../../modules/active-map/projectiles/projectiles.factory";
import { createUnlocksDefinition } from "../../definitions/modules/unlocks/factory";
import { ModuleDefinitionContext } from "@/core/logic/engine/module-definitions/context";

export const registerModuleDefinitions = (
  registry: ModuleRegistry,
  context: ModuleDefinitionContext,
): void => {
  registry.registerModules([
    createUnlocksDefinition(),
    createBonusesDefinition(),
    createAchievementsDefinition(),
    createStatisticsDefinition(),
    createResourcesDefinition(),
    createTimeDefinition(),
    createEventLogDefinition(),
    createSkillTreeDefinition(),
    createCraftingDefinition(),
    createBuildingsDefinition(),
    createUnitModuleWorkshopDefinition(),
    createUnitDesignDefinition(),
    createExplosionDefinition(),
    createAudioDefinition(),
    createStatusEffectsDefinition(),
    createTargetingDefinition(),
    createDamageDefinition(),
    createBricksDefinition(),
    createUnitProjectilesDefinition(),
    createEnemiesDefinition(),
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
  ]);
};
