import type { DataBridge } from "./DataBridge";
import type { BridgeKey } from "./DataBridge";

/**
 * Helper функції для роботи з DataBridge.
 * Уніфікує паттерн pushState, який повторюється в багатьох модулях.
 */
export class DataBridgeHelpers {
  /**
   * Публікує стан модуля через DataBridge.
   * Уніфікує паттерн `bridge.setValue(key, payload)`, який повторюється в багатьох модулях.
   *
   * @param bridge - екземпляр DataBridge
   * @param key - ключ для публікації стану
   * @param payload - дані для публікації
   */
  public static pushState<T>(bridge: DataBridge, key: BridgeKey, payload: T): void {
    bridge.setValue(key, payload);
  }

  /**
   * Створює функцію для публікації стану з фіксованим ключем.
   * Корисно для модулів, які публікують стан через один ключ.
   *
   * @param bridge - екземпляр DataBridge
   * @param key - ключ для публікації стану
   * @returns функція для публікації стану
   */
  public static createStatePusher<T>(
    bridge: DataBridge,
    key: BridgeKey
  ): (payload: T) => void {
    return (payload: T) => {
      bridge.setValue(key, payload);
    };
  }
}
