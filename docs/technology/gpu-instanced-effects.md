# GPU-інстансні ефекти та примітиви

Цей документ описує архітектуру GPU-рендерерів для інстансних ефектів, їх життєвий цикл та різні типи реалізацій.

## Архітектура

У проекті використовуються два підходи до GPU-рендерингу:

1. **`GpuBatchRenderer`** — базовий клас для стандартних інстансних рендерерів
2. **`GpuInstancedPrimitiveLifecycle`** — інтерфейс для спеціальних випадків (наприклад, Transform Feedback)

## Типи рендерерів

### 1. Стандартні рендерери (extends `GpuBatchRenderer`)

Ці рендерери використовують класичну модель: CPU підготовлює дані → завантажує в instance buffer → GPU рендерить.

#### PetalAuraGpuRenderer
**Файл:** `src/ui/renderers/primitives/gpu/PetalAuraGpuRenderer.ts`

- **Призначення:** Анімовані пелюсткові аури навколо юнітів
- **Особливості:** Один instance може займати кілька слотів (`petalCount`)
- **API:** `petalAuraGpuRenderer.acquirePetalSlot(petalCount)`, `updateSlot()`, `releaseSlot()`

#### WhirlGpuRenderer
**Файл:** `src/ui/renderers/primitives/gpu/WhirlGpuRenderer.ts`

- **Призначення:** Вихори (sand storms, whirls)
- **API:** `whirlGpuRenderer.acquireSlot()`, `updateSlot()`, `releaseSlot()`

#### ArcGpuRenderer
**Файл:** `src/ui/renderers/primitives/gpu/ArcGpuRenderer.ts`

- **Призначення:** Дуги (spell arcs, lightning)
- **Особливості:** Використовує batch config для різних типів дуг
- **API:** `arcGpuRenderer.acquireSlot(config)`, `updateSlot()`, `releaseSlot()`

#### BulletGpuRenderer
**Файл:** `src/ui/renderers/primitives/gpu/BulletGpuRenderer.ts`

- **Призначення:** Кулі та снаряди
- **Особливості:** Підтримує різні форми (circle, sprite) та інтерполяцію позицій
- **API:** `bulletGpuRenderer.acquireSlot(config)`, `updateSlot()`, `releaseSlot()`

#### RingGpuRenderer
**Файл:** `src/ui/renderers/primitives/gpu/RingGpuRenderer.ts`

- **Призначення:** Розширюючі кільця (ring trails)
- **API:** `ringGpuRenderer.acquireSlot()`, `updateSlot()`, `releaseSlot()`

#### FireRingGpuRenderer
**Файл:** `src/ui/renderers/primitives/gpu/FireRingGpuRenderer.ts`

- **Призначення:** Вогняні кільця з шумом та анімацією
- **Особливості:** Вік обчислюється на GPU
- **API:** `fireRingGpuRenderer.acquireSlot()`, `updateSlot()`, `releaseSlot()`

#### ExplosionWaveGpuRenderer
**Файл:** `src/ui/renderers/primitives/gpu/ExplosionWaveGpuRenderer.ts`

- **Призначення:** Ударні хвилі вибухів
- **Особливості:** Використовує спільні ресурси з `ParticleEmitterGpuRenderer` (шейдери)
- **API:** `explosionWaveGpuRenderer.acquireSlot(config)`, `updateSlot()`, `releaseSlot()`

### 2. Спеціальний рендерер (implements `GpuInstancedPrimitiveLifecycle`)

#### ParticleEmitterGpuRenderer
**Файл:** `src/ui/renderers/primitives/gpu/ParticleEmitterGpuRenderer.ts`

- **Призначення:** Система частинок з GPU-симуляцією через Transform Feedback
- **Особливості:** Використовує ping-pong буфери для симуляції на GPU
- **Чому не extends `GpuBatchRenderer`:** Transform Feedback має принципово інший data flow (див. розділ про Transform Feedback)
- **API:** `particleEmitterGpuRenderer.beforeRender()`, `render()`, `clearInstances()`

## Життєвий цикл

### Інтерфейс `GpuInstancedPrimitiveLifecycle`

