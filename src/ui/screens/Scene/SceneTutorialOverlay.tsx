import { useCallback, useEffect, useMemo, useState } from "react";
import Joyride, {
  ACTIONS,
  CallBackProps,
  EVENTS,
  STATUS,
  Step as JoyrideStep,
  TooltipRenderProps,
} from "react-joyride";
import "./SceneTutorialOverlay.css";

export interface SceneTutorialConfig {
  readonly type: "new-player";
}

export interface SceneTutorialStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly getTarget?: () => Element | null;
  readonly highlightPadding?: number;
}

interface SceneTutorialOverlayProps {
  readonly steps: readonly SceneTutorialStep[];
  readonly activeIndex: number;
  readonly onAdvance: (nextIndex: number) => void;
  readonly onClose: () => void;
}

const HIGHLIGHT_PADDING_DEFAULT = 16;

export const SceneTutorialOverlay: React.FC<SceneTutorialOverlayProps> = ({
  steps,
  activeIndex,
  onAdvance,
  onClose,
}) => {
  const [targets, setTargets] = useState<(Element | null)[]>([]);

  useEffect(() => {
    if (steps.length === 0) {
      setTargets([]);
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    let disposed = false;

    const resolveTargets = () => steps.map((step) => step.getTarget?.() ?? null);

    const updateTargets = () => {
      if (disposed) {
        return;
      }
      setTargets(resolveTargets());
    };

    updateTargets();

    const interval = window.setInterval(() => {
      updateTargets();
    }, 250);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [steps]);

  const joyrideSteps = useMemo<JoyrideStep[]>(() => {
    if (steps.length === 0) {
      return [];
    }

    return steps.map((step, index) => {
      const target = targets[index];
      const resolvedTarget = target ?? document.body;
      const hasTarget = Boolean(target);

      return {
        target: resolvedTarget,
        title: step.title,
        content: step.description,
        disableBeacon: true,
        placement: hasTarget ? "auto" : "center",
        spotlightPadding: step.highlightPadding ?? HIGHLIGHT_PADDING_DEFAULT,
        styles: {
          spotlight: {
            borderRadius: 12,
          },
        },
      } satisfies JoyrideStep;
    });
  }, [steps, targets]);

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { action, index, status, type } = data;

      if (type === EVENTS.TARGET_NOT_FOUND) {
        const step = steps[index];
        if (!step?.getTarget) {
          const nextIndex = Math.min(index + 1, steps.length - 1);
          onAdvance(nextIndex);
        }
        return;
      }

      if (type === EVENTS.STEP_AFTER) {
        if (action === ACTIONS.NEXT) {
          const nextIndex = Math.min(index + 1, steps.length - 1);
          onAdvance(nextIndex);
        } else if (action === ACTIONS.PREV) {
          const previousIndex = Math.max(index - 1, 0);
          onAdvance(previousIndex);
        }
      }

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        onClose();
      }
    },
    [onAdvance, onClose, steps]
  );

  if (joyrideSteps.length === 0) {
    return null;
  }

  return (
    <Joyride
      steps={joyrideSteps}
      stepIndex={activeIndex}
      run={activeIndex < joyrideSteps.length}
      continuous
      showSkipButton
      disableCloseOnEsc
      disableOverlayClose
      hideBackButton
      locale={{
        back: "Back",
        close: "Begin the Feast",
        last: "Begin the Feast",
        next: "Next",
        skip: "Skip",
      }}
      styles={{
        options: {
          arrowColor: "rgba(7, 12, 24, 0.96)",
          backgroundColor: "rgba(7, 12, 24, 0.96)",
          overlayColor: "rgba(8, 12, 20, 0.78)",
          textColor: "var(--color-text-normal)",
          primaryColor: "var(--color-accent)",
          zIndex: 60,
        },
      }}
      tooltipComponent={(props: TooltipRenderProps) => <SceneTutorialTooltip {...props} />}
      callback={handleJoyrideCallback}
    />
  );
};

const SceneTutorialTooltip: React.FC<TooltipRenderProps> = ({
  backProps,
  continuous,
  index,
  primaryProps,
  size,
  skipProps,
  step,
  tooltipProps,
}) => {
  const isLastStep = index === size - 1;

  return (
    <section
      {...tooltipProps}
      className="scene-tutorial-overlay__tooltip surface-card"
      role="dialog"
      aria-modal="true"
    >
      <header className="scene-tutorial-overlay__tooltip-header">
        <h2 className="scene-tutorial-overlay__title">{step.title}</h2>
        {skipProps && (
          <button
            {...skipProps}
            type="button"
            className="scene-tutorial-overlay__skip"
          >
            Skip
          </button>
        )}
      </header>
      <p className="scene-tutorial-overlay__description">{step.content}</p>
      <div className="scene-tutorial-overlay__actions">
        {continuous && backProps && index > 0 && (
          <button
            {...backProps}
            type="button"
            className="scene-tutorial-overlay__back"
          >
            Back
          </button>
        )}
        <button
          {...primaryProps}
          type="button"
          className="button primary-button scene-tutorial-overlay__next"
        >
          {isLastStep ? "Begin the Feast" : "Next"}
        </button>
      </div>
      <p className="scene-tutorial-overlay__progress">
        Step {index + 1} of {size}
      </p>
    </section>
  );
};
