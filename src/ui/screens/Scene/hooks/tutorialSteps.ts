import { SceneTutorialConfig, SceneTutorialStep } from "../components/overlay/SceneTutorialOverlay";

export interface SceneTutorialActions {
  summonBlueVanguard?: () => void;
}

export interface SceneTutorialLocks {
  playStepLocked?: boolean;
}

type TargetResolver = () => HTMLElement | null;

const getElementById = (id: string): HTMLElement | null => {
  if (typeof document === "undefined") {
    return null;
  }
  return document.getElementById(id);
};

export const buildTutorialSteps = (
  tutorial: SceneTutorialConfig | null,
  getCanvasWrapper: TargetResolver,
  actions?: SceneTutorialActions,
  locks?: SceneTutorialLocks,
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
          getTarget: () => getResourceElement("sanity"),
          highlightPadding: 32,
          placement: "top",
        },
        {
          id: "summon-blue-vanguard",
          title: "First Summon",
          description:
            "Spawn as many creatures as you can by spamming Blue Vanguard. When you run out of mana or your sanity drops after cracking a brick, we’ll pause and continue.",
          getTarget: getBlueVanguardCard,
          highlightPadding: 32,
          placement: "top",
          requiredAction: "summon-blue-vanguard",
          nextLabel: "Summon Blue Vanguard",
          lockMessage: "Spend your mana on summons and break a brick to continue",
          actionLabel: "Summon Blue Vanguard",
          onAction: actions?.summonBlueVanguard,
          allowGameplay: true,
          blockOutsideClicks: false,
          isLocked: locks?.playStepLocked ?? false,
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
