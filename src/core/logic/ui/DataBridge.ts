import type { BridgeKey, BridgeSchema, BridgeValue } from "./BridgeSchema";

export type BridgeListener<T> = (value: T) => void;
export type BridgeComparator<T> = (previous: T | undefined, next: T) => boolean;

export class DataBridge {
  private values = new Map<BridgeKey, unknown>();
  private listeners = new Map<BridgeKey, Set<BridgeListener<unknown>>>();
  private comparators = new Map<BridgeKey, BridgeComparator<unknown>>();

  /**
   * Встановлює значення для ключа з типобезпечною перевіркою.
   * TypeScript перевірить, що тип значення відповідає типу ключа.
   */
  public setValue<K extends BridgeKey>(key: K, value: BridgeValue<K>): void {
    const previous = this.values.get(key) as BridgeValue<K> | undefined;
    const comparator = this.comparators.get(key) as
      | BridgeComparator<BridgeValue<K>>
      | undefined;
    if (comparator && comparator(previous, value)) {
      return;
    }
    this.values.set(key, value);
    const keyListeners = this.listeners.get(key);
    if (!keyListeners) {
      return;
    }
    keyListeners.forEach((listener) => listener(value));
  }

  /**
   * Отримує значення за ключем з типобезпечною перевіркою.
   * TypeScript автоматично виведе правильний тип значення.
   */
  public getValue<K extends BridgeKey>(key: K): BridgeValue<K> | undefined {
    return this.values.get(key) as BridgeValue<K> | undefined;
  }

  /**
   * Підписується на зміни значення за ключем з типобезпечною перевіркою.
   * Listener автоматично отримає правильний тип значення.
   */
  public subscribe<K extends BridgeKey>(
    key: K,
    listener: BridgeListener<BridgeValue<K>>
  ): () => void {
    let keyListeners = this.listeners.get(key);
    if (!keyListeners) {
      keyListeners = new Set();
      this.listeners.set(key, keyListeners);
    }
    keyListeners.add(listener as BridgeListener<unknown>);

    if (this.values.has(key)) {
      listener(this.values.get(key) as BridgeValue<K>);
    }

    return () => {
      keyListeners?.delete(listener as BridgeListener<unknown>);
      if (keyListeners && keyListeners.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  /**
   * Реєструє кастомний компаратор, який визначає чи вважати значення зміненим.
   */
  public setComparator<K extends BridgeKey>(
    key: K,
    comparator: BridgeComparator<BridgeValue<K>>
  ): void {
    this.comparators.set(key, comparator as BridgeComparator<unknown>);
  }
}
