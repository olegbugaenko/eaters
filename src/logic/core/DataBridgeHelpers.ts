import type { DataBridge } from "./DataBridge";
import type { BridgeKey, BridgeValue } from "./BridgeSchema";

/**
 * Helper функції для роботи з DataBridge.
 * Уніфікує паттерн pushState, який повторюється в багатьох модулях.
 */
export class DataBridgeHelpers {
  /**
   * Публікує стан модуля через DataBridge з типобезпечною перевіркою.
   * TypeScript перевірить, що тип payload відповідає типу ключа.
   *
   * @param bridge - екземпляр DataBridge
   * @param key - ключ для публікації стану
   * @param payload - дані для публікації
   */
  public static pushState<K extends BridgeKey>(
    bridge: DataBridge,
    key: K,
    payload: BridgeValue<K>
  ): void {
    bridge.setValue(key, payload);
  }

  /**
   * Створює функцію для публікації стану з фіксованим ключем.
   * Корисно для модулів, які публікують стан через один ключ.
   * TypeScript перевірить, що тип payload відповідає типу ключа.
   *
   * @param bridge - екземпляр DataBridge
   * @param key - ключ для публікації стану
   * @returns функція для публікації стану
   */
  public static createStatePusher<K extends BridgeKey>(
    bridge: DataBridge,
    key: K
  ): (payload: BridgeValue<K>) => void {
    return (payload: BridgeValue<K>) => {
      bridge.setValue(key, payload);
    };
  }
}