Всі GPU-рендерери реалізують цей інтерфейс для уніфікованого життєвого циклу:

```typescript
interface GpuInstancedPrimitiveLifecycle<TBatch> {
  onContextAcquired(gl: WebGL2RenderingContext): void;
  onContextLost(gl: WebGL2RenderingContext): void;
  ensureBatch(gl: WebGL2RenderingContext, capacity: number): TBatch | null;
  beforeRender(gl: WebGL2RenderingContext, timestampMs: number): void;
  render(
    gl: WebGL2RenderingContext,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    timestampMs: number
  ): void;
  clearInstances(gl?: WebGL2RenderingContext): void;
  dispose(): void;
}
```

### Методи життєвого циклу

#### `onContextAcquired(gl)`
**Коли викликається:** Під час ініціалізації WebGL2-контексту

**Що робить:**
- Створює шейдери та компілює програми
- Створює спільні буфери (наприклад, unit quad для частинок)
- Зберігає прив'язку до контексту

**Приклад:**
```typescript
protected createSharedResources(gl: WebGL2RenderingContext): { program: WebGLProgram } | null {
  const programResult = compileProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER, "[Renderer]");
  // ... створення буферів, attributes, uniforms
  return { program: programResult.program };
}
```

#### `beforeRender(gl, timestampMs)`
**Коли викликається:** Кожен кадр перед рендерингом

**Що робить:**
- Завантажує оновлені дані інстансів в GPU буфери (`gl.bufferSubData`)
- Виконує CPU-side підготовку (якщо потрібно)
- Для Transform Feedback: запускає симуляцію (див. розділ нижче)

**Приклад (GpuBatchRenderer):**
```typescript
public beforeRender(gl: WebGL2RenderingContext, _timestampMs: number): void {
  this.batches.forEach((batch) => {
    if (batch.needsUpload) {
      gl.bindBuffer(gl.ARRAY_BUFFER, batch.instanceBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.instanceData);
      batch.needsUpload = false;
    }
  });
}
```

#### `render(gl, cameraPosition, viewportSize, timestampMs)`
**Коли викликається:** Кожен кадр після `beforeRender()`

**Що робить:**
- Встановлює uniform'и камери та viewport
- Налаштовує blend mode
- Виконує `gl.drawArraysInstanced()` для кожного batch

**Приклад:**
```typescript
public render(gl: WebGL2RenderingContext, cameraPosition: SceneVector2, viewportSize: SceneSize, timestampMs: number): void {
  gl.useProgram(this.sharedResources.program);
  this.batches.forEach((batch) => {
    if (batch.activeCount <= 0) return;
    this.setupRenderState(gl, batch, cameraPosition, viewportSize, timestampMs);
    gl.bindVertexArray(batch.vao);
    gl.drawArraysInstanced(drawMode, 0, vertexCount, batch.capacity);
  });
}
```

#### `clearInstances(gl?)`
**Коли викликається:** При рестарті мапи або очищенні сцени

**Що робить:**
- Скидає всі активні інстанси
- Очищає free slots
- Позначає буфери для перезавантаження

**Важливо:** Не видаляє WebGL ресурси (буфери, VAO) — вони перевикористовуються

#### `dispose()`
**Коли викликається:** При демонтажі сцени або закритті застосунку

**Що робить:**
- Видаляє всі WebGL ресурси (програми, буфери, VAO)
- Очищає внутрішні структури даних

### Інтеграція в render loop

У `useSceneCanvas.ts` всі рендерери викликаються в уніфікованому порядку:

```typescript
beforeEffects: (timestamp, gl, cameraState) => {
  // 1. Explosion waves
  explosionWaveGpuRenderer.beforeRender(gl, timestamp);
  explosionWaveGpuRenderer.render(gl, cameraState.position, cameraState.viewportSize, timestamp);
  
  // 2. Particle emitters (Transform Feedback)
  particleEmitterGpuRenderer.beforeRender(gl, timestamp);
  particleEmitterGpuRenderer.render(gl, cameraState.position, cameraState.viewportSize, timestamp);
  
  // 3. Whirls
  whirlGpuRenderer.beforeRender(gl, timestamp);
  whirlGpuRenderer.render(gl, cameraState.position, cameraState.viewportSize, timestamp);
  
  // 4. Petal auras
  petalAuraGpuRenderer.beforeRender(gl, timestamp);
  petalAuraGpuRenderer.render(gl, cameraState.position, cameraState.viewportSize, timestamp);
  
  // ... інші рендерери
}
```

