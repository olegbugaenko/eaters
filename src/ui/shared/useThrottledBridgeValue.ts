import { useCallback, useRef, useSyncExternalStore } from "react";
import { DataBridge } from "@/core/logic/ui/DataBridge";
import type { BridgeKey, BridgeValue } from "@/core/logic/ui/BridgeSchema";

const getTimestamp = (): number =>
  typeof performance === "undefined" ? Date.now() : performance.now();

export const useThrottledBridgeValue = <K extends BridgeKey>(
  bridge: DataBridge,
  key: K,
  fallback: BridgeValue<K>,
  intervalMs: number,
  comparator?: (previous: BridgeValue<K>, next: BridgeValue<K>) => boolean
): BridgeValue<K> => {
  const lastValueRef = useRef<BridgeValue<K>>(bridge.getValue(key) ?? fallback);
  const lastEmitRef = useRef<number>(0);
  const pendingRef = useRef<BridgeValue<K> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subscribe = useCallback(
    (callback: () => void) => {
      const interval = Math.max(intervalMs, 0);
      const unsubscribe = bridge.subscribe(key, () => {
        const next = bridge.getValue(key) ?? fallback;
        if (comparator && comparator(lastValueRef.current, next)) {
          return;
        }

        if (interval === 0) {
          lastValueRef.current = next;
          callback();
          return;
        }

        pendingRef.current = next;
        const now = getTimestamp();
        const elapsed = now - lastEmitRef.current;
        if (elapsed >= interval) {
          lastEmitRef.current = now;
          lastValueRef.current = next;
          pendingRef.current = null;
          callback();
          return;
        }

        if (timeoutRef.current !== null) {
          return;
        }

        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          const pending = pendingRef.current;
          if (pending === null) {
            return;
          }
          pendingRef.current = null;
          lastEmitRef.current = getTimestamp();
          lastValueRef.current = pending;
          callback();
        }, interval - elapsed);
      });

      return () => {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        pendingRef.current = null;
        unsubscribe();
      };
    },
    [bridge, comparator, fallback, intervalMs, key]
  );

  const getSnapshot = useCallback(() => lastValueRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
