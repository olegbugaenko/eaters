# Інтеграція з UI

React отримує доступ до логіки через `AppLogicContext`. Контекст передає `uiApi` (проксі‑шар для викликів логіки) та `DataBridge`.

- Хуки `useBridgeValue` та `useBridgeSnapshot` підписуються на ключі DataBridge й автоматично відписуються при демонтажі компонентів.
- WebGL-сцена працює напряму зі `SceneObjectManager` через `uiApi.scene`, читаючи пул об'єктів та оновлення камери.
- Екрани не залазять у внутрішній стан модулів — вони спираються на `uiApi` і значення, опубліковані у містку.

Такий підхід дозволяє логіці бути чистою TypeScript-бібліотекою, яку легко тестувати окремо від візуального шару.

## UI API

UI‑API — це типізований проксі‑шар, який мапить публічні методи модулів у декларативний реєстр (`LogicUiApiRegistry`). Реєстр розширюється модулями через module augmentation, тому core не імпортує типи модулів напряму. Це дозволяє UI викликати логіку, не імпортуючи класи модулів напряму.

**Декларація контракту в модулі (приклад):**
```typescript
// src/logic/modules/active-map/map/map.types.ts
export interface MapModuleUiApi {
  selectMap(mapId: MapId): void;
  restartSelectedMap(): void;
}
```

**Реєстр UI‑API (module augmentation):**
```typescript
// src/logic/core/ui/ui-api.registry.ts
export interface LogicUiApiRegistry {}

// src/logic/modules/active-map/map/map.types.ts
declare module "@/logic/core/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    map: MapModuleUiApi;
  }
}
```

**Використання в UI:**
```typescript
const { uiApi } = useAppLogic();
uiApi.map.selectMap("foundations");
uiApi.map.restartSelectedMap();
```

### Правило інтеграції
UI не повинен імпортувати класи з `src/logic/**` напряму. Використовуйте `uiApi` для викликів та `DataBridge` для стану. Допустимі винятки — декларації типів (`ui-api`/`bridge`) та сервісні типи для рендерингу, узгоджені в ревʼю.

## Система тултіпів

Тултіпи на сцені (для юнітів, бріків, ворогів) генеруються через `createTargetTooltip()`. Система підтримує:

### Уніфікований формат
- **Заголовок** — назва ефекту/здібності
- **Nested stats** — вкладені параметри з меншим шрифтом та відступом

### Типи контенту
1. **Базові стати** — HP, Attack, Armor, Cooldown, Move Speed
2. **Потенційні ефекти** — що юніт/ворог може накладати (через `appliesEffect` модулів або `arcAttack` ворогів)
3. **Здібності** — healing, frenzy buff тощо (через `providesAbility` модулів)
4. **Активні ефекти** — поточні бафи/дебафи на цілі

### Приклад тултіпу юніта з модулем healing:
```
Healer
YOUR UNIT
HP                    6.01K / 6.01K
ATTACK                595
ARMOR                 22
ATTACK COOLDOWN       0.6s
MOVE SPEED            100 units
HEALING PULSE
  Heal Amount         Attack × 1.40
  Cooldown            4s
  Charges             100/run
INTERNAL FURNACE (Active)
  Attack Bonus        +75%/100%
```

### Ключові файли
- `createTargetTooltip.tsx` — генерація контенту тултіпа
- `SceneTooltipPanel.tsx` — React-компонент з підтримкою `nested` статів
- `status-effects-db.helpers.ts` — форматування параметрів ефектів
