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
            "A gnawing hunger coils within you. Your purpose is simple: erase all matter from existence. Every shattered brick feeds your cause, granting resources to strengthen your swarm.",
        },
        {
          id: "summoning-panel",
          title: "Summoning Rituals",
          description:
            "Summon your ravenous creations here. They will crash into matter and devour the remains. Beware — your creatures take damage and can perish upon collision. They are fragile now, but you will evolve them into true horrors.",
          getTarget: getSummoningUnitList,
          highlightPadding: 32,
        },
        {
          id: "spells",
          title: "Spellcasting",
          description:
            "Select a spell from your spellbook and click on the battlefield to unleash it. Spells deal direct damage to matter and can shift the tide of battle. Hold the mouse button to channel continuously, as long as your mana lasts.",
          getTarget: getSpellbookArea,
          highlightPadding: 32,
        },
        {
          id: "mana",
          title: "Mana Flows",
          description:
            "Mana slowly regenerates on its own. Spend it freely to conjure more destruction.",
          getTarget: () => getResourceElement("mana"),
          highlightPadding: 24,
          placement: "top",
        },
        {
          id: "sanity",
          title: "Fading Sanity",
          description:
            "Sanity never returns. Each summon pulls you deeper into the void — use it wisely.",
          getTarget: () => getResourceElement("sanity"),
          highlightPadding: 24,
          placement: "top",
        },
        {
          id: "progress",
          title: "Growth Through Destruction",
          description:
            "You don’t need to clear the map in one run. Every brick you destroy grants resources, whether you win or fall. Use them to evolve your army, unlock new powers, and return stronger. Progress is eternal — each run builds upon the last.",
          getTarget: getCanvasWrapper,
          highlightPadding: 48,
          placement: "center",
        },
        {
          id: "victory",
          title: "Leave Nothing Behind",
          description:
            "Triumph comes when no brick remains. Should your sanity fade and your creatures fall, defeat will claim you — yet even in failure, your hunger grows. Every run brings you closer to total annihilation.",
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
