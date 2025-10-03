export type BridgeKey = string;

export type BridgeListener<T> = (value: T) => void;

export class DataBridge {
  private values = new Map<BridgeKey, unknown>();
  private listeners = new Map<BridgeKey, Set<BridgeListener<unknown>>>();

  public setValue<T>(key: BridgeKey, value: T): void {
    this.values.set(key, value);
    const keyListeners = this.listeners.get(key);
    if (!keyListeners) {
      return;
    }
    keyListeners.forEach((listener) => listener(value));
  }

  public getValue<T>(key: BridgeKey): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  public subscribe<T>(key: BridgeKey, listener: BridgeListener<T>): () => void {
    let keyListeners = this.listeners.get(key);
    if (!keyListeners) {
      keyListeners = new Set();
      this.listeners.set(key, keyListeners);
    }
    keyListeners.add(listener as BridgeListener<unknown>);

    if (this.values.has(key)) {
      listener(this.values.get(key) as T);
    }

    return () => {
      keyListeners?.delete(listener as BridgeListener<unknown>);
      if (keyListeners && keyListeners.size === 0) {
        this.listeners.delete(key);
      }
    };
  }
}
