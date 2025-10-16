import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Button } from "@ui/shared/Button";
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

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface SceneTutorialOverlayProps {
  readonly steps: readonly SceneTutorialStep[];
  readonly activeIndex: number;
  readonly onAdvance: () => void;
  readonly onClose: () => void;
}

const HIGHLIGHT_PADDING_DEFAULT = 16;

export const SceneTutorialOverlay: React.FC<SceneTutorialOverlayProps> = ({
  steps,
  activeIndex,
  onAdvance,
  onClose,
}) => {
  const step = steps[activeIndex];
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);

  const isLastStep = useMemo(
    () => activeIndex >= steps.length - 1,
    [activeIndex, steps.length]
  );

  useLayoutEffect(() => {
    if (!step) {
      setHighlightRect(null);
      return;
    }

    const resolveTarget = () => step.getTarget?.() ?? null;
    let currentTarget: Element | null = resolveTarget();

    const updateRect = () => {
      const element = resolveTarget();
      currentTarget = element;
      if (!element) {
        setHighlightRect(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      const padding = step.highlightPadding ?? HIGHLIGHT_PADDING_DEFAULT;
      setHighlightRect({
        top: Math.max(rect.top - padding, 0),
        left: Math.max(rect.left - padding, 0),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    };

    updateRect();

    const handleResize = () => updateRect();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && currentTarget) {
      resizeObserver = new ResizeObserver(() => updateRect());
      resizeObserver.observe(currentTarget);
    }

    const animation = window.requestAnimationFrame(() => updateRect());

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize);
      if (resizeObserver && currentTarget) {
        resizeObserver.disconnect();
      }
      window.cancelAnimationFrame(animation);
    };
  }, [step]);

  useEffect(() => {
    if (!step?.getTarget) {
      return;
    }
    const element = step.getTarget();
    if (!element) {
      return;
    }
    element.classList.add("scene-tutorial-overlay__target");
    return () => {
      element.classList.remove("scene-tutorial-overlay__target");
    };
  }, [step]);

  if (!step) {
    return null;
  }

  return (
    <div className="scene-tutorial-overlay">
      <div className="scene-tutorial-overlay__backdrop" aria-hidden="true" />
      {highlightRect && (
        <div
          className="scene-tutorial-overlay__highlight"
          style={{
            top: `${highlightRect.top}px`,
            left: `${highlightRect.left}px`,
            width: `${highlightRect.width}px`,
            height: `${highlightRect.height}px`,
          }}
        />
      )}
      <section
        className="scene-tutorial-overlay__panel surface-card"
        role="dialog"
        aria-modal="true"
      >
        <header className="scene-tutorial-overlay__panel-header">
          <h2 className="scene-tutorial-overlay__title">{step.title}</h2>
          <button
            type="button"
            className="scene-tutorial-overlay__skip"
            onClick={onClose}
          >
            Skip
          </button>
        </header>
        <p className="scene-tutorial-overlay__description">{step.description}</p>
        <div className="scene-tutorial-overlay__actions">
          <Button onClick={isLastStep ? onClose : onAdvance}>
            {isLastStep ? "Begin the Feast" : "Next"}
          </Button>
        </div>
      </section>
    </div>
  );
};
