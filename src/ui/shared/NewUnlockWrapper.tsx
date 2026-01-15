import { useCallback, type ReactNode } from "react";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { classNames } from "@ui-shared/classNames";
import "./NewUnlockWrapper.css";

interface NewUnlockWrapperProps {
  readonly children: ReactNode;
  readonly path: string;
  readonly hasNew: boolean;
  readonly markOnHover?: boolean;
  readonly className?: string;
}

export const NewUnlockWrapper = ({
  children,
  path,
  hasNew,
  markOnHover = false,
  className,
}: NewUnlockWrapperProps) => {
  const { uiApi } = useAppLogic();

  const handleMarkViewed = useCallback(() => {
    if (!hasNew || !markOnHover || !path) {
      return;
    }
    uiApi.newUnlocks.markViewed(path);
  }, [hasNew, markOnHover, path, uiApi]);

  const wrapperClasses = classNames("new-unlock-wrapper", className);

  return (
    <span
      className={wrapperClasses}
      onMouseEnter={handleMarkViewed}
      onFocus={handleMarkViewed}
    >
      {children}
      {hasNew && <span className="new-unlock-wrapper__indicator" aria-hidden="true" />}
    </span>
  );
};
