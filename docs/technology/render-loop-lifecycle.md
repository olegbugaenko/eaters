# Життєвий цикл рендерингу об'єктів на сцені

## Загальна картина

Кожен кадр (frame) екрану проходить через чітко визначений життєвий цикл. Це як конвеєр на фабриці: спочатку підготовка, потім обробка, потім малювання.

**Реалізація:** Весь цикл централізований у функції [`createWebGLRenderLoop()`](../../src/ui/screens/Scene/hooks/useWebGLRenderLoop.ts), яка забезпечує консистентність між різними компонентами.

## Основний цикл (кожен кадр)

### 1️⃣ **Оновлення часу** (`setSceneTimelineTimeMs`)
```typescript
setSceneTimelineTimeMs(timestamp);
```
**Що робить:** Встановлює поточний час для всіх анімацій та ефектів.  
**Навіщо:** Щоб анімації, частинки та інші ефекти знали, на якому кадрі вони зараз.

---

### 2️⃣ **Перед оновленням** (`beforeUpdate` callback)
```typescript
beforeUpdate(timestamp, scene)
```
**Що робить:** Тут можна оновити стан об'єктів ПЕРЕД тим, як вони будуть відправлені на рендеринг.  
**Приклади використання:**
- Рух камери (коли користувач наводить мишку на край екрану) — див. [`useSceneCanvas.ts`](../../src/ui/screens/Scene/hooks/useSceneCanvas.ts)
- Оновлення позицій істот (у [`SaveSlotBackgroundScene.tsx`](../../src/ui/screens/SaveSlotSelect/SaveSlotBackgroundScene.tsx))
- Будь-яка логіка, яка змінює об'єкти на сцені

**Важливо:** Тут ще НЕ відбувається рендеринг, тільки підготовка даних.

---

### 3️⃣ **Збір змін** (`scene.flushChanges()`)
```typescript
const changes = scene.flushChanges();
// Повертає: { added: [...], updated: [...], removed: [...] }
```

**Що робить:** `SceneObjectManager` збирає всі зміни, які відбулися з об'єктами:
- **added** — нові об'єкти (додані через `scene.addObject()`)
- **updated** — оновлені об'єкти (змінили позицію, розмір, колір тощо)
- **removed** — видалені об'єкти (видалені через `scene.removeObject()`)

**Як це працює:**
- Коли ти викликаєш `scene.addObject()` або `scene.updateObject()`, зміни НЕ застосовуються одразу
- Вони накопичуються в внутрішніх мапах (`added`, `updated`, `removed`)
- `flushChanges()` збирає всі ці зміни і очищає мапи

**Детальніше:** Див. метод `flushChanges()` в [`SceneObjectManager.ts`](../../src/logic/services/scene-object-manager/SceneObjectManager.ts) (рядки 208-248)

**Чому так?** Щоб не оновлювати WebGL буфери після кожної зміни (це повільно). Краще зібрати всі зміни за кадр і застосувати їх разом.

---

### 4️⃣ **Застосування змін** (`applyChanges`)
```typescript
webglRenderer.getObjectsRenderer().applyChanges(changes);
```

**Що робить:** Передає зміни в WebGL renderer, який:
- Додає нові об'єкти в WebGL буфери
- Оновлює дані існуючих об'єктів
- Позначає видалені об'єкти для видалення

**Важливо:** На цьому етапі дані ще НЕ синхронізовані з GPU. Вони тільки підготовлені в пам'яті CPU.

**Детальніше:** 
- Метод `applyChanges()` в [`ObjectsRendererManager.ts`](../../src/ui/renderers/objects/ObjectsRendererManager.ts) (рядки 118-130)
- Повний опис роботи менеджера: [objects-renderer-manager.md](objects-renderer-manager.md)

---

### 5️⃣ **Після застосування змін** (`afterApplyChanges` callback)
```typescript
afterApplyChanges(timestamp, scene, cameraState)
```

**Що робить:** Тут можна додати додаткові зміни ПІСЛЯ того, як основні зміни застосовані, але ПЕРЕД синхронізацією з GPU.

