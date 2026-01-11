import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clamp } from "@shared/helpers/numbers.helper";

export type TutorialOverlayPlacement = "top" | "bottom" | "left" | "right" | "center";

export type TutorialStep = {
  id: string;
  target: string | HTMLElement | (() => HTMLElement | null);
  title?: string;
  content: React.ReactNode;

  placement?: TutorialOverlayPlacement;
  padding?: number;     // px around target
  radius?: number;      // for visual only (outline)
  allowSpotlightClicks?: boolean;
  nextLabel?: string;
  nextDisabled?: boolean;
  footer?: React.ReactNode;
  backDisabled?: boolean;

  // optional hooks
  onBefore?: () => void | Promise<void>;
  onAfter?: () => void;
};

type Props = {
  steps: TutorialStep[];
  run: boolean;
  stepIndex: number;
  onStepIndexChange: (next: number) => void;
  onClose?: () => void;

  // behavior
  blockOutsideClicks?: boolean;   // clicks on dark area do nothing (default true)
  closeOnOutsideClick?: boolean;  // clicks on dark area close tutorial (default false)
  scrollIntoView?: boolean;       // auto-scroll target into view (default true)

  zIndex?: number;
  dimColor?: string;              // rgba(...)

  tooltipClassName?: string;
};

type Rect = { x: number; y: number; w: number; h: number };

function resolveTarget(t: TutorialStep["target"]): HTMLElement | null {
  if (!t) return null;
  if (typeof t === "string") return document.querySelector(t) as HTMLElement | null;
  if (typeof t === "function") return t();
  return t;
}

function getPaddedRect(el: HTMLElement, padding: number): Rect {
  const r = el.getBoundingClientRect();
  return {
    x: Math.max(0, r.left - padding),
    y: Math.max(0, r.top - padding),
    w: Math.max(0, r.width + padding * 2),
    h: Math.max(0, r.height + padding * 2),
  };
}

function useRafThrottled(fn: () => void, enabled: boolean) {
  const raf = useRef<number | null>(null);

  return useMemo(() => {
    if (!enabled) return () => {};

    return () => {
      if (raf.current != null) return;
      raf.current = window.requestAnimationFrame(() => {
        raf.current = null;
        fn();
      });
    };
  }, [fn, enabled]);
}

