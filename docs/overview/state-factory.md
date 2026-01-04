# StateFactory — уніфікований підхід до створення станів

## Призначення

`StateFactory` — це абстрактний базовий клас, який уніфікує підхід до створення локальних станів модулів. Він розділяє чисте створення стану (`create`) від side effects та трансформацій (`transform`), що дозволяє краще тестувати та підтримувати код.

## Архітектура

### Базовий клас

```typescript
abstract class StateFactory<TState, TInput> {
  abstract create(input: TInput): TState;
  protected transform?(state: TState, input: TInput): TState | void;
  createWithTransform(input: TInput): TState;
  // ... інші допоміжні методи
}
```

### Принцип роботи

1. **`create(input)`** — чисте створення стану без side effects. Повинен бути реалізований у підкласах.
2. **`transform(state, input)`** — опціональний метод для застосування side effects (наприклад, реєстрація в `SceneObjectManager`, оновлення візуальних ефектів).
3. **`createWithTransform(input)`** — автоматично викликає `create`, а потім `transform` (якщо він визначений).

### Переваги

- **Розділення відповідальностей**: чисте створення стану відокремлено від side effects
- **Тестованість**: можна тестувати `create` без залежностей від сцени
- **Уніфікація**: однаковий підхід для всіх модулів
- **Гнучкість**: `transform` може мутувати стан або повертати новий

## Використання в модулях

### BricksModule

`BrickStateFactory` створює `InternalBrickState`:

- **`create`**: обчислює характеристики цегли (HP, броня, нагороди) на основі типу та рівня
- **`transform`**: реєструє цеглу в `SceneObjectManager` та додає `sceneObjectId` до стану

```typescript
const state = this.stateFactory.createWithTransform({
  brick: brickData,
  brickId: this.createBrickId(),
  clampToMap: (pos) => this.clampToMap(pos),
});
```

### PlayerUnitsModule

`UnitStateFactory` створює `PlayerUnitState`:

- **`create`**: використовує `UnitFactory` для створення базового стану, додає рівні модулів та налаштування цілеуказання
- **`transform`**: оновлює внутрішні візуальні ефекти (наприклад, furnace effect) та пушить стан до сцени

```typescript
const state = this.unitStateFactory.createWithTransform({
  unit: unitData,
  unitFactory: this.unitFactory,
  unitId: this.unitFactory.createUnitId(),
  blueprint: blueprintStats,
  getModuleLevel: (id) => this.getModuleLevel(id),
  // ...
});
```

### BuildingsModule

`BuildingStateFactory` створює `BuildingWorkshopItemState`:

- **`create`**: обчислює доступність, вартість апгрейду та бонуси на основі рівня будівлі
- **`transform`**: не використовується (немає side effects)

```typescript
const state = this.stateFactory.create({
  id: buildingId,
  level: currentLevel,
  unlocks: this.unlocks,
  bonuses: this.bonuses,
  // ...
});
```

## Структура файлів

Модулі, які використовують `StateFactory`, мають структуру:

```
module-name/
  ├── module-name.module.ts      # Основний модуль
  ├── module-name.state-factory.ts  # StateFactory для станів
  ├── module-name.types.ts       # Типи станів
  └── module-name.helpers.ts     # Допоміжні функції
```

## Рекомендації

1. **Чистий `create`**: метод `create` не повинен викликати side effects (додавання до сцени, оновлення bridge тощо)
2. **Side effects в `transform`**: всі side effects (реєстрація в сцені, оновлення візуальних ефектів) мають бути в `transform`
3. **Мутація vs іммутабельність**: `transform` може мутувати стан (повертає `void`) або повертати новий стан
4. **Тестування**: тестуйте `create` окремо від `transform` для кращої ізоляції

## Приклад реалізації

```typescript
export class MyStateFactory extends StateFactory<MyState, MyStateInput> {
  private readonly scene: SceneObjectManager;

  constructor(options: { scene: SceneObjectManager }) {
    super();
    this.scene = options.scene;
  }

  create(input: MyStateInput): MyState {
    // Чисте створення стану без side effects
    return {
      id: input.id,
      position: input.position,
      // ... інші поля
    };
  }

  protected override transform(state: MyState, _input: MyStateInput): void {
    // Side effects: реєстрація в сцені
    const sceneObjectId = this.scene.addObject("myObject", {
      position: state.position,
      // ...
    });
    (state as any).sceneObjectId = sceneObjectId;
  }
}
```
