import { type ReactNode, useEffect, useMemo, useState } from "react";
import { classNames } from "@ui-shared/classNames";
import { NewUnlockWrapper } from "@ui-shared/NewUnlockWrapper";
import "./MasterDetailLayout.css";

export interface MasterDetailItem {
  id: string;
}

interface MasterDetailLayoutProps<T extends MasterDetailItem> {
  items: readonly T[];
  header?: ReactNode;
  renderCard: (item: T, isActive: boolean) => ReactNode;
  renderDetail: (item: T) => ReactNode;
  emptyState?: ReactNode;
  emptyDetail?: ReactNode;
  getUnlockPath?: (item: T) => string;
  unseenPaths?: Set<string>;
  getCardClassName?: (item: T) => string;
  className?: string;
}

export function MasterDetailLayout<T extends MasterDetailItem>({
  items,
  header,
  renderCard,
  renderDetail,
  emptyState,
  emptyDetail,
  getUnlockPath,
  unseenPaths,
  getCardClassName,
  className,
}: MasterDetailLayoutProps<T>) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const fallback = items[0]?.id ?? null;
    if (!selectedId) {
      setSelectedId(fallback);
      return;
    }
    const exists = items.some((item) => item.id === selectedId);
    if (!exists) {
      setSelectedId(fallback);
    }
  }, [selectedId, items]);

  const activeItem = useMemo(() => {
    const activeId = hoveredId ?? selectedId ?? items[0]?.id ?? null;
    if (!activeId) {
      return null;
    }
    return items.find((item) => item.id === activeId) ?? null;
  }, [hoveredId, selectedId, items]);

  if (!items || items.length === 0) {
    return (
      <div className={classNames("master-detail surface-panel stack-lg", className)}>
        {header && <header className="master-detail__header">{header}</header>}
        {emptyState && <div className="master-detail__empty">{emptyState}</div>}
      </div>
    );
  }

  return (
    <div className={classNames("master-detail stack-lg", className)}>
      {header && <header className="master-detail__header master-detail__header--row">{header}</header>}
      <div className="master-detail__content">
        <div className="master-detail__list-container">
          <ul className="master-detail__list">
            {items.map((item) => {
              const isActive = item.id === (hoveredId ?? selectedId ?? item.id);
              const unlockPath = getUnlockPath?.(item);
              const extraCardClass = getCardClassName?.(item);

              const cardButton = (
                <button
                  type="button"
                  className={classNames(
                    "master-detail__card",
                    { "master-detail__card--active": isActive },
                    extraCardClass
                  )}
                  onClick={() => setSelectedId(item.id)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() =>
                    setHoveredId((current) => (current === item.id ? null : current))
                  }
                  onFocus={() => setHoveredId(item.id)}
                  onBlur={() =>
                    setHoveredId((current) => (current === item.id ? null : current))
                  }
                >
                  {renderCard(item, isActive)}
                </button>
              );

              return (
                <li key={item.id}>
                  {unlockPath && unseenPaths ? (
                    <NewUnlockWrapper
                      path={unlockPath}
                      hasNew={unseenPaths.has(unlockPath)}
                      markOnHover
                      className="new-unlock-wrapper--block"
                    >
                      {cardButton}
                    </NewUnlockWrapper>
                  ) : (
                    cardButton
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <aside>
          {activeItem ? (
            renderDetail(activeItem)
          ) : (
            <div className="master-detail__detail">
              <div className="master-detail__detail-empty">
                {emptyDetail}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
