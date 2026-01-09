import { ModuleRegistry } from "@/core/logic/engine/ModuleRegistry";
import { createArcDefinition } from "../../../../logic/modules/scene/arc/arc.factory";
import { createAudioDefinition } from "../../../../logic/modules/shared/audio/audio.factory";
import { createBonusesDefinition } from "../../../../logic/modules/shared/bonuses/bonuses.factory";
import { createAchievementsDefinition } from "../../../../logic/modules/shared/achievements/achievements.factory";
import { createBricksDefinition } from "../../../../logic/modules/active-map/bricks/bricks.factory";
import { createTargetingDefinition } from "../../../../logic/modules/active-map/targeting/targeting.factory";
import { createDamageDefinition } from "../../../../logic/modules/active-map/targeting/damage.factory";
import { createEnemiesDefinition } from "../../../../logic/modules/active-map/enemies/enemies.factory";
import { createBuildingsDefinition } from "../../../../logic/modules/camp/buildings/buildings.factory";
import { createBulletDefinition } from "../../../../logic/modules/active-map/bullet/bullet.factory";
import { createCraftingDefinition } from "../../../../logic/modules/camp/crafting/crafting.factory";
import { createEffectsDefinition } from "../../../../logic/modules/scene/effects/effects.factory";
import { createExplosionDefinition } from "../../../../logic/modules/scene/explosion/explosion.factory";
import { createFireballDefinition } from "../../../../logic/modules/scene/fireball/fireball.factory";
import { createMapDefinition } from "../../../../logic/modules/active-map/map/map.factory";
import { createNecromancerDefinition } from "../../../../logic/modules/active-map/necromancer/necromancer.factory";
import { createPlayerUnitsDefinition } from "../../../../logic/modules/active-map/player-units/player-units.factory";
import { createResourcesDefinition } from "../../../../logic/modules/shared/resources/resources.factory";
import { createSkillTreeDefinition } from "../../../../logic/modules/camp/skill-tree/skill-tree.factory";
import { createSpellcastingDefinition } from "../../../../logic/modules/active-map/spellcasting/spellcasting.factory";
import { createStatisticsDefinition } from "../../../../logic/modules/shared/statistics/statistics.factory";
import { createTimeDefinition } from "../../../../logic/modules/shared/time/time.factory";
import { createStatusEffectsDefinition } from "../../../../logic/modules/active-map/status-effects/status-effects.factory";
import { createTutorialMonitorDefinition } from "../../../../logic/modules/active-map/tutorial-monitor/tutorial-monitor.factory";
import { createUnitAutomationDefinition } from "../../../../logic/modules/active-map/unit-automation/unit-automation.factory";
import { createUnitDesignDefinition } from "../../../../logic/modules/camp/unit-design/unit-design.factory";
import { createUnitModuleWorkshopDefinition } from "../../../../logic/modules/camp/unit-module-workshop/unit-module-workshop.factory";
import { createUnitProjectilesDefinition } from "../../../../logic/modules/active-map/projectiles/projectiles.factory";
import { createUnlocksDefinition } from "../../../../logic/definitions/modules/unlocks/factory";
import { ModuleDefinitionContext } from "./context";

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
    createSkillTreeDefinition(),
    createCraftingDefinition(),
    createBuildingsDefinition(),
    createUnitModuleWorkshopDefinition(),
    createUnitDesignDefinition(),
    createTimeDefinition(),
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