**Приклад використання:**
- **Інтерполяція позицій** — коли юніт рухається, ми хочемо показати плавний рух між кадрами
  ```typescript
  const interpolatedPositions = getInterpolatedUnitPositions();
  webglRenderer.applyInterpolatedPositions(interpolatedPositions);
  ```
  Див. [`usePositionInterpolation.ts`](../../src/ui/screens/Scene/hooks/usePositionInterpolation.ts) для деталей реалізації інтерполяції.

**Чому саме тут?** Тому що інтерполяція має бути після `applyChanges`, але перед `syncBuffers()`.

---

### 6️⃣ **Синхронізація з GPU** (`syncBuffers()`)
```typescript
webglRenderer.syncBuffers();
```

**Що робить:** Відправляє всі зміни з CPU пам'яті в GPU пам'ять (VRAM).  
**Навіщо:** GPU не може читати дані з CPU пам'яті напряму. Потрібно скопіювати дані в буфери GPU.

**Технічно:** Це викликає `gl.bufferSubData()` для оновлення VBO (Vertex Buffer Objects).

**Детальніше:** Див. метод `syncBuffers()` в [`WebGLSceneRenderer.ts`](../../src/ui/renderers/utils/WebGLSceneRenderer.ts)

---

### 7️⃣ **Після синхронізації** (`afterUpdate` callback)
```typescript
afterUpdate(timestamp, scene, cameraState)
```

**Що робить:** Тут можна зібрати статистику або оновити стан ПІСЛЯ того, як все синхронізовано.

**Приклад використання:**
- Збір статистики про використання пам'яті (`getDynamicBufferStats()`)
- Оновлення UI з інформацією про кількість об'єктів

---

### 8️⃣ **Рендеринг базової сцени** (`webglRenderer.render()`)
```typescript
webglRenderer.render(cameraState);
```

**Що робить:** Малює всі об'єкти на canvas через WebGL:
- Використовує шейдери для малювання
- Застосовує трансформації камери (масштаб, позиція)
- Малює всі об'єкти з буферів

**Результат:** На canvas з'являються всі об'єкти (цегли, юніти, тощо).

**Детальніше:** Див. метод `render()` в [`WebGLSceneRenderer.ts`](../../src/ui/renderers/utils/WebGLSceneRenderer.ts)

---

### 9️⃣ **Рендеринг ефектів** (`beforeEffects` callback)
```typescript
beforeEffects(timestamp, gl, cameraState)
```

**Що робить:** Тут малюються додаткові ефекти поверх базової сцени:
- Частинки (particles)
- Вихори (whirls)
- Аури (auras)
- Дуги (arcs)
- Вогняні кільця (fire rings)
- Кулі (bullets)
- Кільця (rings)

**Чому окремо?** Ці ефекти використовують інші шейдери та техніки рендерингу (наприклад, GPU instancing).

---

### 🔟 **Після рендерингу** (`afterRender` callback)
```typescript
afterRender(timestamp, gl, cameraState)
```

**Що робить:** Фінальні дії після того, як все намальовано.

**Приклади використання:**
- Оновлення статистики частинок
- Оновлення стану камери в React state (для UI)
- Оновлення масштабу в React state

---

## Візуальна схема

```
┌─────────────────────────────────────────────────┐
│  КАДР ПОЧИНАЄТЬСЯ (requestAnimationFrame)      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  1. setSceneTimelineTimeMs(timestamp)          │
│     "Оновлюємо час для анімацій"               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  2. beforeUpdate()                              │
│     "Оновлюємо об'єкти (камера, істоти)"       │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  3. scene.flushChanges()                        │
│     "Збираємо всі зміни: added/updated/removed" │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  4. applyChanges(changes)                        │
│     "Застосовуємо зміни в CPU пам'яті"          │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  5. afterApplyChanges()                         │
│     "Додаємо інтерполяцію позицій"               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  6. syncBuffers()                               │
│     "Копіюємо дані з CPU → GPU"                 │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  7. afterUpdate()                                │
│     "Збираємо статистику"                       │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  8. render(cameraState)                          │
│     "Малюємо базову сцену на canvas"             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  9. beforeEffects()                              │
│     "Малюємо ефекти (частинки, аури, кулі)"     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  10. afterRender()                               │
│      "Оновлюємо React state"                    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  КАДР ЗАКІНЧУЄТЬСЯ                               │
│  requestAnimationFrame(render) → наступний кадр │
└─────────────────────────────────────────────────┘
```

