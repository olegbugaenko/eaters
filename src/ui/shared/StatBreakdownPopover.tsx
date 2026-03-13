import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { BonusBreakdownEntry } from "@shared/types/bonuses";
import type { BonusId } from "@db/bonuses-db";
import { getBonusConfig } from "@db/bonuses-db";
import { BONUS_SOURCE_CATEGORIES } from "@logic/modules/shared/bonuses/bonuses.const";
import { formatNumber } from "./format/number";
import "./StatBreakdownPopover.css";

export interface StatBreakdownPopoverProps {
  /** Bonus IDs to show breakdown for */
  bonusIds: readonly BonusId[];
  /** Fetches breakdown entries for a bonus */
  getBreakdown: (bonusId: BonusId) => readonly BonusBreakdownEntry[];
  /** Resolves bonus source ID to localized display name */
  resolveSourceName: (sourceId: string) => string;
  /** Translator for labels */
  t: (key: string, fallback: string) => string;
  /** Accessible label for the trigger */
  ariaLabel?: string;
  /** Organ-only attack multiplier to show above skills/buildings breakdown (e.g. from unit blueprint) */
  organMultiplier?: number;
}

const formatEntryValue = (
  entry: BonusBreakdownEntry,
  t: (key: string, fallback: string) => string
): string => {
  if (entry.effectType === "multiplier") {
    const pct = (entry.value - 1) * 100;
    if (Math.abs(pct) < 0.01) return "×1";
    const sign = pct >= 0 ? "+" : "";
    return `×${formatNumber(entry.value, { maximumFractionDigits: 2 })} (${sign}${formatNumber(pct, { maximumFractionDigits: 1 })}%)`;
  }
  if (entry.effectType === "income") {
    return `+${formatNumber(entry.value)}`;
  }
  return formatNumber(entry.value);
};

