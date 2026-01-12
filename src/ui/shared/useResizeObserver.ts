import { RefObject, useEffect, useRef } from "react";

interface Size {
  width: number;
  height: number;
}

const SIZE_EPSILON = 0.5;

export const useResizeObserver = (
  ref: RefObject<HTMLElement>,
  onResize: (size: Size) => void
): void => {
  const lastSizeRef = useRef<Size | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const { width, height } = entry.contentRect;
        const lastSize = lastSizeRef.current;
        if (
          lastSize &&
          Math.abs(lastSize.width - width) <= SIZE_EPSILON &&
          Math.abs(lastSize.height - height) <= SIZE_EPSILON
        ) {
          return;
        }
        const nextSize = { width, height };
        lastSizeRef.current = nextSize;
        onResize(nextSize);
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [onResize, ref]);
};
