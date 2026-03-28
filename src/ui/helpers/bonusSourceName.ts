import { DARK_RESEARCH_IDS, getDarkResearchConfig } from "@db/dark-research-db";
import { getAchievementConfig } from "@db/achievements-db";
import { getBuildingConfig } from "@db/buildings-db";
import { getSkillConfig } from "@db/skills-db";
import type { AchievementId } from "@db/achievements-db";
import type { BuildingId } from "@db/buildings-db";
import type { SkillId } from "@db/skills-db";
import type { LocalizationService } from "@logic/services/localization/LocalizationService";

/**
 * Creates a resolver that maps bonus source IDs to localized display names.
 * Source ID patterns: dark_research_*, skill_*, building_*, achievement_*, map_*
 */
export function createBonusSourceNameResolver(
  localization: Pick<
    LocalizationService,
    "tUi" | "getSkillText" | "getBuildingText" | "getMapName"
  >
): (sourceId: string) => string {
  const t = (key: string, fallback: string) => localization.tUi(key, fallback);

  return (sourceId: string): string => {
    if (sourceId.startsWith("dark_research_")) {
      const id = sourceId.slice("dark_research_".length);
      if (DARK_RESEARCH_IDS.includes(id as any)) {
        return t(`voidCamp.darkResearch.researches.${id}.name`, getDarkResearchConfig(id as any).name);
      }
    }
    if (sourceId.startsWith("skill_")) {
      const id = sourceId.slice("skill_".length) as SkillId;
      try {
        const config = getSkillConfig(id);
        const text = localization.getSkillText(id, { name: config.name, description: config.description });
        return text.name;
      } catch {
        return sourceId;
      }
    }
    if (sourceId.startsWith("building_")) {
      const id = sourceId.slice("building_".length) as BuildingId;
      try {
        const config = getBuildingConfig(id);
        const text = localization.getBuildingText(id, { name: config.name, description: config.description });
        return text.name;
      } catch {
        return sourceId;
      }
    }
    if (sourceId.startsWith("achievement_")) {
      const id = sourceId.slice("achievement_".length) as AchievementId;
      try {
        const config = getAchievementConfig(id);
        return t(`voidCamp.achievements.${id}.name`, config.name);
      } catch {
        return sourceId;
      }
    }
    if (sourceId.startsWith("map_")) {
      const mapId = sourceId.slice("map_".length);
      return localization.getMapName(mapId as any, sourceId.replace(/_/g, " "));
    }
    return sourceId;
  };
}
