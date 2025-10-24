import { useCallback, useId } from "react";
import type { MouseEventHandler } from "react";
import type { GameVersionInfo } from "@db/version-db";
import "./VersionHistoryModal.css";

interface VersionHistoryModalProps {
  isOpen: boolean;
  versions: GameVersionInfo[];
  onClose: () => void;
  title?: string;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  versions,
  onClose,
  title = "Version history",
}) => {
  const titleId = useId();
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleDialogClick: MouseEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      event.stopPropagation();
    },
    []
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="version-history-modal" onClick={handleBackdropClick}>
      <div
        className="version-history-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={handleDialogClick}
      >
        <header className="version-history-modal__header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="version-history-modal__close"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <div className="version-history-modal__list">
          {versions.map((version) => (
            <section
              key={`${version.displayName}-${version.releaseDate}`}
              className="version-history-modal__entry"
            >
              <header className="version-history-modal__entry-header">
                <span className="version-history-modal__entry-name">
                  {version.displayName}
                </span>
                <span className="version-history-modal__entry-date">
                  {version.releaseDate}
                </span>
              </header>
              <ul className="version-history-modal__entry-changes">
                {version.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
