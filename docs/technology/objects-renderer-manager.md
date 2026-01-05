# ObjectsRendererManager — Менеджер рендерингу об'єктів

## Хто це?

`ObjectsRendererManager` — це **центральний менеджер**, який відповідає за перетворення логічних об'єктів сцени (`SceneObjectInstance`) у дані для WebGL рендерингу.

**Аналогія:** Якщо `SceneObjectManager` — це "склад" з об'єктами, то `ObjectsRendererManager` — це "конвеєр", який бере об'єкти зі складу, обробляє їх через спеціалізовані рендерери і готує дані для малювання на GPU.

---

## За що він відповідає?

### 1. **Управління рендерерами об'єктів**

Кожен тип об'єкта (brick, playerUnit, explosion, тощо) має свій спеціалізований `ObjectRenderer`:

```typescript
// Створення менеджера з реєстром рендерерів
const renderers = new Map<string, ObjectRenderer>([
  ["brick", new BrickObjectRenderer()],
  ["playerUnit", new PlayerUnitObjectRenderer()],
  ["explosion", new ExplosionObjectRenderer()],
  // ... інші типи
]);
const manager = new ObjectsRendererManager(renderers);
```

**Що це означає:** Коли додається об'єкт типу `"brick"`, менеджер знаходить `BrickObjectRenderer` і використовує його для обробки.

**Детальніше:** Див. [`createObjectsRendererManager()`](../../src/ui/renderers/objects/index.ts) (рядки 32-51)

---

### 2. **Розділення на статичні та динамічні об'єкти**

Менеджер розділяє об'єкти на дві категорії:

#### **Статичні об'єкти** (`StaticPrimitive`)
- **Що це:** Об'єкти, які **не змінюються** після створення (наприклад, цегли, стіни)
- **Як працює:** Дані збираються в один великий `Float32Array` і завантажуються в GPU один раз
- **Переваги:** Швидко малюються, не потребують оновлень

#### **Динамічні об'єкти** (`DynamicPrimitive`)
- **Що це:** Об'єкти, які **змінюються** кожен кадр (наприклад, юніти, що рухаються, анімації)
- **Як працює:** Дані зберігаються в окремому буфері, який можна оновлювати частково
- **Переваги:** Можна оновлювати тільки змінені частини, не перебудовуючи весь буфер

**Приклад:**
```typescript
// Цегла — статична (не рухається)
scene.addObject("brick", { position: { x: 100, y: 100 }, ... });

// Юніт — динамічний (рухається кожен кадр)
scene.addObject("playerUnit", { position: { x: 50, y: 50 }, ... });
```

---

### 3. **Застосування змін** (`applyChanges`)

Це **ключовий метод**, який викликається з render loop (етап 4):

```typescript
const changes = scene.flushChanges(); // { added: [...], updated: [...], removed: [...] }
objectsRenderer.applyChanges(changes);
```

**Що він робить:**

1. **Видалення** (`changes.removed`):
   - Видаляє об'єкт з внутрішніх структур
   - Позначає буфери як "брудні" (dirty) для перебудови

2. **Додавання** (`changes.added`):
   - Знаходить відповідний `ObjectRenderer` для типу об'єкта
   - Викликає `renderer.register(instance)` — це створює примітиви (вершини, кольори, тощо)
   - Додає примітиви в статичний або динамічний список
   - Позначає відповідний буфер як "брудний"

3. **Оновлення** (`changes.updated`):
   - Викликає `renderer.update(instance, registration)` — це перераховує дані об'єкта
   - Оновлює дані в динамічному буфері на місці (in-place)
   - Позначає, що потрібно завантажити оновлення в GPU

**Детальніше:** Див. метод [`applyChanges()`](../../src/ui/renderers/objects/ObjectsRendererManager.ts) (рядки 118-130)

---

### 4. **Інтерполяція позицій** (`applyInterpolatedPositions`)

Це метод для **плавного руху** об'єктів між кадрами:

```typescript
const interpolatedPositions = getInterpolatedUnitPositions(); // Map<objectId, position>
objectsRenderer.applyInterpolatedPositions(interpolatedPositions);
```

**Що він робить:**
- Бере інтерпольовані позиції (обчислені з урахуванням delta time)
- Тимчасово змінює позицію об'єкта в пам'яті
- Викликає `renderer.update()` для перерахунку вершин з новою позицією
- Відновлює оригінальну позицію (щоб не зламати логіку)
- Оновлює дані в динамічному буфері

**Чому це потрібно?** Без інтерполяції рух виглядає "дерганим" на 60 FPS. З інтерполяцією — плавний.

**Детальніше:** Див. метод [`applyInterpolatedPositions()`](../../src/ui/renderers/objects/ObjectsRendererManager.ts) (рядки 132-176)

---

### 5. **Автоматична анімація** (`tickAutoAnimating`)

