import { RefObject, useEffect } from "react";

interface Size {
  width: number;
  height: number;
}

export const useResizeObserver = (
  ref: RefObject<HTMLElement>,
  onResize: (size: Size) => void
): void => {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const { width, height } = entry.contentRect;
        onResize({ width, height });
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [onResize, ref]);
};
