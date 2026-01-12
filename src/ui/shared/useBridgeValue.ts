import { useCallback, useRef, useSyncExternalStore } from "react";
import { DataBridge } from "@/core/logic/ui/DataBridge";
import type { BridgeKey, BridgeValue } from "@/core/logic/ui/BridgeSchema";

/**
 * Хук для підписки на значення DataBridge з типобезпечною перевіркою.
 * TypeScript автоматично виведе правильний тип значення на основі ключа.
 *
 * @param bridge - екземпляр DataBridge
 * @param key - ключ для підписки
 * @param fallback - значення за замовчуванням, якщо значення відсутнє
 * @returns поточне значення або fallback
 */
export const useBridgeValue = <K extends BridgeKey>(
  bridge: DataBridge,
  key: K,
  fallback: BridgeValue<K>,
  comparator?: (previous: BridgeValue<K>, next: BridgeValue<K>) => boolean
): BridgeValue<K> => {
  const lastValueRef = useRef<BridgeValue<K>>(bridge.getValue(key) ?? fallback);
  const subscribe = useCallback(
    (callback: () => void) => {
      const unsubscribe = bridge.subscribe(key, () => {
        const next = bridge.getValue(key) ?? fallback;
        if (comparator && comparator(lastValueRef.current, next)) {
          return;
        }
        lastValueRef.current = next;
        callback();
      });
      return unsubscribe;
    },
    [bridge, comparator, fallback, key]
  );

  const getSnapshot = useCallback(() => {
    const value = bridge.getValue(key) ?? fallback;
    if (comparator && comparator(lastValueRef.current, value)) {
      return lastValueRef.current;
    }
    lastValueRef.current = value;
    return value;
  }, [bridge, comparator, fallback, key]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