Деякі об'єкти мають `customData.autoAnimate = true` — вони оновлюються автоматично кожен кадр:

```typescript
objectsRenderer.tickAutoAnimating();
```

**Що він робить:**
- Проходить по всіх об'єктах з `autoAnimate = true`
- Викликає `renderer.update()` для кожного (рендерер використовує поточний час для анімації)
- Оновлює дані в динамічному буфері

**Приклад:** Вибух, який змінює розмір з часом, або портал, який обертається.

**Детальніше:** Див. метод [`tickAutoAnimating()`](../../src/ui/renderers/objects/ObjectsRendererManager.ts) (рядки 186-233)

---

### 6. **Генерація інструкцій синхронізації** (`consumeSyncInstructions`)

Це метод, який **збирає всі зміни** і повертає інструкції для завантаження в GPU:

```typescript
const instructions = objectsRenderer.consumeSyncInstructions();
// {
//   staticData: Float32Array | null,      // Новий статичний буфер (якщо змінився)
//   dynamicData: Float32Array | null,     // Новий динамічний буфер (якщо змінився)
//   dynamicUpdates: DynamicBufferUpdate[] // Часткові оновлення динамічного буфера
// }
```

**Що він робить:**

1. **Якщо `staticDirty = true`:**
   - Перебудовує весь статичний буфер (`rebuildStaticData()`)
   - Повертає новий `staticData` для завантаження в GPU

2. **Якщо `dynamicLayoutDirty = true`:**
   - Перебудовує весь динамічний буфер (`rebuildDynamicData()`)
   - Повертає новий `dynamicData` для завантаження в GPU
   - **Коли це відбувається:** Коли додається/видаляється об'єкт або змінюється розмір примітиву

3. **Якщо `autoAnimatingNeedsUpload = true`:**
   - Повертає весь `dynamicData` (бо оновлення вже зроблені in-place)
   - **Оптимізація:** Краще завантажити весь буфер, ніж багато маленьких `bufferSubData()`

4. **Якщо є `pendingDynamicUpdates`:**
   - Повертає список часткових оновлень (offset + data)
   - **Оптимізація:** Оновлює тільки змінені частини буфера

**Детальніше:** Див. метод [`consumeSyncInstructions()`](../../src/ui/renderers/objects/ObjectsRendererManager.ts) (рядки 235-263)

---

## Внутрішня структура

### Основні структури даних:

```typescript
// Всі об'єкти, які керуються менеджером
private objects: Map<string, ManagedObject>
// ManagedObject = { instance, renderer, registration }

// Статичні примітиви (не змінюються)
private staticEntries: StaticEntry[]
// StaticEntry = { objectId, primitive }

// Динамічні примітиви (змінюються)
private dynamicEntries: DynamicEntry[]
// DynamicEntry = { objectId, primitive, offset, length }

// Швидкий пошук динамічного entry за примітивом
private dynamicEntryByPrimitive: Map<DynamicPrimitive, DynamicEntry>

// Об'єкти з автоматичною анімацією
private autoAnimatingIds: Set<string>
```

### Буфери даних:

```typescript
// Статичний буфер (завантажується один раз)
private staticData: Float32Array | null

// Динамічний буфер (оновлюється кожен кадр)
private dynamicData: Float32Array | null
```

### Флаги стану (dirty flags):

```typescript
// Потрібно перебудувати статичний буфер
private staticDirty: boolean

// Потрібно перебудувати динамічний буфер (змінився layout)
private dynamicLayoutDirty: boolean

// Потрібно завантажити весь динамічний буфер (оновлення in-place)
private autoAnimatingNeedsUpload: boolean
```

---

## Життєвий цикл об'єкта

### 1. **Реєстрація** (`registerObject`)
```typescript
// Коли: scene.addObject() → flushChanges() → applyChanges() → addObject() → registerObject()

1. Знаходить ObjectRenderer для типу об'єкта
2. Викликає renderer.register(instance) → отримує ObjectRegistration
   - ObjectRegistration містить staticPrimitives[] та dynamicPrimitives[]
3. Зберігає ManagedObject { instance, renderer, registration }
4. Додає примітиви в staticEntries або dynamicEntries
5. Позначає відповідний буфер як dirty
6. Якщо customData.autoAnimate === true → додає в autoAnimatingIds
```

### 2. **Оновлення** (`updateObject`)
```typescript
// Коли: scene.updateObject() → flushChanges() → applyChanges() → updateObject()

1. Знаходить ManagedObject за ID
2. Оновлює instance на новий
3. Викликає renderer.update(instance, registration) → отримує updates[]
4. Для кожного update:
   - Знаходить DynamicEntry за primitive
   - Оновлює дані в dynamicData на місці (entry.offset)
   - Позначає autoAnimatingNeedsUpload = true
```

