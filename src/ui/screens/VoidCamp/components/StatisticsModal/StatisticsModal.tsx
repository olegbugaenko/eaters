import { useCallback, useId } from "react";
import type { CampStatisticsSnapshot } from "@logic/modules/statistics/statistics.module";
import { formatDuration } from "@ui/utils/formatDuration";
import { formatNumber } from "@ui/shared/format/number";
import "./StatisticsModal.css";

interface FavoriteMapInfo {
  name: string;
  attempts: number;
}

interface StatisticsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly timePlayedMs: number;
  readonly favoriteMap: FavoriteMapInfo | null;
  readonly statistics: CampStatisticsSnapshot;
}

const formatCount = (value: number): string =>
  formatNumber(Math.max(0, Math.floor(value)), {
    maximumFractionDigits: 0,
    useGrouping: true,
    compact: false,
  });

const formatDamage = (value: number): string =>
  formatNumber(Math.max(0, value), {
    maximumFractionDigits: value < 10 ? 1 : 0,
    minimumFractionDigits: value > 0 && value < 10 ? 1 : 0,
    useGrouping: true,
    compact: false,
  });

export const StatisticsModal: React.FC<StatisticsModalProps> = ({
  isOpen,
  onClose,
  timePlayedMs,
  favoriteMap,
  statistics,
}) => {
  const titleId = useId();

  const handleDialogClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  if (!isOpen) {
    return null;
  }

  const favoriteMapNote = favoriteMap
    ? `${formatNumber(Math.max(0, favoriteMap.attempts), {
        maximumFractionDigits: 0,
        compact: false,
      })} attempts`
    : "No runs recorded yet.";

  const stats = [
    {
      label: "Time Played",
      value: formatDuration(timePlayedMs),
      note: undefined,
    },
    {
      label: "Favorite Map",
      value: favoriteMap ? favoriteMap.name : "—",
      note: favoriteMap ? favoriteMapNote : "No map runs completed yet.",
    },
    {
      label: "Bricks Destroyed",
      value: formatCount(statistics.bricksDestroyed),
      note: undefined,
    },
    {
      label: "Creatures Died",
      value: formatCount(statistics.creaturesDied),
      note: undefined,
    },
    {
      label: "Damage Dealt",
      value: formatDamage(statistics.damageDealt),
      note: undefined,
    },
    {
      label: "Damage Taken",
      value: formatDamage(statistics.damageTaken),
      note: undefined,
    },
  ];

  return (
    <div className="statistics-modal" onClick={onClose} role="presentation">
      <div
        className="statistics-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={handleDialogClick}
      >
        <header className="statistics-modal__header">
          <h2 id={titleId} className="statistics-modal__title">
            Statistics
          </h2>
          <button type="button" className="statistics-modal__close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="statistics-modal__content">
          <ul className="statistics-modal__list">
            {stats.map((entry) => (
              <li key={entry.label} className="statistics-modal__item">
                <span className="statistics-modal__label">{entry.label}</span>
                <span className="statistics-modal__value">{entry.value}</span>
                {entry.note ? (
                  <span className="statistics-modal__note">{entry.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
