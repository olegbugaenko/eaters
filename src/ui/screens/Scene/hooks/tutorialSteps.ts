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
          title: "Ласкаво просимо",
          description:
            "Твоя ціль — розбити якнайбільше цеглин, поки не згасає саніті. Це ментальний ресурс: він повільно тане сам по собі, тож часу мало — атакуй одразу.",
          getTarget: getCanvasWrapper,
          highlightPadding: 48,
          placement: "center",
        },
        {
          id: "summon-blue-vanguard",
          title: "Перший призив",
          description:
            "Натисни на картку «Blue Vanguard», щоб випустити першу істоту. Ми запам’ятаємо цей клік для майбутніх боїв, тож зроби його зараз.",
          getTarget: getBlueVanguardCard,
          highlightPadding: 32,
          requiredAction: "summon-blue-vanguard",
          nextLabel: "Призови Blue Vanguard",
          lockMessage: "Натисни на Blue Vanguard, щоб продовжити",
        },
        {
          id: "mana",
          title: "Мана для ритуалів",
          description:
            "Мана потрібна для призову істот і застосування магії. Вона регенерується автоматично — не накопичуй її, витрачай, щоб дробити більше цеглин.",
          getTarget: () => getResourceElement("mana"),
          highlightPadding: 24,
          placement: "top",
        },
        {
          id: "progress",
          title: "Не бійся програти",
          description:
            "Якщо не встигнеш розбити всі цеглини — нічого страшного. Кожна зруйнована цегла дає ресурси, з якими ти повернешся сильнішим.",
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
