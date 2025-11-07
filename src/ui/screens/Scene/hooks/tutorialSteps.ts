import { SceneTutorialConfig, SceneTutorialStep } from "../components/overlay/SceneTutorialOverlay";

type TargetResolver = () => Element | null;

const getElementById = (id: string): Element | null => {
  if (typeof document === "undefined") {
    return null;
  }
  return document.getElementById(id);
};

export const buildTutorialSteps = (
  tutorial: SceneTutorialConfig | null,
  getCanvasWrapper: TargetResolver,
): SceneTutorialStep[] => {
  if (!tutorial) {
    return [];
  }

  switch (tutorial.type) {
    case "new-player": {
      const getResourceElement = (resourceId: string) =>
        getElementById(`${resourceId}-resource`);
      const getSummoningUnitList = () => getElementById("summoning-unit-list");
      const getSpellbookArea = () => getElementById("spellbook-area");

      return [
        {
          id: "intro",
          title: "The Hunger Awakens",
          description:
            "A gnawing hunger and furious urge coil within you. Devour the matter strewn across this place.",
        },
        {
          id: "summoning-panel",
          title: "Summoning Rituals",
          description:
            "Call forth your ravenous creations from this panel. They will shatter bricks and feast on the debris.",
          getTarget: getSummoningUnitList,
          highlightPadding: 32,
        },
        {
          id: "spells",
          title: "Spellcasting",
          description:
            "Select a spell from your spellbook, then click on the battlefield to cast it. Spells deal damage directly to bricks and can turn the tide of battle. Hold the mouse button to cast spell continuously as long as you have enough resources.",
          getTarget: getSpellbookArea,
          highlightPadding: 32,
        },
        {
          id: "mana",
          title: "Mana Flows",
          description: "Mana trickles back on its own. Spend it freely to conjure more horrors.",
          getTarget: () => getResourceElement("mana"),
          highlightPadding: 24,
          placement: "top",
        },
        {
          id: "sanity",
          title: "Fading Sanity",
          description: "Sanity never returns. Each summon drags you nearer to the void—use it with intent.",
          getTarget: () => getResourceElement("sanity"),
          highlightPadding: 24,
          placement: "top",
        },
        {
          id: "victory",
          title: "Leave Nothing Behind",
          description:
            "The run ends in triumph when no brick remains. If your sanity breaks and your creatures fall, defeat claims you.",
          getTarget: getCanvasWrapper,
          highlightPadding: 48,
          placement: "center",
        },
      ];
    }
    default:
      return [];
  }
};