### 3. **Видалення** (`removeObject`)
```typescript
// Коли: scene.removeObject() → flushChanges() → applyChanges() → removeObject()

1. Знаходить ManagedObject за ID
2. Видаляє з objects, autoAnimatingIds
3. Видаляє staticEntries та dynamicEntries
4. Позначає буфери як dirty (потрібна перебудова)
5. Викликає primitive.dispose() для динамічних примітивів
6. Викликає renderer.remove(instance, registration)
```

---

## Оптимізації

### 1. **In-place оновлення**
Замість створення нових `Float32Array` для кожного оновлення, дані оновлюються **на місці** в `dynamicData`:

```typescript
// ❌ Погано (створює новий масив кожен раз)
const newData = data.slice();
this.dynamicData.set(newData, entry.offset);

// ✅ Добре (оновлює на місці)
this.dynamicData.set(data, entry.offset);
```

### 2. **Повне завантаження vs часткові оновлення**
- **Повне завантаження** (`dynamicData`): Коли багато об'єктів оновилося або змінився layout
- **Часткові оновлення** (`dynamicUpdates`): Коли оновилося мало об'єктів

**Чому?** `gl.bufferSubData()` для багатьох маленьких оновлень повільніше, ніж один `gl.bufferData()` для всього буфера.

### 3. **Розумне перевиділення пам'яті**
Динамічний буфер перевиділяється тільки коли потрібно, з запасом 50%:

```typescript
const newCapacity = Math.ceil(totalLength * 1.5); // +50% запас
```

Це зменшує кількість перевиділень пам'яті.

---

## Взаємодія з іншими компонентами

```
SceneObjectManager (логіка)
    ↓ flushChanges()
ObjectsRendererManager (перетворення)
    ↓ consumeSyncInstructions()
WebGLSceneRenderer (завантаження в GPU)
    ↓ syncBuffers()
GPU (рендеринг)
```

**Потік даних:**
1. `SceneObjectManager` збирає зміни (`flushChanges()`)
2. `ObjectsRendererManager` застосовує зміни і перетворює в примітиви (`applyChanges()`)
3. `ObjectsRendererManager` генерує інструкції для GPU (`consumeSyncInstructions()`)
4. `WebGLSceneRenderer` завантажує дані в GPU (`syncBuffers()`)

---

## Де знайти код?

- **[`ObjectsRendererManager.ts`](../../src/ui/renderers/objects/ObjectsRendererManager.ts)** — основний клас (501 рядок)
- **[`createObjectsRendererManager()`](../../src/ui/renderers/objects/index.ts)** — фабрика для створення менеджера з реєстром рендерерів
- **[`ObjectRenderer.ts`](../../src/ui/renderers/objects/ObjectRenderer.ts)** — базовий клас для всіх рендерерів об'єктів

---

## Приклади використання

### Додавання об'єкта
```typescript
// У логіці
scene.addObject("brick", { position: { x: 100, y: 100 }, ... });

// У render loop
const changes = scene.flushChanges();
objectsRenderer.applyChanges(changes);
// → ObjectsRendererManager знаходить BrickObjectRenderer
// → BrickObjectRenderer.register() створює примітиви
// → Примітиви додаються в staticEntries
// → staticDirty = true
```

### Оновлення об'єкта
```typescript
// У логіці
scene.updateObject("unit-123", { position: { x: 150, y: 150 }, ... });

// У render loop
const changes = scene.flushChanges();
objectsRenderer.applyChanges(changes);
// → ObjectsRendererManager знаходить ManagedObject
// → PlayerUnitObjectRenderer.update() перераховує вершини
// → Дані оновлюються в dynamicData на місці
// → autoAnimatingNeedsUpload = true
```

### Інтерполяція позицій
```typescript
// У render loop (після applyChanges)
const interpolatedPositions = getInterpolatedUnitPositions();
objectsRenderer.applyInterpolatedPositions(interpolatedPositions);
// → Тимчасово змінює позицію в instance
// → Викликає renderer.update() з новою позицією
// → Оновлює dynamicData
// → Відновлює оригінальну позицію
```

---

## Питання для самоперевірки

1. Чому об'єкти розділені на статичні та динамічні?
2. Що таке `dirty flag` і навіщо він потрібен?
3. Чому `applyInterpolatedPositions` тимчасово змінює позицію, а потім відновлює?
4. Коли використовується повне завантаження буфера, а коли часткові оновлення?
5. Що станеться, якщо додати об'єкт з типом, для якого немає рендерера?

---

## Додаткові ресурси

- [Render Loop Lifecycle](./render-loop-lifecycle.md) — як `ObjectsRendererManager` вписується в загальний цикл
- [ObjectRenderer Interface](../../src/ui/renderers/objects/ObjectRenderer.ts) — інтерфейс для створення власних рендерерів
