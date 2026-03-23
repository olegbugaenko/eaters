import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { classNames } from "@ui-shared/classNames";
import "./HintTooltip.css";

interface HintTooltipProps {
  /** Hint text shown in the popover on hover/focus */
  text?: string;
  /** Custom hint content. If provided, it has priority over text. */
  content?: ReactNode;
  /** Accessible label for the trigger (e.g. "Overdrive help") */
  ariaLabel?: string;
  /** Tooltip placement relative to trigger. */
  placement?: "top" | "right";
  /** Optional class for tooltip content container. */
  contentClassName?: string;
  /** Custom trigger node. */
  children?: ReactNode;
}

export const HintTooltip: React.FC<HintTooltipProps> = ({
  text,
  content,
  ariaLabel = "Show hint",
  placement = "top",
  contentClassName,
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useRef(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    if (placement === "right") {
      setPopoverStyle({
        left: rect.right + gap,
        top: rect.top + rect.height / 2,
      });
      return;
    }
    setPopoverStyle({
      left: rect.left + rect.width / 2,
      top: rect.top - gap,
    });
  });

  useEffect(() => {
    if (!visible) {
      setPopoverStyle(null);
      return;
    }
    updatePosition.current();
    const handleScrollOrResize = () => updatePosition.current();
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [visible]);

  const popoverContent = content ?? text;

  const popoverEl =
    visible && popoverStyle ? (
      <span
        className={classNames(
          "hint-tooltip__popover",
          `hint-tooltip__popover--${placement}`,
          contentClassName,
        )}
        role="tooltip"
        style={{
          left: popoverStyle.left,
          top: popoverStyle.top,
          transform:
            placement === "right"
              ? "translateY(-50%)"
              : "translate(-50%, -100%)",
        }}
      >
        {popoverContent}
      </span>
    ) : null;

  if (!popoverContent) {
    return null;
  }

  return (
    <span
      ref={containerRef}
      className={classNames(
        "hint-tooltip",
        Boolean(children) ? "hint-tooltip--custom-trigger" : undefined,
      )}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span
        ref={triggerRef}
        className={classNames(
          "hint-tooltip__trigger",
          Boolean(children) ? "hint-tooltip__trigger--custom" : undefined,
        )}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-expanded={visible}
      >
        {children ?? "?"}
      </span>
      {typeof document !== "undefined" && document.body ? createPortal(popoverEl, document.body) : null}
    </span>
  );
};
