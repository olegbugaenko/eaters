import { createArcDefinition } from "../../modules/scene/arc/arc.factory";
import { createAudioDefinition } from "../../modules/shared/audio/audio.factory";
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
import { createStatusEffectsDefinition } from "../../modules/active-map/status-effects/status-effects.factory";
import { createTutorialMonitorDefinition } from "../../modules/active-map/tutorial-monitor/tutorial-monitor.factory";
import { createUnitAutomationDefinition } from "../../modules/active-map/unit-automation/unit-automation.factory";
import { createUnitDesignDefinition } from "../../modules/camp/unit-design/unit-design.factory";
import { createUnitModuleWorkshopDefinition } from "../../modules/camp/unit-module-workshop/unit-module-workshop.factory";
import { createUnitProjectilesDefinition } from "../../modules/active-map/projectiles/projectiles.factory";
import { createUnlocksDefinition } from "./unlocks/factory";
import { ModuleDefinitionContext } from "./context";
import type { ServiceDefinition } from "../../core/loader/types";

function sortModuleDefinitions<Definitions extends readonly ServiceDefinition<any, string, any>[]>(
  definitions: Definitions,
): Definitions {
  const definitionMap = new Map(
    definitions.map((definition, index) => [definition.token, { definition, index }] as const),
  );
  const inDegree = new Map<string, number>();
  const edges = new Map<string, string[]>();

  definitions.forEach((definition) => {
    inDegree.set(definition.token, 0);
    edges.set(definition.token, []);
  });

  definitions.forEach((definition) => {
    definition.dependsOn?.forEach((dependency) => {
      if (!definitionMap.has(dependency)) {
        throw new Error(`Unknown module dependency token: ${dependency}`);
      }
      edges.get(dependency)?.push(definition.token);
      inDegree.set(definition.token, (inDegree.get(definition.token) ?? 0) + 1);
    });
  });

  const queue = definitions
    .filter((definition) => inDegree.get(definition.token) === 0)
    .map((definition) => definition.token);
  const sorted: typeof definitions[number][] = [];

  while (queue.length > 0) {
    queue.sort((left, right) => (definitionMap.get(left)?.index ?? 0) - (definitionMap.get(right)?.index ?? 0));
    const token = queue.shift();
    if (!token) {
      break;
    }
    const entry = definitionMap.get(token);
    if (entry) {
      sorted.push(entry.definition);
    }
    edges.get(token)?.forEach((next) => {
      const nextCount = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, nextCount);
      if (nextCount === 0) {
        queue.push(next);
      }
    });
  }

  if (sorted.length !== definitions.length) {
    const remaining = definitions
      .map((definition) => definition.token)
      .filter((token) => (inDegree.get(token) ?? 0) > 0);
    throw new Error(`Cyclic module dependencies detected: ${remaining.join(", ")}`);
  }

  return sorted as unknown as Definitions;
}

export function createModuleDefinitions(context: ModuleDefinitionContext) {
  const definitions = [
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
  ] as const;

  return sortModuleDefinitions(definitions);
}
