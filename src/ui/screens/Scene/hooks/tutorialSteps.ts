import { SceneTutorialConfig, SceneTutorialStep } from "../components/overlay/SceneTutorialOverlay";

export interface SceneTutorialActions {
  summonBlueVanguard?: () => void;
}

export interface SceneTutorialLocks {
  playStepLocked?: boolean;
}

type TargetResolver = () => HTMLElement | null;
type TranslateFn = (key: string, fallback: string) => string;

const getElementById = (id: string): HTMLElement | null => {
  if (typeof document === "undefined") {
    return null;
  }
  return document.getElementById(id);
};

export const buildTutorialSteps = (
  tutorial: SceneTutorialConfig | null,
  getCanvasWrapper: TargetResolver,
  t: TranslateFn,
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
      const getMagicArrowSpell = () => getElementById("spell-option-magic-arrow");

      return [
        {
          id: "intro",
          title: t("scene.tutorial.step.intro.title", "Welcome"),
          description: t(
            "scene.tutorial.step.intro.description",
            "Your goal is simple: smash as many bricks as possible before your sanity runs out. Sanity is your mental stamina—it drains over time, so start breaking immediately.",
          ),
          getTarget: () => getResourceElement("sanity"),
          highlightPadding: 32,
          placement: "top",
        },
        {
          id: "summon-blue-vanguard",
          title: t("scene.tutorial.step.summonBlueVanguard.title", "First Summon"),
          description: t(
            "scene.tutorial.step.summonBlueVanguard.description",
            "Spawn as many creatures as you can by spamming Blue Vanguard. When you run out of mana or your sanity drops after cracking a few bricks, we’ll pause and continue.",
          ),
          getTarget: getBlueVanguardCard,
          highlightPadding: 32,
          placement: "top",
          requiredAction: "summon-blue-vanguard",
          nextLabel: t(
            "scene.tutorial.step.summonBlueVanguard.nextLabel",
            "Summon Blue Vanguard",
          ),
          lockMessage: t(
            "scene.tutorial.step.summonBlueVanguard.lockMessage",
            "Spend your mana on summons and break a few bricks to continue",
          ),
          allowGameplay: true,
          blockOutsideClicks: true,
          isLocked: locks?.playStepLocked ?? false,
        },
        {
          id: "mana",
          title: t("scene.tutorial.step.mana.title", "Mana for Rituals"),
          description: t(
            "scene.tutorial.step.mana.description",
            "Mana fuels both summons and spells. It regenerates on its own—spend it freely to break more bricks before sanity fades.",
          ),
          getTarget: () => getResourceElement("mana"),
          highlightPadding: 24,
          placement: "top",
        },
        {
          id: "cast-magic-arrow",
          title: t("scene.tutorial.step.castMagicArrow.title", "Spellcasting"),
          description: t(
            "scene.tutorial.step.castMagicArrow.description",
            "Spells are another way to destroy bricks. You can select one of the available spells from the list. Then clicking on the map will cast the spell at that location.",
          ),
          getTarget: getMagicArrowSpell,
          highlightPadding: 32,
          placement: "top",
          requiredAction: "cast-magic-arrow",
          nextLabel: t("scene.tutorial.step.castMagicArrow.nextLabel", "Cast Magic Arrow"),
          lockMessage: t(
            "scene.tutorial.step.castMagicArrow.lockMessage",
            "Select Magic Arrow and click on the map to cast it",
          ),
          allowGameplay: false,
          blockOutsideClicks: false,
          isLocked: locks?.playStepLocked ?? false,
        },
        {
          id: "progress",
          title: t("scene.tutorial.step.progress.title", "Don't Fear Failure"),
          description: t(
            "scene.tutorial.step.progress.description",
            "If you can't shatter every brick, that's fine. Every brick you destroy drops resources—use them to return stronger next time.",
          ),
          getTarget: getCanvasWrapper,
          highlightPadding: 48,
          placement: "center",
          allowGameplay: false,
        },
      ];
    }
    default:
      return [];
  }  
};