## Transform Feedback та життєвий цикл

### Що таке Transform Feedback?

Transform Feedback дозволяє виконувати симуляцію частинок повністю на GPU без readback на CPU. Дані зберігаються в буферах і обробляються шейдером, результат записується назад в буфер.

### Проблема з життєвим циклом

**Класична модель (GpuBatchRenderer):**
```
CPU → instanceData → upload → GPU buffer → render
```

**Transform Feedback:**
```
GPU buffer A → simulate → GPU buffer B → render → swap → repeat
     ↑
CPU spawn data (тільки нові частинки)
```

### Рішення: Розділення відповідальності

`ParticleEmitterGpuRenderer` **НЕ** extends `GpuBatchRenderer`, а реалізує `GpuInstancedPrimitiveLifecycle` напряму:

1. **Симуляція** залишається в `ParticleEmitterPrimitive.ts`:
   - `advanceParticleEmitterStateGpu()` — запускає Transform Feedback
   - `stepParticleSimulation()` — виконує ping-pong симуляцію
   - Спавн нових частинок відбувається тут

2. **Рендеринг** в `ParticleEmitterGpuRenderer`:
   - `beforeRender()` — no-op (симуляція вже виконана)
   - `render()` — малює частинки з поточного буфера

### Як працювати з Transform Feedback

#### 1. Структура даних

```typescript
interface ParticleEmitterGpuState {
  gl: WebGL2RenderingContext;
  capacity: number;
  buffers: [WebGLBuffer | null, WebGLBuffer | null]; // Ping-pong
  transformFeedbacks: [WebGLTransformFeedback | null, WebGLTransformFeedback | null];
  simulationVaos: [WebGLVertexArrayObject | null, WebGLVertexArrayObject | null];
  renderVaos: [WebGLVertexArrayObject | null, WebGLVertexArrayObject | null];
  program: ParticleSimulationProgram;
  currentBufferIndex: 0 | 1; // Поточний буфер для читання
  // ...
}
```

#### 2. Симуляція (в `ParticleEmitterPrimitive.ts`)

```typescript
const stepParticleSimulation = (
  gpu: ParticleEmitterGpuState,
  capacity: number,
  deltaMs: number
): void => {
  const gl = gpu.gl;
  const sourceIndex = gpu.currentBufferIndex;
  const targetIndex = sourceIndex === 0 ? 1 : 0;
  
  // Налаштування Transform Feedback
  gl.useProgram(gpu.program.program);
  gl.uniform1f(gpu.program.deltaUniform, deltaMs);
  
  // Прив'язка буферів
  gl.bindVertexArray(gpu.simulationVaos[sourceIndex]);
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, gpu.transformFeedbacks[targetIndex]);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, gpu.buffers[targetIndex]);
  
  // Симуляція (без рендерингу)
  gl.enable(gl.RASTERIZER_DISCARD);
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, capacity);
  gl.endTransformFeedback();
  gl.disable(gl.RASTERIZER_DISCARD);
  
  // Swap буферів
  gpu.currentBufferIndex = targetIndex;
};
```

#### 3. Рендеринг (в `ParticleEmitterGpuRenderer`)

```typescript
public render(gl: WebGL2RenderingContext, cameraPosition: SceneVector2, viewportSize: SceneSize): void {
  const context = rendererContexts.get(gl);
  if (!context) return;
  
  // Використовуємо поточний буфер після симуляції
  context.emitters.forEach((handle) => {
    const vao = handle.getCurrentVao(); // Повертає renderVao[currentBufferIndex]
    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, handle.capacity);
  });
}
```

### Важливі моменти

