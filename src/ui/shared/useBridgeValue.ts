import { useCallback, useSyncExternalStore } from "react";
import { DataBridge } from "@logic/core/DataBridge";
import type { BridgeKey, BridgeValue } from "@logic/core/BridgeSchema";

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
  fallback: BridgeValue<K>
): BridgeValue<K> => {
  const subscribe = useCallback(
    (callback: () => void) => {
      const unsubscribe = bridge.subscribe(key, () => {
        callback();
      });
      return unsubscribe;
    },
    [bridge, key]
  );

  const getSnapshot = useCallback(() => {
    const value = bridge.getValue(key);
    return value ?? fallback;
  }, [bridge, key, fallback]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
