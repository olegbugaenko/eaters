const React = require("react");
const { createPortal } = require("react-dom");

const EVENTS = {
  STEP_AFTER: "step:after",
  TARGET_NOT_FOUND: "error:target_not_found",
};

const STATUS = {
  RUNNING: "running",
  FINISHED: "finished",
  SKIPPED: "skipped",
};

const ACTIONS = {
  NEXT: "next",
  PREV: "prev",
  CLOSE: "close",
  SKIP: "skip",
};

const DEFAULT_STYLES = {
  options: {
    overlayColor: "rgba(0, 0, 0, 0.6)",
    zIndex: 1000,
  },
};

const noop = () => {};

const resolveTarget = (target) => {
  if (!target) {
    return null;
  }
  if (typeof target === "string") {
    if (target === "body") {
      return typeof document !== "undefined" ? document.body : null;
    }
    return typeof document !== "undefined" ? document.querySelector(target) : null;
  }
  if (typeof window !== "undefined" && target instanceof window.Element) {
    return target;
  }
  return null;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const useHighlightRect = (step, activeIndex, run, callback) => {
  const [rect, setRect] = React.useState(null);
  const [currentTarget, setCurrentTarget] = React.useState(null);

  React.useEffect(() => {
    if (!run || !step) {
      setRect(null);
      setCurrentTarget(null);
      return noop;
    }

    const element = resolveTarget(step.target);
    const shouldIgnoreBody = element && element.tagName === "BODY" && !step.target;

    if (!element || shouldIgnoreBody) {
      setRect(null);
      setCurrentTarget(null);
      if (typeof callback === "function") {
        callback({
          action: ACTIONS.NEXT,
          index: activeIndex,
          status: STATUS.RUNNING,
          type: EVENTS.TARGET_NOT_FOUND,
          step,
        });
      }
      return noop;
    }

    setCurrentTarget(element);

    const padding = typeof step.spotlightPadding === "number" ? step.spotlightPadding : 0;

    const updateRect = () => {
      const bounds = element.getBoundingClientRect();
      setRect({
        top: Math.max(bounds.top - padding, 0),
        left: Math.max(bounds.left - padding, 0),
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
      });
    };

    updateRect();

    const handleScroll = () => updateRect();
    const handleResize = () => updateRect();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updateRect());
      resizeObserver.observe(element);
    }

    const animation = window.requestAnimationFrame(updateRect);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.cancelAnimationFrame(animation);
    };
  }, [step, activeIndex, run, callback]);

  return { rect, target: currentTarget };
};

const computeTooltipPosition = (step, rect) => {
  if (!rect) {
    if (typeof window === "undefined") {
      return { top: 0, left: 0, transform: "none" };
    }
    return {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2,
      transform: "translate(-50%, -50%)",
    };
  }

  if (typeof window === "undefined") {
    return { top: rect.top, left: rect.left, transform: "none" };
  }

  const offset = 24;
  const placement = step && step.placement ? step.placement : "auto";

  let top;
  let transformY = "0";

  if (placement === "center") {
    return {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2,
      transform: "translate(-50%, -50%)",
    };
  }

  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  const below = rect.top + rect.height + offset;
  const above = rect.top - offset;

  if (placement === "top") {
    top = above;
    transformY = "-100%";
  } else if (placement === "bottom") {
    top = below;
    transformY = "0";
  } else {
    // auto
    if (below + 200 <= viewportHeight) {
      top = below;
      transformY = "0";
    } else {
      top = above;
      transformY = "-100%";
    }
  }

  const clampedLeft = clamp(rect.left + rect.width / 2, 160, viewportWidth - 160);

  return {
    top: clamp(top, 80, viewportHeight - 80),
    left: clampedLeft,
    transform: `translate(-50%, ${transformY})`,
  };
};

const Joyride = (props) => {
  const {
    steps = [],
    stepIndex = 0,
    run = true,
    continuous = false,
    showSkipButton = false,
    hideBackButton = false,
    disableOverlayClose = false,
    locale = {},
    styles = {},
    tooltipComponent: TooltipComponent,
    callback,
  } = props;

  const mergedStyles = React.useMemo(() => ({
    options: { ...DEFAULT_STYLES.options, ...(styles.options || {}) },
  }), [styles]);

  const activeIndex = Math.min(stepIndex, steps.length - 1);
  const activeStep = steps[activeIndex];

  const [container, setContainer] = React.useState(null);

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return noop;
    }
    const el = document.createElement("div");
    document.body.appendChild(el);
    setContainer(el);
    return () => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, []);

  const { rect } = useHighlightRect(activeStep, activeIndex, run && Boolean(activeStep), callback);

  const tooltipPosition = React.useMemo(
    () => computeTooltipPosition(activeStep, rect),
    [activeStep, rect]
  );

  if (!run || !activeStep || !container) {
    return null;
  }

  const handleNext = () => {
    if (typeof callback === "function") {
      const status = activeIndex >= steps.length - 1 ? STATUS.FINISHED : STATUS.RUNNING;
      callback({
        action: ACTIONS.NEXT,
        index: activeIndex,
        status,
        type: EVENTS.STEP_AFTER,
        step: activeStep,
      });
    }
  };

  const handleSkip = () => {
    if (typeof callback === "function") {
      callback({
        action: ACTIONS.SKIP,
        index: activeIndex,
        status: STATUS.SKIPPED,
        type: EVENTS.STEP_AFTER,
        step: activeStep,
      });
    }
  };

  const overlay = React.createElement(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: mergedStyles.options.zIndex,
        pointerEvents: "auto",
      },
    },
    React.createElement("div", {
      style: {
        position: "fixed",
        inset: 0,
        background: mergedStyles.options.overlayColor,
        pointerEvents: disableOverlayClose ? "auto" : "auto",
      },
    }),
    rect && activeStep.placement !== "center"
      ? React.createElement("div", {
          style: {
            position: "fixed",
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius:
              (activeStep.styles && activeStep.styles.spotlight && activeStep.styles.spotlight.borderRadius) ||
              12,
            boxShadow: "0 0 24px rgba(236, 72, 153, 0.55), 0 0 0 2px rgba(236, 72, 153, 0.75)",
            pointerEvents: "none",
            mixBlendMode: "screen",
          },
        })
      : null,
    TooltipComponent
      ? React.createElement(TooltipComponent, {
          continuous,
          index: activeIndex,
          size: steps.length,
          step: activeStep,
          tooltipProps: {
            style: {
              position: "fixed",
              top: tooltipPosition.top,
              left: tooltipPosition.left,
              transform: tooltipPosition.transform,
              pointerEvents: "auto",
            },
          },
          primaryProps: {
            onClick: handleNext,
            title: locale.next || "Next",
          },
          backProps: hideBackButton
            ? undefined
            : activeIndex > 0
            ? {
                onClick: () => {
                  if (typeof callback === "function") {
                    callback({
                      action: ACTIONS.PREV,
                      index: activeIndex,
                      status: STATUS.RUNNING,
                      type: EVENTS.STEP_AFTER,
                      step: activeStep,
                    });
                  }
                },
              }
            : undefined,
          skipProps: showSkipButton
            ? {
                onClick: handleSkip,
                title: locale.skip || "Skip",
              }
            : undefined,
          continuous,
          closeProps: {
            onClick: handleSkip,
            title: locale.close || "Close",
          },
        })
      : null
  );

  return createPortal(overlay, container);
};

module.exports = Joyride;
module.exports.default = Joyride;
module.exports.Joyride = Joyride;
module.exports.EVENTS = EVENTS;
module.exports.STATUS = STATUS;
module.exports.ACTIONS = ACTIONS;
