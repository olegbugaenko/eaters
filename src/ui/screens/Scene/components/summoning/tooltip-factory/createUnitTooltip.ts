import { PlayerUnitBlueprintStats } from "@shared/types/player-units";
import { SceneTooltipContent } from "../../tooltip/SceneTooltipPanel";
import { buildUnitStatEntries, UnitStatsTranslator } from "@ui-shared/unitStats";

export const createUnitTooltip = (
  blueprint: PlayerUnitBlueprintStats,
  hasMultipleUnits?: boolean,
  t?: UnitStatsTranslator
): SceneTooltipContent => {
  const translate: UnitStatsTranslator = t ?? ((_, fallback) => fallback);

  return {
    title: blueprint.name,
    subtitle: translate("scene.summoning.unitTooltip.subtitle", "Includes current bonuses"),
    stats: buildUnitStatEntries(blueprint, t),
    ...(hasMultipleUnits && {
      footer: translate(
        "scene.summoning.unitTooltip.footer",
        "Hover other elements to inspect their bonuses."
      ),
    }),
  };
};