export function TutorialOverlay({
  steps,
  run,
  stepIndex,
  onStepIndexChange,
  onClose,

  blockOutsideClicks = true,
  closeOnOutsideClick = false,
  scrollIntoView = true,

  zIndex = 10000,
  dimColor = "rgba(0,0,0,0.6)",
  tooltipClassName,
}: Props) {
  const step = steps[stepIndex];
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);

  const padding = step?.padding ?? 10;
  const allowSpotlightClicks = step?.allowSpotlightClicks ?? false;
  const radius = step?.radius ?? 10;

  // Resolve target each step
  useLayoutEffect(() => {
    if (!run || !step) return;

    const el = resolveTarget(step.target);
    setTargetEl(el);

    if (el && scrollIntoView) {
      // smooth-ish centering
      el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    }
  }, [run, step, scrollIntoView]);

  const recompute = () => {
    if (!run || !step) return;
    const el = resolveTarget(step.target);
    setTargetEl(el);
    if (!el) {
      setRect(null);
      return;
    }
    setRect(getPaddedRect(el, padding));
  };

  const onTick = useRafThrottled(recompute, run);

  // Keep rect updated on scroll/resize
  useEffect(() => {
    if (!run) return;

    recompute();

    window.addEventListener("resize", onTick, { passive: true });
    window.addEventListener("scroll", onTick, { passive: true, capture: true });

    const ro = targetEl ? new ResizeObserver(onTick) : null;
    if (ro && targetEl) ro.observe(targetEl);

    return () => {
      window.removeEventListener("resize", onTick as any);
      window.removeEventListener("scroll", onTick as any, true as any);
      if (ro) ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, stepIndex, targetEl]);

  // step lifecycle hooks
  useEffect(() => {
    let cancelled = false;
    if (!run || !step) return;

    (async () => {
      try {
        setBusy(true);
        await step.onBefore?.();
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
      step.onAfter?.();
    };
  }, [run, stepIndex]); // intentionally only changes per step

  const isLast = stepIndex >= steps.length - 1;
  const canBack = stepIndex > 0 && !(step?.backDisabled ?? false);

  const nextDisabled = step?.nextDisabled ?? false;

  const goNext = () => {
    if (nextDisabled) return;
    if (isLast) {
      onClose?.();
      return;
    }
    onStepIndexChange(stepIndex + 1);
  };

  const goBack = () => {
    if (!canBack) return;
    onStepIndexChange(stepIndex - 1);
  };

  const close = () => onClose?.();

  // Tooltip positioning
  const tooltipStyle = useMemo(() => {
    const base: React.CSSProperties = {
      position: "fixed",
      zIndex: zIndex + 5,
      maxWidth: 360,
      width: "min(360px, calc(100vw - 24px))",
      background: "#111",
      color: "#fff",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 12,
      padding: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      pointerEvents: "auto",
      fontSize: 14,
      lineHeight: 1.35,
    };

    if (!rect || step?.placement === "center") {
      return { ...base, left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
    }

    const gap = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const place = step?.placement ?? "bottom";

    const centerX = rect.x + rect.w / 2;
    const centerY = rect.y + rect.h / 2;

    // Default: bottom
    let left = clamp(centerX - 180, 12, vw - 12 - 360);
    let top = rect.y + rect.h + gap;

    if (place === "top") top = rect.y - gap;
    if (place === "bottom") top = rect.y + rect.h + gap;
    if (place === "left") {
      left = rect.x - gap - 360;
      top = clamp(centerY - 80, 12, vh - 12 - 160);
    }
    if (place === "right") {
      left = rect.x + rect.w + gap;
      top = clamp(centerY - 80, 12, vh - 12 - 160);
    }

    // If top placement, we anchor above but need transform to move up by tooltip height.
    // For MVP we do a simple trick: use translateY(-100%) when top.
    const transform =
      place === "top"
        ? "translateY(-100%)"
        : "none";

    return { ...base, left, top, transform };
  }, [rect, step?.placement, zIndex]);

  if (!run || !step) return null;

  // If no target, fallback to full-screen tooltip
  const r = rect ?? { x: 0, y: 0, w: 0, h: 0 };

  const maskCommon: React.CSSProperties = {
    position: "fixed",
    zIndex,
    background: dimColor,
    pointerEvents: blockOutsideClicks ? "auto" : "none",
  };

  const topMask: React.CSSProperties = { ...maskCommon, left: 0, top: 0, right: 0, height: r.y };
  const leftMask: React.CSSProperties = { ...maskCommon, left: 0, top: r.y, width: r.x, height: r.h };
  const rightMask: React.CSSProperties = { ...maskCommon, left: r.x + r.w, top: r.y, right: 0, height: r.h };
  const bottomMask: React.CSSProperties = { ...maskCommon, left: 0, top: r.y + r.h, right: 0, bottom: 0 };

  const onOutsideClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (closeOnOutsideClick) close();
    // else do nothing
  };

  const onBlockerClick = (e: React.MouseEvent) => {
    // blocks spotlight clicks when allowSpotlightClicks=false
    e.stopPropagation();
  };

  // Spotlight outline (visual only). Must NOT intercept clicks when allowSpotlightClicks=true
  const spotlightOutline: React.CSSProperties = {
    position: "fixed",
    zIndex: zIndex + 2,
    left: r.x,
    top: r.y,
    width: r.w,
    height: r.h,
    borderRadius: radius,
    boxShadow: "0 0 0 2px rgba(255,255,255,0.25), 0 0 30px rgba(255,255,255,0.12)",
    pointerEvents: "none",
  };

  // If spotlight clicks should be DISALLOWED, we place a transparent blocker over the hole.
  const spotlightBlocker: React.CSSProperties = {
    position: "fixed",
    zIndex: zIndex + 3,
    left: r.x,
    top: r.y,
    width: r.w,
    height: r.h,
    background: "transparent",
    pointerEvents: "auto",
  };

  return (
    <>
      {/* Masks around the spotlight hole - only render when blockOutsideClicks is true */}
      {blockOutsideClicks && (
        <>
          <div style={topMask} onMouseDown={onOutsideClick} onClick={onOutsideClick} />
          <div style={leftMask} onMouseDown={onOutsideClick} onClick={onOutsideClick} />
          <div style={rightMask} onMouseDown={onOutsideClick} onClick={onOutsideClick} />
          <div style={bottomMask} onMouseDown={onOutsideClick} onClick={onOutsideClick} />
        </>
      )}

      {/* Visual outline for the spotlight */}
      {rect && <div style={spotlightOutline} />}

      {/* Optional blocker ON TOP of spotlight hole */}
      {rect && !allowSpotlightClicks && (
        <div style={spotlightBlocker} onMouseDown={onBlockerClick} onClick={onBlockerClick} />
      )}

      {/* Tooltip */}
      <div style={tooltipStyle} className={tooltipClassName}>
        {step.title && (
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
            {step.title}
          </div>
        )}

        <div style={{ opacity: busy ? 0.7 : 1 }}>{step.content}</div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          <button
            type="button"
            onClick={goBack}
            disabled={!canBack || busy}
            className="button small-button"
          >
            Back
          </button>

          <div style={{ flex: 1 }} />

          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="button danger-button small-button"
          >
            Skip
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={busy || nextDisabled}
            className="button primary-button small-button"
          >
            {step.nextLabel ?? (isLast ? "Finish" : "Next")}
          </button>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          {step.footer ?? (
            <>
              {stepIndex + 1} / {steps.length}
              {rect && allowSpotlightClicks && " • spotlight clickable"}
            </>
          )}
        </div>
      </div>
    </>
  );
}
