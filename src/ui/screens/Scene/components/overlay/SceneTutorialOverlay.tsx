import { memo, useCallback, useMemo } from "react";
import {
  TutorialOverlay,
  TutorialOverlayPlacement,
  TutorialStep,
} from "../../../../shared/libs/TutorialOverlay";
import "./SceneTutorialOverlay.css";

export interface SceneTutorialConfig {
  readonly type: "new-player";
}

export type SceneTutorialAction = "summon-blue-vanguard";

export interface SceneTutorialStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly getTarget?: () => HTMLElement | null;
  readonly highlightPadding?: number;
  readonly placement?: TutorialOverlayPlacement;
  readonly requiredAction?: SceneTutorialAction;
  readonly nextLabel?: string;
  readonly lockMessage?: string;
  readonly isLocked?: boolean;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly allowGameplay?: boolean;
  readonly blockOutsideClicks?: boolean;
  readonly backDisabled?: boolean;
}

interface SceneTutorialOverlayProps {
  readonly steps: readonly SceneTutorialStep[];
  readonly activeIndex: number;
  readonly onAdvance: (nextIndex: number) => void;
  readonly onClose: () => void;
}

const HIGHLIGHT_PADDING_DEFAULT = 16;

const SceneTutorialOverlayInner: React.FC<SceneTutorialOverlayProps> = ({
  steps,
  activeIndex,
  onAdvance,
  onClose,
}) => {
  const tutorialSteps = useMemo<TutorialStep[]>(() => {
    if (steps.length === 0) return [];

    return steps.map((step, index) => {
      const targetResolver = step.getTarget ?? (() => document.body);
      const hasTarget = Boolean(step.getTarget?.());
      const prevStepRequiresAction = index > 0 ? Boolean(steps[index - 1]?.requiredAction) : false;

      const content = (
        <div className="scene-tutorial-overlay__content">
          <p className="scene-tutorial-overlay__description">{step.description}</p>
          {step.actionLabel && (
            <button
              type="button"
              className="button primary-button scene-tutorial-overlay__cta"
              onClick={() => step.onAction?.()}
            >
              {step.actionLabel}
            </button>
          )}
          {step.isLocked && step.lockMessage && (
            <p className="scene-tutorial-overlay__lock">{step.lockMessage}</p>
          )}
        </div>
      );

      return {
        id: step.id,
        target: targetResolver,
        title: step.title,
        content,
        placement: step.placement ?? (hasTarget ? "bottom" : "center"),
        padding: step.highlightPadding ?? HIGHLIGHT_PADDING_DEFAULT,
        radius: 12,
        allowSpotlightClicks: true,
        nextLabel: step.nextLabel,
        nextDisabled: step.isLocked,
        backDisabled: step.backDisabled ?? prevStepRequiresAction,
        footer: (
          <div className="scene-tutorial-overlay__progress">
            Step {index + 1} of {steps.length}
          </div>
        ),
      } satisfies TutorialStep;
    });
  }, [steps]);

  const handleStepIndexChange = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(nextIndex, tutorialSteps.length - 1));
      onAdvance(clamped);
    },
    [onAdvance, tutorialSteps.length],
  );

  const activeStep = steps[activeIndex];

  if (tutorialSteps.length === 0) return null;

  return (
    <TutorialOverlay
      steps={tutorialSteps}
      run={activeIndex < tutorialSteps.length}
      stepIndex={activeIndex}
      onStepIndexChange={handleStepIndexChange}
      onClose={onClose}
      scrollIntoView
      zIndex={60}
      dimColor="rgba(8, 12, 20, 0.78)"
      tooltipClassName="scene-tutorial-overlay__tooltip"
      blockOutsideClicks={activeStep?.blockOutsideClicks ?? true}
      closeOnOutsideClick={false}
    />
  );
};

const propsAreEqual = (
  prev: SceneTutorialOverlayProps,
  next: SceneTutorialOverlayProps
): boolean => {
  return (
    prev.steps === next.steps &&
    prev.activeIndex === next.activeIndex &&
    prev.onAdvance === next.onAdvance &&
    prev.onClose === next.onClose
  );
};

export const SceneTutorialOverlay = memo(SceneTutorialOverlayInner, propsAreEqual);
