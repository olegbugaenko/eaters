import { MutableRefObject, useCallback, useEffect, useMemo, useState } from "react";
import {
  SceneTutorialAction,
  SceneTutorialConfig,
  SceneTutorialStep,
} from "../components/overlay/SceneTutorialOverlay";
import { buildTutorialSteps, SceneTutorialActions } from "./tutorialSteps";

interface UseSceneTutorialParams {
  tutorial: SceneTutorialConfig | null;
  wrapperRef: MutableRefObject<HTMLDivElement | null>;
  onTutorialComplete?: () => void;
  actions?: SceneTutorialActions;
}

export const useSceneTutorial = ({
  tutorial,
  wrapperRef,
  onTutorialComplete,
  actions,
}: UseSceneTutorialParams) => {
  const tutorialSteps = useMemo<SceneTutorialStep[]>(
    () => buildTutorialSteps(tutorial, () => wrapperRef.current, actions),
    [actions, tutorial, wrapperRef],
  );

  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [completedActions, setCompletedActions] = useState<Set<SceneTutorialAction>>(new Set());

  const resolvedSteps = useMemo<SceneTutorialStep[]>(() => {
    if (tutorialSteps.length === 0) {
      return [];
    }
    return tutorialSteps.map((step) => {
      const isLocked = step.requiredAction ? !completedActions.has(step.requiredAction) : false;
      return { ...step, isLocked };
    });
  }, [completedActions, tutorialSteps]);

  const showTutorial = resolvedSteps.length > 0;

  useEffect(() => {
    setTutorialStepIndex(0);
    setCompletedActions(new Set());
  }, [tutorial, tutorialSteps.length]);

  useEffect(() => {
    const currentStep = resolvedSteps[tutorialStepIndex];
    if (!currentStep) {
      return;
    }
    if (currentStep.requiredAction && !currentStep.isLocked) {
      const nextIndex = Math.min(tutorialStepIndex + 1, resolvedSteps.length - 1);
      if (nextIndex !== tutorialStepIndex) {
        setTutorialStepIndex(nextIndex);
      }
    }
  }, [resolvedSteps, tutorialStepIndex]);

  const handleTutorialAdvance = useCallback(
    (nextIndex: number) => {
      if (resolvedSteps.length === 0) {
        return;
      }
      const currentStep = resolvedSteps[tutorialStepIndex];
      if (currentStep?.isLocked && nextIndex > tutorialStepIndex) {
        return;
      }
      const clampedIndex = Math.max(0, Math.min(nextIndex, resolvedSteps.length - 1));
      setTutorialStepIndex(clampedIndex);
    },
    [resolvedSteps, tutorialStepIndex],
  );

  const handleTutorialClose = useCallback(() => {
    setTutorialStepIndex(0);
    onTutorialComplete?.();
  }, [onTutorialComplete]);

  const registerTutorialAction = useCallback((action: SceneTutorialAction) => {
    setCompletedActions((prev) => {
      if (prev.has(action)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(action);
      return next;
    });
  }, []);

  return {
    tutorialSteps: resolvedSteps,
    tutorialStepIndex,
    showTutorial,
    handleTutorialAdvance,
    handleTutorialClose,
    registerTutorialAction,
  } as const;
};
