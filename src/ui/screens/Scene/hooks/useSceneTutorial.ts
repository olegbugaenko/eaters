import { MutableRefObject, useCallback, useEffect, useMemo, useState } from "react";
import { SceneTutorialConfig, SceneTutorialStep } from "../components/overlay/SceneTutorialOverlay";
import { buildTutorialSteps } from "./tutorialSteps";

interface UseSceneTutorialParams {
  tutorial: SceneTutorialConfig | null;
  wrapperRef: MutableRefObject<HTMLDivElement | null>;
  onTutorialComplete?: () => void;
}

export const useSceneTutorial = ({
  tutorial,
  wrapperRef,
  onTutorialComplete,
}: UseSceneTutorialParams) => {
  const tutorialSteps = useMemo<SceneTutorialStep[]>(
    () => buildTutorialSteps(tutorial, () => wrapperRef.current),
    [tutorial, wrapperRef],
  );

  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const showTutorial = tutorialSteps.length > 0;

  useEffect(() => {
    setTutorialStepIndex(0);
  }, [tutorial, tutorialSteps.length]);

  const handleTutorialAdvance = useCallback(
    (nextIndex: number) => {
      if (tutorialSteps.length === 0) {
        return;
      }
      const clampedIndex = Math.max(0, Math.min(nextIndex, tutorialSteps.length - 1));
      setTutorialStepIndex(clampedIndex);
    },
    [tutorialSteps.length],
  );

  const handleTutorialClose = useCallback(() => {
    setTutorialStepIndex(0);
    onTutorialComplete?.();
  }, [onTutorialComplete]);

  return {
    tutorialSteps,
    tutorialStepIndex,
    showTutorial,
    handleTutorialAdvance,
    handleTutorialClose,
  } as const;
};
