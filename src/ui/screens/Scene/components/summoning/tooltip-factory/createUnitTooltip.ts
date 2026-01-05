import { PlayerUnitBlueprintStats } from "@shared/types/player-units";
import { SceneTooltipContent } from "../../tooltip/SceneTooltipPanel";
import { buildUnitStatEntries } from "@ui-shared/unitStats";

export const createUnitTooltip = (
  blueprint: PlayerUnitBlueprintStats,
  hasMultipleUnits?: boolean
): SceneTooltipContent => {
  return {
    title: blueprint.name,
    subtitle: "Includes current bonuses",
    stats: buildUnitStatEntries(blueprint),
    ...(hasMultipleUnits && {
      footer: "Hover other elements to inspect their bonuses.",
    }),
  };
};