const formatTotalIncome = (total: number): string =>
  `+${formatNumber(total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatTotalMultiplier = (total: number): string =>
  `×${formatNumber(total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface GroupedSection {
  bonusId: BonusId;
  bonusName: string;
  incomeGroups: { category: string; entries: BonusBreakdownEntry[]; subtotal: number }[];
  incomeTotal: number;
  multiplierGroups: { category: string; entries: BonusBreakdownEntry[]; subtotal: number }[];
  multiplierTotal: number;
}

function buildGroupedSections(
  bonusIds: readonly BonusId[],
  getBreakdown: (bonusId: BonusId) => readonly BonusBreakdownEntry[],
  getBonusConfig: (id: BonusId) => { name: string }
): GroupedSection[] {
  return bonusIds.map((bonusId) => {
    const entries = getBreakdown(bonusId);
    const config = getBonusConfig(bonusId);

    const incomeEntries = entries.filter((e) => e.effectType === "income");
    const multiplierEntries = entries.filter((e) => e.effectType === "multiplier");

    const groupByCategory = (list: BonusBreakdownEntry[]) => {
      const map = new Map<string, BonusBreakdownEntry[]>();
      for (const entry of list) {
        const arr = map.get(entry.category) ?? [];
        arr.push(entry);
        map.set(entry.category, arr);
      }
      return map;
    };

    const incomeByCat = groupByCategory(incomeEntries);
    const multByCat = groupByCategory(multiplierEntries);

    const incomeGroups = BONUS_SOURCE_CATEGORIES.filter((c) => incomeByCat.has(c)).map(
      (category) => {
        const catEntries = incomeByCat.get(category)!;
        const subtotal = catEntries.reduce((s, e) => s + e.value, 0);
        return { category, entries: catEntries, subtotal };
      }
    );

    const multiplierGroups = BONUS_SOURCE_CATEGORIES.filter((c) => multByCat.has(c)).map(
      (category) => {
        const catEntries = multByCat.get(category)!;
        const subtotal = catEntries.reduce((s, e) => s * e.value, 1);
        return { category, entries: catEntries, subtotal };
      }
    );

    const incomeTotal = incomeEntries.reduce((s, e) => s + e.value, 0);
    const multiplierTotal =
      multiplierEntries.length > 0
        ? multiplierEntries.reduce((s, e) => s * e.value, 1)
        : 1;

    return {
      bonusId,
      bonusName: config.name,
      incomeGroups,
      incomeTotal,
      multiplierGroups,
      multiplierTotal,
    };
  });
}

export const StatBreakdownPopover: React.FC<StatBreakdownPopoverProps> = ({
  bonusIds,
  getBreakdown,
  resolveSourceName,
  t,
  ariaLabel = "Show stat breakdown",
  organMultiplier,
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

  const sections = useMemo(
    () => buildGroupedSections(bonusIds, getBreakdown, getBonusConfig),
    [bonusIds, getBreakdown]
  );

  const hasContent =
    (organMultiplier != null && organMultiplier > 0) ||
    sections.some(
      (s) => s.incomeGroups.length > 0 || s.multiplierGroups.length > 0
    );

  const renderGroup = (
    group: { category: string; entries: BonusBreakdownEntry[]; subtotal: number },
    isMultiplier: boolean
  ) => (
    <div key={group.category} className="stat-breakdown-popover__category">
      <div className="stat-breakdown-popover__category-header">
        <span className="stat-breakdown-popover__category-name">
          {t(`voidCamp.bonusCategories.${group.category}`, group.category)}
        </span>
        <span className="stat-breakdown-popover__category-total">
          {isMultiplier
            ? formatTotalMultiplier(group.subtotal)
            : formatTotalIncome(group.subtotal)}
        </span>
      </div>
      <ul className="stat-breakdown-popover__list">
        {group.entries.map((entry, idx) => (
          <li key={`${entry.sourceId}-${idx}`} className="stat-breakdown-popover__item">
            <span className="stat-breakdown-popover__source">
              {resolveSourceName(entry.sourceId)}
              {entry.level > 0 && (
                <span className="stat-breakdown-popover__level">
                  {" "}
                  {t("voidCamp.common.level", "Lv")} {entry.level}
                </span>
              )}
            </span>
            <span className="stat-breakdown-popover__value">
              {formatEntryValue(entry, t)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  const popoverEl =
    visible && popoverStyle && hasContent ? (
      <div
        className="stat-breakdown-popover"
        role="dialog"
        aria-label={t("voidCamp.unitStats.breakdown", "Stat breakdown")}
        style={{
          left: popoverStyle.left,
          top: popoverStyle.top,
          transform: "translate(-50%, -100%)",
        }}
      >
        <button
          type="button"
          className="stat-breakdown-popover__close"
          onClick={() => setVisible(false)}
          aria-label={t("voidCamp.common.close", "Close")}
        >
          ×
        </button>
        {organMultiplier != null && organMultiplier > 0 && (
          <div className="stat-breakdown-popover__section stat-breakdown-popover__organ-multiplier">
            <div className="stat-breakdown-popover__section-title">
              {t("voidCamp.unitStats.organMultiplier", "Organ multiplier")}
              <span className="stat-breakdown-popover__section-total">
                {" "}
                {formatTotalMultiplier(organMultiplier)}
              </span>
            </div>
          </div>
        )}
        {sections.map((section) => {
          const hasIncome = section.incomeGroups.length > 0;
          const hasMultiplier = section.multiplierGroups.length > 0;
          if (!hasIncome && !hasMultiplier) return null;

          return (
            <div key={section.bonusId} className="stat-breakdown-popover__section">
              <div className="stat-breakdown-popover__section-title">
                {t(`bonuses.${section.bonusId}.name`, section.bonusName)}
                {hasIncome && (
                  <span className="stat-breakdown-popover__section-total">
                    {" "}
                    {formatTotalIncome(section.incomeTotal)}
                  </span>
                )}
                {hasMultiplier && (
                  <span className="stat-breakdown-popover__section-total">
                    {" "}
                    {formatTotalMultiplier(section.multiplierTotal)}
                  </span>
                )}
              </div>
              {section.incomeGroups.map((g) => renderGroup(g, false))}
              {section.multiplierGroups.map((g) => renderGroup(g, true))}
            </div>
          );
        })}
      </div>
    ) : null;

  if (!hasContent) {
    return null;
  }

  return (
    <span
      ref={containerRef}
      className="stat-breakdown-popover-trigger"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setVisible((v) => !v);
      }}
    >
      <span
        ref={triggerRef}
        className="stat-breakdown-popover-trigger__icon"
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-expanded={visible}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setVisible((v) => !v);
          }
        }}
      >
        ?
      </span>
      {typeof document !== "undefined" && document.body
        ? createPortal(popoverEl, document.body)
        : null}
    </span>
  );
};
