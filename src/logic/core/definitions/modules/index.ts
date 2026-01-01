import { createAudioDefinition } from "./audio/factory";
import { createBonusesDefinition } from "./bonuses/factory";
import { createBricksDefinition } from "./bricks/factory";
import { createBuildingsDefinition } from "./buildings/factory";
import { createBulletDefinition } from "./bullet/factory";
import { createCraftingDefinition } from "./crafting/factory";
import { createEffectsDefinition } from "./effects/factory";
import { createExplosionDefinition } from "./explosion/factory";
import { createFireballDefinition } from "./fireball/factory";
import { createArcDefinition } from "./arc/factory";
import { createMapDefinition } from "./map/factory";
import { createNecromancerDefinition } from "./necromancer/factory";
import { createPlayerUnitsDefinition } from "./player-units/factory";
import { createResourcesDefinition } from "./resources/factory";
import { createSkillTreeDefinition } from "./skill-tree/factory";
import { createSpellcastingDefinition } from "./spellcasting/factory";
import { createStatisticsDefinition } from "./statistics/factory";
import { createTimeDefinition } from "./time/factory";
import { createTutorialMonitorDefinition } from "./tutorial-monitor/factory";
import { createUnitAutomationDefinition } from "./unit-automation/factory";
import { createUnitDesignDefinition } from "./unit-design/factory";
import { createUnitModuleWorkshopDefinition } from "./unit-module-workshop/factory";
import { createUnlocksDefinition } from "./unlocks/factory";
import { ModuleDefinitionContext } from "./context";
import { ServiceDefinition } from "../types";

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
