import { PlayerUnitBlueprintStats } from "../../../../types/player-units";
import { SceneTooltipContent } from "../SceneTooltipPanel";
import { buildUnitStatEntries } from "../../../shared/unitStats";

export const createUnitTooltip = (
  blueprint: PlayerUnitBlueprintStats
): SceneTooltipContent => {
  return {
    title: blueprint.name,
    subtitle: "Includes current bonuses",
    stats: buildUnitStatEntries(blueprint),
    footer: "Hover other elements to inspect their bonuses.",
  };
};