1. **Симуляція виконується ДО `beforeRender()`:**
   - `advanceParticleEmitterStateGpu()` викликається в `ParticleEmitterPrimitive.update()`
   - Це відбувається в основному render loop, перед `beforeEffects`

2. **Рендеримо `capacity`, а не `activeCount`:**
   - Неактивні частинки відсікаються в шейдері через `alpha=0`
   - Це вирішує проблему slot fragmentation

3. **Не копіюємо дані CPU↔GPU:**
   - Всі дані залишаються в GPU буферах
   - CPU тільки спавнить нові частинки

4. **Ping-pong буфери:**
   - Кожен кадр: buffer A (read) → simulate → buffer B (write)
   - Наступний кадр: buffer B (read) → simulate → buffer A (write)

## Створення нового рендерера

### Варіант 1: Стандартний рендерер (extends `GpuBatchRenderer`)

```typescript
class MyGpuRenderer extends GpuBatchRenderer<MyInstance, MyBatch, MyConfig> {
  protected createSharedResources(gl: WebGL2RenderingContext): { program: WebGLProgram } | null {
    // Створення шейдерів, буферів
  }
  
  protected createBatch(gl: WebGL2RenderingContext, capacity: number): MyBatch | null {
    // Створення VAO, instance buffer
  }
  
  protected writeInstanceData(batch: MyBatch, slotIndex: number, instance: MyInstance): void {
    // Запис даних в batch.instanceData
  }
  
  protected setupRenderState(gl: WebGL2RenderingContext, batch: MyBatch, ...): void {
    // Налаштування uniform'ів, blend mode
  }
  
  // ... інші абстрактні методи
}

export const myGpuRenderer = new MyGpuRenderer();
```

### Варіант 2: Спеціальний рендерер (implements `GpuInstancedPrimitiveLifecycle`)

```typescript
class MySpecialRenderer implements GpuInstancedPrimitiveLifecycle<MyBatch> {
  public beforeRender(gl: WebGL2RenderingContext, timestampMs: number): void {
    // Спеціальна логіка (наприклад, Transform Feedback)
  }
  
  public render(gl: WebGL2RenderingContext, cameraPosition: SceneVector2, viewportSize: SceneSize, timestampMs: number): void {
    // Рендеринг
  }
  
  // ... інші методи інтерфейсу
}

export const mySpecialRenderer = new MySpecialRenderer();
```

## Ключові концепції

### Slot Management

- **`acquireSlot(config)`** — отримує вільний слот в batch
- **`updateSlot(handle, instance)`** — оновлює дані інстансу
- **`releaseSlot(handle)`** — звільняє слот

### Batch Key

- Використовується для групування інстансів з однаковими параметрами
- Для рендерерів без config: повертає `"default"`
- Для рендерерів з config: серіалізує config в рядок

### Active Count

- Відстежує кількість активних інстансів
- **Важливо:** Рендеримо `capacity`, а не `activeCount` (неактивні відсікаються в шейдері)

## Де знайти код?

### Базові класи та інтерфейси

- **`GpuBatchRenderer`** — `src/ui/renderers/primitives/core/GpuBatchRenderer.ts`
- **`GpuInstancedPrimitiveLifecycle`** — `src/ui/renderers/primitives/gpu/GpuInstancedPrimitiveLifecycle.ts`

### Приклади реалізацій

- **Стандартний:** `PetalAuraGpuRenderer.ts`, `WhirlGpuRenderer.ts`, `ArcGpuRenderer.ts`
- **Спеціальний:** `ParticleEmitterGpuRenderer.ts`

### Інтеграція

- **Render loop:** `src/ui/screens/Scene/hooks/useSceneCanvas.ts`
- **Cleanup:** `src/logic/modules/active-map/map/map.scene-cleanup.ts`

## Додаткові ресурси

- [WebGL Transform Feedback](https://webgl2fundamentals.org/webgl/lessons/webgl-gpgpu.html) — базові концепції
- [GPU Instancing](https://learnopengl.com/Advanced-OpenGL/Instancing) — техніка для рендерингу багатьох об'єктів
- [Ping-Pong Buffers](https://www.khronos.org/opengl/wiki/Transform_Feedback) — техніка для GPU-симуляції
