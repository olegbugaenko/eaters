/**
 * Базовий клас для створення локальних станів модулів.
 * Уніфікує підхід до factory-патерну для state-об'єктів.
 *
 * @template TState - тип створюваного стану
 * @template TInput - тип вхідних даних для створення стану
 */
export abstract class StateFactory<TState, TInput = unknown> {
  /**
   * Створює новий стан на основі вхідних даних.
   * Повинен бути реалізований у підкласах.
   */
  abstract create(input: TInput): TState;

  /**
   * Опціональний метод для застосування side effects та трансформацій до стану.
   * Може мутувати стан (повертає void) або повертати новий трансформований стан.
   * Якщо повертає void - стан мутується, якщо TState - створюється новий іммутабельний стан.
   *
   * @param state - створений стан
   * @param input - вхідні дані, що використовувались для створення стану
   * @returns трансформований стан або void (якщо мутація)
   */
  protected transform?(state: TState, input: TInput): TState | void;

  /**
   * Створює стан з автоматичним застосуванням трансформацій (якщо вони визначені).
   * Якщо transform не визначений - працює як звичайний create.
   */
  createWithTransform(input: TInput): TState {
    const state = this.create(input);
    if (this.transform) {
      const transformed = this.transform(state, input);
      // Якщо transform повернув новий стан - використовуємо його, інакше - мутований оригінал
      return transformed !== undefined ? transformed : state;
    }
    return state;
  }

  /**
   * Створює масив станів з масиву вхідних даних.
   */
  createMany(inputs: readonly TInput[]): TState[] {
    return inputs.map((input) => this.create(input));
  }

  /**
   * Створює масив станів з автоматичним застосуванням трансформацій.
   */
  createManyWithTransform(inputs: readonly TInput[]): TState[] {
    return inputs.map((input) => this.createWithTransform(input));
  }

  /**
   * Створює стан з можливістю валідації.
   * Повертає null, якщо валідація не пройдена.
   */
  createWithValidation(
    input: TInput,
    validator: (state: TState) => boolean
  ): TState | null {
    const state = this.create(input);
    if (!validator(state)) {
      return null;
    }
    return state;
  }

  /**
   * Створює стан з фільтрацією - пропускає тільки валідні стани.
   */
  createManyFiltered(
    inputs: readonly TInput[],
    validator?: (state: TState) => boolean
  ): TState[] {
    if (!validator) {
      return this.createMany(inputs);
    }
    return inputs
      .map((input) => this.createWithValidation(input, validator))
      .filter((state): state is TState => state !== null);
  }
}
