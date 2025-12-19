import { memo, MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
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

export type SceneTutorialAction = "summon-blue-vanguard";

export interface SceneTutorialStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly getTarget?: () => Element | null;
  readonly highlightPadding?: number;
  readonly placement?: JoyrideStep["placement"];
  readonly requiredAction?: SceneTutorialAction;
  readonly nextLabel?: string;
  readonly lockMessage?: string;
  readonly isLocked?: boolean;
}

interface SceneTutorialOverlayProps {
  readonly steps: readonly SceneTutorialStep[];
  readonly activeIndex: number;
  readonly onAdvance: (nextIndex: number) => void;
  readonly onClose: () => void;
}

const HIGHLIGHT_PADDING_DEFAULT = 16;

interface SceneTutorialJoyrideStep extends JoyrideStep {
  isLocked?: boolean;
  nextLabel?: string;
  lockMessage?: string;
}

const SceneTutorialOverlayInner: React.FC<SceneTutorialOverlayProps> = ({
  steps,
  activeIndex,
  onAdvance,
  onClose,
}) => {
  const [targets, setTargets] = useState<(Element | null)[]>([]);
  const [spotRect, setSpotRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

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

    const areEqual = (a: (Element | null)[], b: (Element | null)[]) => {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    };

    const updateTargets = () => {
      if (disposed) {
        return;
      }
      const next = resolveTargets();
      setTargets((prev) => (areEqual(prev, next) ? prev : next));
    };

    updateTargets();

    const interval = window.setInterval(() => {
      updateTargets();
    }, 500);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [steps]);

  const joyrideSteps = useMemo<SceneTutorialJoyrideStep[]>(() => {
    if (steps.length === 0) {
      return [];
    }

    return steps.map((step, index) => {
      const target = targets[index];
      const resolvedTarget = target ?? document.body;
      const hasTarget = Boolean(target);
      const resolvedId = (resolvedTarget as HTMLElement | null)?.id;
      const joyrideTarget = resolvedId ? (`#${resolvedId}` as unknown as Element) : resolvedTarget;

      const next: SceneTutorialJoyrideStep = {
        target: joyrideTarget,
        title: step.title,
        content: step.description,
        disableBeacon: true,
        placement: step.placement ?? (hasTarget ? "auto" : "center"),
        spotlightPadding: step.highlightPadding ?? HIGHLIGHT_PADDING_DEFAULT,
        isLocked: step.isLocked,
        nextLabel: step.nextLabel,
        lockMessage: step.lockMessage,
        styles: {
          spotlight: {
            borderRadius: 12,
          },
        },
      };

      return next satisfies SceneTutorialJoyrideStep;
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

  // Track current target rect and update custom overlay "hole"
  useEffect(() => {
    if (joyrideSteps.length === 0) {
      setSpotRect(null);
      return;
    }
    const current = targets[activeIndex];
    const padding = steps[activeIndex]?.highlightPadding ?? HIGHLIGHT_PADDING_DEFAULT;

    const updateRect = () => {
      if (!current) {
        setSpotRect(null);
        return;
      }
      const rect = current.getBoundingClientRect();
      const x = Math.max(0, rect.left - padding);
      const y = Math.max(0, rect.top - padding);
      const w = Math.max(0, rect.width + padding * 2);
      const h = Math.max(0, rect.height + padding * 2);
      setSpotRect({ x, y, w, h });
    };

    updateRect();
    window.addEventListener("resize", updateRect, { passive: true });
    window.addEventListener("scroll", updateRect, { passive: true });
    const interval = window.setInterval(updateRect, 250);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, targets, steps, joyrideSteps.length]);

  if (joyrideSteps.length === 0) {
    return null;
  }

  return (
    <>
      {/* Custom non-dimming spotlight overlay: four rectangles around target */}
      {spotRect && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 59,
            pointerEvents: "none",
          }}
        >
          {/* top */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: `${Math.max(0, spotRect.y)}px`,
              background: "rgba(8, 12, 20, 0.78)",
            }}
          />
          {/* bottom */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: `${Math.max(0, spotRect.y + spotRect.h)}px`,
              width: "100%",
              height: `calc(100vh - ${Math.max(0, spotRect.y + spotRect.h)}px)`,
              background: "rgba(8, 12, 20, 0.78)",
            }}
          />
          {/* left */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: `${spotRect.y}px`,
              width: `${Math.max(0, spotRect.x)}px`,
              height: `${spotRect.h}px`,
              background: "rgba(8, 12, 20, 0.78)",
            }}
          />
          {/* right */}
          <div
            style={{
              position: "absolute",
              left: `${Math.max(0, spotRect.x + spotRect.w)}px`,
              top: `${spotRect.y}px`,
              width: `calc(100vw - ${Math.max(0, spotRect.x + spotRect.w)}px)`,
              height: `${spotRect.h}px`,
              background: "rgba(8, 12, 20, 0.78)",
            }}
          />
        </div>
      )}

      <Joyride
        steps={joyrideSteps}
        stepIndex={activeIndex}
        run={activeIndex < joyrideSteps.length}
        continuous
        showSkipButton
        disableCloseOnEsc
        disableOverlayClose
        hideBackButton
        spotlightClicks
        locale={{
          back: "Back",
          close: "Begin",
          last: "Begin",
          next: "Next",
          skip: "Skip",
        }}
        styles={{
          options: {
            arrowColor: "rgba(7, 12, 24, 0.96)",
            backgroundColor: "rgba(7, 12, 24, 0.96)",
            overlayColor: "transparent",
            textColor: "var(--color-text-normal)",
            primaryColor: "var(--color-accent)",
            zIndex: 60,
          },
        }}
        tooltipComponent={SceneTutorialTooltip}
        callback={handleJoyrideCallback}
      />
    </>
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
  const typedStep = step as SceneTutorialJoyrideStep;
  const isLocked = Boolean(typedStep.isLocked && !isLastStep);
  const lockMessage = typedStep.lockMessage;
  const nextLabel = typedStep.nextLabel ?? (isLastStep ? "Begin" : "Next");

  const { onClick: primaryOnClick, ...restPrimaryProps } = primaryProps;
  const handlePrimaryClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isLocked) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    primaryOnClick?.(event);
  };

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
          {...restPrimaryProps}
          onClick={handlePrimaryClick}
          type="button"
          disabled={isLocked}
          className="button primary-button scene-tutorial-overlay__next"
        >
          {nextLabel}
        </button>
      </div>
      {isLocked && lockMessage && (
        <p className="scene-tutorial-overlay__description">{lockMessage}</p>
      )}
      <p className="scene-tutorial-overlay__progress">
        Step {index + 1} of {size}
      </p>
    </section>
  );
};