## Ключові концепції

### Чому `flushChanges()` і `applyChanges()` розділені?

**Проблема:** Якщо після кожної зміни одразу оновлювати WebGL буфери, це буде дуже повільно.

**Рішення:**
1. Збираємо всі зміни за кадр (`flushChanges()`)
2. Застосовуємо їх разом (`applyChanges()`)
3. Синхронізуємо з GPU один раз (`syncBuffers()`)

**Аналогія:** Замість того, щоб ходити до магазину після кожного продукту, краще скласти список і сходити один раз.

### Чому інтерполяція в `afterApplyChanges`?

**Проблема:** Юніти рухаються з певною швидкістю, але кадри оновлюються з фіксованою частотою (60 FPS). Між кадрами юніт може пройти частину шляху.

**Рішення:** Інтерполяція обчислює точну позицію юніта між кадрами, використовуючи час між кадрами (delta time).

**Приклад:**
- Кадр 1: юніт на позиції (100, 100)
- Кадр 2: юніт на позиції (110, 100) (через 16.67ms)
- Інтерполяція: показує юніта на (105, 100) для плавності

### Чому ефекти окремо від базової сцени?

**Причина:** Різні техніки рендерингу:
- Базові об'єкти: звичайні шейдери, один draw call на об'єкт
- Ефекти: GPU instancing (один draw call на тисячу частинок), спеціальні шейдери

## Де знайти код?

### Основні файли

- **[`useWebGLRenderLoop.ts`](../../src/ui/screens/Scene/hooks/useWebGLRenderLoop.ts)** — основний цикл рендерингу з усіма етапами
- **[`useSceneCanvas.ts`](../../src/ui/screens/Scene/hooks/useSceneCanvas.ts)** — приклад використання з усіма callbacks (рух камери, інтерполяція, ефекти)
- **[`SaveSlotBackgroundScene.tsx`](../../src/ui/screens/SaveSlotSelect/SaveSlotBackgroundScene.tsx)** — спрощений приклад використання (без камери та інтерполяції)

### Менеджери та сервіси

- **[`SceneObjectManager.ts`](../../src/logic/services/scene-object-manager/SceneObjectManager.ts)** — управління об'єктами на сцені, метод `flushChanges()`
- **[`ObjectsRendererManager.ts`](../../src/ui/renderers/objects/ObjectsRendererManager.ts)** — застосування змін до WebGL буферів, метод `applyChanges()`
- **[`WebGLSceneRenderer.ts`](../../src/ui/renderers/utils/WebGLSceneRenderer.ts)** — рендеринг базової сцени, метод `render()`

### Допоміжні файли

- **[`usePositionInterpolation.ts`](../../src/ui/screens/Scene/hooks/usePositionInterpolation.ts)** — інтерполяція позицій юнітів та куль
- **[`useWebGLSceneSetup.ts`](../../src/ui/screens/Scene/hooks/useWebGLSceneSetup.ts)** — ініціалізація WebGL контексту та renderer'а

## Питання для самоперевірки

1. Що відбувається, якщо викликати `scene.addObject()` під час рендерингу?
2. Чому `syncBuffers()` викликається після `applyChanges()`, а не до?
3. Навіщо потрібен `afterApplyChanges` callback?
4. Що станеться, якщо забути викликати `syncBuffers()`?

## Додаткові ресурси

- [WebGL Fundamentals](https://webglfundamentals.org/) — базові концепції WebGL
- [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame) — як працює анімація в браузері
- [GPU Instancing](https://learnopengl.com/Advanced-OpenGL/Instancing) — техніка для рендерингу багатьох об'єктів
