# Комунікація між модулями

Цей документ описує механізми комунікації між модулями та між модулями та UI.

## Архітектура комунікації

У проєкті використовуються два основні механізми комунікації:

1. **DataBridge** — для комунікації модулів з UI
2. **Subscribe/Listeners** — для комунікації між модулями

## DataBridge: Модулі → UI

### Призначення
`DataBridge` — це транспорт для реактивних даних між логікою та React. Він використовується **виключно** для передачі стану модулів до UI.

### Як працює

**Модуль публікує стан:**
```typescript
// У модулі
private pushState(): void {
  const payload: BuildingsWorkshopBridgeState = {
    unlocked: this.unlocked,
    buildings: this.buildings,
  };
  DataBridgeHelpers.pushState(this.bridge, BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY, payload);
}
```

**UI підписується на зміни:**
```typescript
// У React компоненті
const buildingsState = useBridgeValue(
  bridge,
  BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY,
  DEFAULT_BUILDINGS_WORKSHOP_STATE
);
```

### Коли використовувати DataBridge
- ✅ Завжди для публікації стану модуля до UI
- ✅ Коли UI потребує реактивних оновлень стану
- ✅ Для всіх даних, які відображаються в інтерфейсі

### Приклади модулів, які використовують DataBridge
- `BuildingsModule` → публікує `BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY`
- `CraftingModule` → публікує `CRAFTING_STATE_BRIDGE_KEY`
- `ResourcesModule` → публікує `RESOURCE_TOTALS_BRIDGE_KEY`, `RESOURCE_RUN_SUMMARY_BRIDGE_KEY`
- Всі модулі, які мають UI-представлення

## Subscribe/Listeners: Модуль → Модуль

### Призначення
Механізм `subscribe/listeners` використовується для **внутрішньої комунікації між модулями**, коли один модуль потребує реагувати на зміни в іншому модулі.

### Базовий клас BaseGameModule

Модулі, які потребують підтримки listeners, можуть наслідувати `BaseGameModule`:

```typescript
export class BuildingsModule extends BaseGameModule<() => void> {
  // listeners вже доступні через базовий клас
  
  protected notifyListeners(): void {
    // Викликається автоматично з базового класу
    super.notifyListeners();
  }
}
```

### Паттерни використання

#### 1. Модуль підписується на інший модуль

**Приклад: CraftingModule підписується на BonusesModule**
```typescript
export class CraftingModule implements GameModule {
  constructor(options: CraftingModuleOptions) {
    this.bonuses = options.bonuses;
    // Підписуємося на зміни бонусів
    this.bonuses.subscribe((values) => this.handleBonusValuesUpdated(values));
  }
  
  private handleBonusValuesUpdated(values: BonusValueMap): void {
    // Реагуємо на зміни бонусів (наприклад, оновлюємо швидкість крафту)
    this.craftingSpeedMultiplier = values.crafting_speed_mult ?? 1;
  }
}
```

**Приклад: UnitDesignModule підписується на BonusesModule та UnitModuleWorkshopModule**
```typescript
export class UnitDesignModule extends BaseGameModule<UnitDesignerListener> {
  public initialize(): void {
    // Підписуємося на зміни бонусів
    this.unsubscribeBonuses = this.bonuses.subscribe((values) => {
      this.cachedBonuses = values;
      this.refreshComputedState();
    });
    
    // Підписуємося на зміни модулів юнітів
    this.unsubscribeWorkshop = this.workshop.subscribe(() => {
      this.refreshComputedState();
    });
  }
}
```

#### 2. Модуль надає subscribe для інших модулів

**Приклад: BonusesModule надає subscribe**
```typescript
export class BonusesModule extends BaseGameModule<BonusValuesListener> {
  public override subscribe(listener: BonusValuesListener): () => void {
    return super.subscribe(listener, () => {
      // Викликаємо listener одразу з поточним станом
      listener(this.getAllValues());
    });
  }
  
  protected override notifyListeners(): void {
    const snapshot = this.getAllValues();
    // Сповіщаємо listeners з даними
    this.notifyListenersWith((listener) => listener(snapshot));
  }
}
```

### Коли використовувати Subscribe/Listeners

✅ **Використовуйте**, коли:
- Модуль потребує **реагувати на зміни** в іншому модулі
- Потрібна **реактивна синхронізація** стану між модулями
- Зміни в одному модулі мають **впливати на логіку** іншого модуля

❌ **НЕ використовуйте**, коли:
- Потрібно просто **отримати поточний стан** (використовуйте методи типу `getValue()`)
- Дані потрібні тільки для **UI** (використовуйте DataBridge)
- Модуль не має зовнішніх підписників (інші модулі не потребують реагувати на його зміни)

### Приклади використання в проєкті

| Модуль-підписник | Модуль-джерело | Причина підписки |
|------------------|----------------|------------------|
| `CraftingModule` | `BonusesModule` | Реагує на зміни швидкості крафту |
| `UnitDesignModule` | `BonusesModule` | Оновлює обчислені стати юнітів при зміні бонусів |
| `UnitDesignModule` | `UnitModuleWorkshopModule` | Оновлює доступність модулів для дизайну |
| `UnitAutomationModule` | `UnitDesignModule` | Реагує на зміни дизайнів юнітів |
| `NecromancerModule` | `BonusesModule` | Оновлює вартість спавну при зміні бонусів |
| `NecromancerModule` | `UnitDesignModule` | Реагує на зміни дизайнів для спавну |
| `SpellcastingModule` | `BonusesModule` | Оновлює силу заклинань |
| `SkillTreeModule` | `BonusesModule` | Оновлює доступність скілів |

