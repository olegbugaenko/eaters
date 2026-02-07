# UnitModuleWorkshopModule

## Призначення
Відповідає за прокачку модулів юнітів: визначає доступність, вартість апгрейду та поточні бонуси.

## Залежності
- `DataBridge` — публікує стан майстерні (`unitModules/workshop`).
- `ResourcesModule` — списує ресурси за апгрейди.
- Функція `getSkillLevel` — перевіряє скіл `void_modules` (відкриває майстерню).
- `UnlockService` — контролює додаткові умови відкриття модулів.
- `unit-modules-db.ts` — опис бонусів, вартості та умов.

## Життєвий цикл
- `initialize()` — визначає доступні модулі, публікує стан і сповіщає підписників.
- `reset()` / `load(data)` — відновлюють рівні та оновлюють місток.

## Основні методи
- `tick(deltaMs)` — перевіряє нові умови розблокування, оновлює стан.
- `tryUpgradeModule(id)` — списує ресурси й підвищує рівень, якщо модуль видимий та розблокований.
- `getModuleLevel(id)` — повертає поточний рівень.
- `subscribe(listener)` — сповіщає про зміни (для UnitDesignModule).

## Збереження
- Зберігає рівні модулів у вигляді мапи `UnitModuleId → level` без нульових значень.

## Створення станів

Модуль використовує `UnitModuleStateFactory` (наслідник `StateFactory`) для створення станів модулів:

- **`create`**: обчислює доступність модуля, вартість наступного апгрейду, поточні бонуси та максимальний рівень
- **`transform`**: не використовується (немає side effects, стан використовується тільки для UI)

Метод `computeWorkshopState` використовує `stateFactory.createMany` для створення станів всіх модулів одночасно.

## Особливості
- Вартість кожного наступного рівня зростає вдвічі (через `Math.pow(2, level)`).
- Видимість модулів визначається як об'єднання відкритих умов і прокачаних модулів, щоб гравець не втрачав доступ до вже покращених.
- Використовує `StateFactory` для уніфікованого створення станів (див. [state-factory.md](../overview/state-factory.md)).

## Декларативні ефекти та здібності модулів

Модулі можуть декларувати ефекти та здібності, які вони надають юнітам. Ці метадані використовуються для:
- Автоматичного відображення в тултіпах юнітів
- Майбутньої декларативної логіки накладання ефектів

### appliesEffect
Описує статус-ефект, який модуль накладає при активації:

```typescript
interface ModuleEffectApplication {
  readonly effectId: StatusEffectId;  // ID ефекту з status-effects-db
  readonly target: "brick" | "unit" | "enemy";
  readonly durationMs?: number;       // тривалість ефекту
}
```

**Приклади:**
- `burningTail` → накладає `meltingTail` на бріки (збільшує вхідний дамаг)
- `freezingTail` → накладає `freezingTail` на бріки (зменшує вихідний дамаг)
- `frenzyGland` → накладає `frenzy` на союзних юнітів

### providesAbility
Описує здібність (instant action), яку модуль надає юніту:

```typescript
type ModuleAbilityType = "heal" | "frenzyBuff" | "fireball" | "chainLightning";

interface ModuleAbilityInfo {
  readonly type: ModuleAbilityType;
  readonly label: string;           // назва для UI
  readonly cooldownSeconds?: number;
  readonly maxCharges?: number;     // обмеження за ран
}
```

**Приклад (mendingGland):**
```typescript
providesAbility: {
  type: "heal",
  label: "Healing Pulse",
  cooldownSeconds: 4,
  maxCharges: 100,
}
```

### Відображення в тултіпі юніта
Тултіп автоматично показує:
1. **Потенційні ефекти** — що юніт може накладати (з параметрами на основі рівня модуля)
2. **Здібності** — heal amount, cooldown, charges
3. **Активні ефекти** — поточні бафи/дебафи на юніті (в уніфікованому nested форматі)
