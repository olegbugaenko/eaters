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
      const getBlueVanguardCard = () => getElementById("summon-option-bluePentagon");

      return [
        {
          id: "intro",
          title: "Welcome",
          description:
            "Your goal is simple: smash as many bricks as possible before your sanity runs out. Sanity is your mental stamina—it drains over time, so start breaking immediately.",
          getTarget: getCanvasWrapper,
          highlightPadding: 48,
          placement: "center",
        },
        {
          id: "summon-blue-vanguard",
          title: "First Summon",
          description:
            "Click the “Blue Vanguard” card to launch your first unit. We’ll remember this interaction for future runs, so do it now.",
          getTarget: getBlueVanguardCard,
          highlightPadding: 32,
          requiredAction: "summon-blue-vanguard",
          nextLabel: "Summon Blue Vanguard",
          lockMessage: "Click Blue Vanguard to continue",
        },
        {
          id: "mana",
          title: "Mana for Rituals",
          description:
            "Mana fuels both summons and spells. It regenerates on its own—spend it freely to break more bricks before sanity fades.",
          getTarget: () => getResourceElement("mana"),
          highlightPadding: 24,
          placement: "top",
        },
        {
          id: "progress",
          title: "Don’t Fear Failure",
          description:
            "If you can’t shatter every brick, that’s fine. Every brick you destroy drops resources—use them to return stronger next time.",
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
