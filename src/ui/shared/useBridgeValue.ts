import { useCallback, useSyncExternalStore } from "react";
import { DataBridge } from "@logic/core/DataBridge";

export const useBridgeValue = <T>(bridge: DataBridge, key: string, fallback: T): T => {
  const subscribe = useCallback(
    (callback: () => void) => {
      const unsubscribe = bridge.subscribe<T>(key, () => {
        callback();
      });
      return unsubscribe;
    },
    [bridge, key]
  );

  const getSnapshot = useCallback(() => {
    const value = bridge.getValue<T>(key);
    return value ?? fallback;
  }, [bridge, key, fallback]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
