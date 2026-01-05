import { GameModule } from "./types";

/**
 * Базовий клас для модулів з підтримкою listeners.
 * Уніфікує паттерн subscribe/notifyListeners, який повторюється в багатьох модулях.
 *
 * @template TListener - тип функції-слухача
 */
export abstract class BaseGameModule<TListener = () => void> implements GameModule {
  public abstract readonly id: string;

  protected listeners = new Set<TListener>();

  /**
   * Підписує listener на зміни стану модуля.
   * Повертає функцію для відписки.
   *
   * @param listener - функція-слухач
   * @param initialNotify - чи викликати listener одразу з поточним станом (опціонально)
   */
  public subscribe(listener: TListener, initialNotify?: () => void): () => void {
    this.listeners.add(listener);
    if (initialNotify) {
      initialNotify();
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Сповіщає всіх listeners про зміни.
   * Може бути перевизначений у підкласах для передачі параметрів.
   */
  protected notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        if (typeof listener === "function") {
          listener();
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`${this.constructor.name} listener error`, error);
      }
    });
  }

  /**
   * Сповіщає listeners з передачею даних.
   * Використовується, коли listener очікує параметри.
   */
  protected notifyListenersWith<T>(notifyFn: (listener: TListener) => void): void {
    this.listeners.forEach((listener) => {
      try {
        notifyFn(listener);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`${this.constructor.name} listener error`, error);
      }
    });
  }

  // GameModule interface methods - мають бути реалізовані в підкласах
  public abstract initialize(): void;
  public abstract reset(): void;
  public abstract load(data: unknown | undefined): void;
  public abstract save(): unknown;
  public abstract tick(deltaMs: number): void;
}