### Модулі, які надають subscribe

- ✅ **BonusesModule** — найбільш використовуваний, багато модулів підписуються на зміни бонусів
- ✅ **UnitDesignModule** — використовується `UnitAutomationModule` та `NecromancerModule`
- ✅ **UnitModuleWorkshopModule** — використовується `UnitDesignModule`
- ✅ **BuildingsModule** — має `subscribe()`, але зараз не використовується іншими модулями

## Розділення відповідальності

### DataBridge vs Subscribe

| Аспект | DataBridge | Subscribe/Listeners |
|--------|------------|---------------------|
| **Призначення** | Модуль → UI | Модуль → Модуль |
| **Коли використовувати** | Для UI-даних | Для внутрішньої логіки |
| **Хто підписується** | React компоненти | Інші модулі |
| **Тип даних** | UI-стани, payloads | Внутрішні події, зміни стану |
| **Приклад** | `buildingsState`, `craftingState` | `bonuses.subscribe()`, `workshop.subscribe()` |

### Чому не всі модулі мають subscribe?

Модуль **не потребує** `subscribe()`, якщо:
- Ніхто не потребує реагувати на його зміни
- Всі дані передаються через DataBridge до UI
- Модуль не має залежностей від інших модулів, які потребують реактивності

**Приклади модулів без subscribe:**
- `CraftingModule` — ніхто не підписується на його зміни, UI отримує дані через DataBridge
- `BricksModule` — ніхто не потребує реагувати на зміни цеглинок
- `BulletModule` — внутрішня логіка, не потребує зовнішніх підписників

## Best Practices

### 1. Використання BaseGameModule

Якщо модуль потребує listeners, використовуйте `BaseGameModule`:

```typescript
// ✅ Правильно
export class BuildingsModule extends BaseGameModule<() => void> {
  // listeners та subscribe вже доступні
}

// ❌ Неправильно - дублювання коду
export class BuildingsModule implements GameModule {
  private listeners = new Set<() => void>();
  public subscribe(listener: () => void): () => void { ... }
  protected notifyListeners(): void { ... }
}
```

### 2. Уніфікація публікації стану

Використовуйте `DataBridgeHelpers.pushState()` замість прямого `bridge.setValue()`:

```typescript
// ✅ Правильно
DataBridgeHelpers.pushState(this.bridge, KEY, payload);

// ❌ Неправильно - дублювання коду
this.bridge.setValue(KEY, payload);
```

### 3. Правильне очищення підписок

Завжди зберігайте функцію відписки та викликайте її при необхідності:

```typescript
export class UnitDesignModule extends BaseGameModule {
  private unsubscribeBonuses: (() => void) | null = null;
  
  public initialize(): void {
    this.unsubscribeBonuses = this.bonuses.subscribe((values) => {
      // ...
    });
  }
  
  // При необхідності можна додати cleanup
  // public cleanup(): void {
  //   this.unsubscribeBonuses?.();
  // }
}
```

### 4. Коли додавати subscribe до модуля

Додавайте `subscribe()` до модуля **тільки якщо**:
- Інший модуль потребує реагувати на зміни
- Це задокументовано в залежностях модуля

**Не додавайте** `subscribe()` "на всякий випадок" — це додає складність без потреби.

## Приклади з проєкту

### Модуль з subscribe (використовується іншими)

```typescript
// BonusesModule - надає subscribe для інших модулів
export class BonusesModule extends BaseGameModule<BonusValuesListener> {
  public override subscribe(listener: BonusValuesListener): () => void {
    return super.subscribe(listener, () => {
      listener(this.getAllValues()); // Початковий стан
    });
  }
}
```

### Модуль без subscribe (не потрібен)

```typescript
// CraftingModule - ніхто не підписується на його зміни
export class CraftingModule implements GameModule {
  // Немає subscribe, бо:
  // 1. UI отримує дані через DataBridge
  // 2. Інші модулі не потребують реагувати на зміни crafting
}
```

### Модуль, який підписується на інші

```typescript
// UnitDesignModule - підписується на кілька модулів
export class UnitDesignModule extends BaseGameModule {
  public initialize(): void {
    // Підписуємося на зміни бонусів
    this.bonuses.subscribe((values) => {
      this.cachedBonuses = values;
      this.refreshComputedState();
    });
    
    // Підписуємося на зміни модулів
    this.workshop.subscribe(() => {
      this.refreshComputedState();
    });
  }
}
```

## Підсумок

- **DataBridge** = Модуль → UI (завжди використовується для UI-даних)
- **Subscribe/Listeners** = Модуль → Модуль (тільки коли потрібна реактивність)
- Не всі модулі потребують `subscribe()` — додавайте тільки за потреби
- Використовуйте `BaseGameModule` для уніфікації логіки listeners
- Використовуйте `DataBridgeHelpers` для уніфікації публікації стану
