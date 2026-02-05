import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import "./HintTooltip.css";

interface HintTooltipProps {
  /** Hint text shown in the popover on hover/focus */
  text: string;
  /** Accessible label for the trigger (e.g. "Overdrive help") */
  ariaLabel?: string;
}

export const HintTooltip: React.FC<HintTooltipProps> = ({
  text,
  ariaLabel = "Show hint",
}) => {
  const [visible, setVisible] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useRef(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
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

  const popoverEl =
    visible && popoverStyle ? (
      <span
        className="hint-tooltip__popover"
        role="tooltip"
        style={{
          left: popoverStyle.left,
          top: popoverStyle.top,
          transform: "translate(-50%, -100%)",
        }}
      >
        {text}
      </span>
    ) : null;

  return (
    <span
      ref={containerRef}
      className="hint-tooltip"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span
        ref={triggerRef}
        className="hint-tooltip__trigger"
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-expanded={visible}
      >
        ?
      </span>
      {typeof document !== "undefined" && document.body ? createPortal(popoverEl, document.body) : null}
    </span>
  );
};
